import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreAdmin } from './firebaseAdmin';
import { computeNextDueDate, loadCurrentSchedule } from './autoInvestHelpers';
import {
  determineMarketFromContext,
  formatDate,
  getMarketToday,
  parseISODate,
} from '@/lib/utils/tradingCalendar';
import { getHistoricalPrice, getHistoricalExchangeRate } from '@/lib/apis/alphavantage';

type ExecutionLogStatus = 'success' | 'skipped' | 'error' | 'preview';

type ExecutionLog = {
  userId: string;
  portfolioId: string;
  positionId: string;
  symbol: string;
  scheduledDate: string;
  amount: number;
  currency: 'USD' | 'KRW';
  status: ExecutionLogStatus;
  message?: string;
  shares?: number;
  price?: number;
  balanceBefore?: number;
  balanceAfter?: number;
};

async function ensureSufficientBalance(
  params: {
    userId: string;
    portfolioId: string;
    currency: 'USD' | 'KRW';
    amount: number;
  },
  tx: FirebaseFirestore.Transaction
): Promise<{ previousBalance: number; remainingBalance: number }> {
  const { userId, portfolioId, currency, amount } = params;
  const db = getFirestoreAdmin();
  const balanceRef = db
    .collection('users')
    .doc(userId)
    .collection('portfolios')
    .doc(portfolioId)
    .collection('balance')
    .doc(currency);

  const balanceDoc = await tx.get(balanceRef);
  const currentBalance = balanceDoc.exists ? (balanceDoc.data()?.balance ?? 0) : 0;

  if (currentBalance < amount) {
    throw new Error(`잔액 부족 (${currency}) - 필요 금액: ${amount}, 현재 잔액: ${currentBalance}`);
  }

  const remaining = currentBalance - amount;

  tx.set(
    balanceRef,
    {
      userId,
      portfolioId,
      currency,
      balance: remaining,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: balanceDoc.exists ? balanceDoc.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    previousBalance: currentBalance,
    remainingBalance: remaining,
  };
}

async function getCurrentBalance(
  userId: string,
  portfolioId: string,
  currency: 'USD' | 'KRW'
): Promise<number> {
  const db = getFirestoreAdmin();
  const balanceRef = db
    .collection('users')
    .doc(userId)
    .collection('portfolios')
    .doc(portfolioId)
    .collection('balance')
    .doc(currency);

  const snapshot = await balanceRef.get();
  if (!snapshot.exists) {
    return 0;
  }

  const data = snapshot.data();
  return Number(data?.balance ?? 0);
}

function computePositionAfterBuy(position: Record<string, any>, amount: number, shares: number, price: number) {
  const previousShares = Number(position.shares ?? 0);
  const previousTotalInvested = Number(position.totalInvested ?? 0);
  const previousTransactionCount = Number(position.transactionCount ?? 0);

  const newShares = previousShares + shares;
  const newTotalInvested = previousTotalInvested + amount;
  const newAveragePrice = newShares > 0 ? newTotalInvested / newShares : price;
  const currentPrice = Number(position.currentPrice ?? price);
  const normalizedInvested = newShares > 0 ? newShares * newAveragePrice : 0;
  const newTotalValue = newShares * currentPrice;
  const profitLoss = newTotalValue - normalizedInvested;
  const returnRate = normalizedInvested > 0 ? (profitLoss / normalizedInvested) * 100 : 0;

  return {
    shares: newShares,
    totalInvested: normalizedInvested,
    averagePrice: newAveragePrice,
    totalValue: newTotalValue,
    profitLoss,
    returnRate,
    transactionCount: previousTransactionCount + 1,
  };
}

async function createAutoTransaction(params: {
  userId: string;
  portfolioId: string;
  positionId: string;
  position: Record<string, any>;
  schedule: Record<string, any>;
  scheduleAmount: number;
  scheduledDate: string;
  price: number;
  shares: number;
  exchangeRate?: number | null;
}) {
  const { userId, portfolioId, positionId, position, schedule, scheduleAmount, scheduledDate, price, shares, exchangeRate } =
    params;
  const db = getFirestoreAdmin();
  const transactionsRef = db
    .collection('users')
    .doc(userId)
    .collection('portfolios')
    .doc(portfolioId)
    .collection('transactions');

  const transactionRef = transactionsRef.doc();
  const executedAt = new Date().toISOString();
  const totalAmount = scheduleAmount;
  const currency = schedule.currency as 'USD' | 'KRW';

  let balanceImpact: { previousBalance: number; remainingBalance: number } | null = null;

  await db.runTransaction(async (tx) => {
    balanceImpact = await ensureSufficientBalance(
      {
        userId,
        portfolioId,
        currency,
        amount: totalAmount,
      },
      tx
    );

    const positionRef = db
      .collection('users')
      .doc(userId)
      .collection('portfolios')
      .doc(portfolioId)
      .collection('positions')
      .doc(positionId);

    const positionDoc = await tx.get(positionRef);
    if (!positionDoc.exists) {
      throw new Error('포지션을 찾을 수 없습니다.');
    }

    const computed = computePositionAfterBuy(positionDoc.data() ?? {}, totalAmount, shares, price);

    tx.set(transactionRef, {
      portfolioId,
      positionId,
      stockId: position.stockId ?? position.symbol,
      type: 'buy',
      symbol: position.symbol,
      shares,
      price,
      amount: totalAmount,
      fee: 0,
      tax: 0,
      totalAmount,
      date: scheduledDate,
      memo: schedule.note ?? `자동 투자 (${schedule.frequency})`,
      purchaseMethod: 'auto',
      purchaseUnit: 'amount',
      currency,
      executedAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      status: 'completed',
      scheduledDate,
      ...(typeof exchangeRate === 'number' ? { exchangeRate } : {}),
    });

    tx.update(positionRef, {
      ...computed,
      lastTransactionDate: scheduledDate,
      updatedAt: FieldValue.serverTimestamp(),
      autoInvestConfig: {
        ...(position.autoInvestConfig ?? {}),
        lastExecuted: scheduledDate,
        lastUpdated: scheduledDate,
        currentScheduleId: schedule.id,
        amount: scheduleAmount,
        frequency: schedule.frequency,
        isActive: true,
        startDate: position.autoInvestConfig?.startDate ?? schedule.effectiveFrom ?? scheduledDate,
      },
      purchaseMethod: 'auto',
    });
  });

  return {
    transactionId: transactionRef.id,
    shares,
    price,
    balanceImpact: balanceImpact
      ? {
          currency,
          before: balanceImpact.previousBalance,
          after: balanceImpact.remainingBalance,
        }
      : undefined,
  };
}

export async function executeAutoInvestForToday(options?: {
  runDate?: string;
  dryRun?: boolean;
}) {
  const db = getFirestoreAdmin();
  const logs: ExecutionLog[] = [];
  const now = options?.runDate ? parseISODate(options.runDate) : new Date();
  const triggeredAt = now.toISOString();

  const positionsSnapshot = await db
    .collectionGroup('positions')
    .where('autoInvestConfig.isActive', '==', true)
    .get();

  for (const docSnapshot of positionsSnapshot.docs) {
    try {
      const pathSegments = docSnapshot.ref.path.split('/');
      const userId = pathSegments[1];
      const portfolioId = pathSegments[3];
      const positionId = docSnapshot.id;
      const position = docSnapshot.data();
      const autoInvestConfig = position.autoInvestConfig;

      if (!autoInvestConfig) {
        logs.push({
          userId,
          portfolioId,
          positionId,
          symbol: position.symbol,
          scheduledDate: '',
          amount: 0,
          currency: position.currency ?? 'USD',
          status: 'skipped',
          message: '자동 투자 설정이 비어 있습니다.',
        });
        continue;
      }

      const schedule = await loadCurrentSchedule(userId, portfolioId, positionId, autoInvestConfig.currentScheduleId);
      if (!schedule) {
        logs.push({
          userId,
          portfolioId,
          positionId,
          symbol: position.symbol,
          scheduledDate: '',
          amount: 0,
          currency: position.currency ?? 'USD',
          status: 'skipped',
          message: '활성 자동 투자 스케줄이 없습니다.',
        });
        continue;
      }

      const scheduleAmount = Number(schedule.amount ?? 0);
      if (!Number.isFinite(scheduleAmount) || scheduleAmount <= 0) {
        logs.push({
          userId,
          portfolioId,
          positionId,
          symbol: position.symbol,
          scheduledDate: '',
          amount: scheduleAmount,
          currency: schedule.currency,
          status: 'skipped',
          message: '스케줄 금액이 올바르지 않습니다.',
        });
        continue;
      }

      const effectiveFrom = schedule.effectiveFrom || autoInvestConfig.startDate;
      if (!effectiveFrom) {
        logs.push({
          userId,
          portfolioId,
          positionId,
          symbol: position.symbol,
          scheduledDate: '',
          amount: scheduleAmount,
          currency: schedule.currency,
          status: 'skipped',
          message: '스케줄 시작일이 없습니다.',
        });
        continue;
      }

      const market = determineMarketFromContext(position.market, schedule.currency, position.symbol);
      const today = formatDate(getMarketToday(market));
      if (today < effectiveFrom) {
        logs.push({
          userId,
          portfolioId,
          positionId,
          symbol: position.symbol,
          scheduledDate: today,
          amount: scheduleAmount,
          currency: schedule.currency,
          status: 'skipped',
          message: '효력 시작 이전입니다.',
        });
        continue;
      }

      if (schedule.effectiveTo && today > schedule.effectiveTo) {
        logs.push({
          userId,
          portfolioId,
          positionId,
          symbol: position.symbol,
          scheduledDate: today,
          amount: scheduleAmount,
          currency: schedule.currency,
          status: 'skipped',
          message: '스케줄 종료일을 초과했습니다.',
        });
        continue;
      }

      const nextDueDate = computeNextDueDate({
        startDate: effectiveFrom,
        frequency: schedule.frequency,
        market,
        today,
        lastExecuted: autoInvestConfig.lastExecuted,
      });

      if (!nextDueDate) {
        logs.push({
          userId,
          portfolioId,
          positionId,
          symbol: position.symbol,
          scheduledDate: today,
          amount: scheduleAmount,
          currency: schedule.currency,
          status: 'skipped',
          message: '오늘은 자동 투자 대상이 아닙니다.',
        });
        continue;
      }

      // 중복 실행 방지
      const existingSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('portfolios')
        .doc(portfolioId)
        .collection('transactions')
        .where('positionId', '==', positionId)
        .where('purchaseMethod', '==', 'auto')
        .where('date', '==', nextDueDate)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        logs.push({
          userId,
          portfolioId,
          positionId,
          symbol: position.symbol,
          scheduledDate: nextDueDate,
          amount: scheduleAmount,
          currency: schedule.currency,
          status: 'skipped',
          message: '이미 자동 투자가 실행되었습니다.',
        });
        continue;
      }

      const price =
        (await getHistoricalPrice(position.symbol, nextDueDate, 'auto', market).catch(() => null)) ??
        Number(position.currentPrice ?? 0);

      if (!price || !Number.isFinite(price) || price <= 0) {
        logs.push({
          userId,
          portfolioId,
          positionId,
          symbol: position.symbol,
          scheduledDate: nextDueDate,
          amount: scheduleAmount,
          currency: schedule.currency,
          status: 'error',
          message: '자동 투자 가격을 계산할 수 없습니다.',
        });
        continue;
      }

      const shares = Number((scheduleAmount / price).toFixed(6));
      if (shares <= 0) {
        logs.push({
          userId,
          portfolioId,
          positionId,
          symbol: position.symbol,
          scheduledDate: nextDueDate,
          amount: scheduleAmount,
          currency: schedule.currency,
          status: 'error',
          message: '계산된 수량이 0 이하입니다.',
        });
        continue;
      }

      let exchangeRate: number | null = null;
      if (schedule.currency === 'USD') {
        exchangeRate = await getHistoricalExchangeRate(nextDueDate, 'USD', 'KRW');
      }

      if (options?.dryRun) {
        const balanceBefore = await getCurrentBalance(userId, portfolioId, schedule.currency);
        logs.push({
          userId,
          portfolioId,
          positionId,
          symbol: position.symbol,
          scheduledDate: nextDueDate,
          amount: scheduleAmount,
          currency: schedule.currency,
          status: 'preview',
          message: 'Dry run - 거래 생성 없음',
          balanceBefore,
          balanceAfter: balanceBefore,
        });
        continue;
      }

      const { price: executedPrice, shares: executedShares, balanceImpact } = await createAutoTransaction({
        userId,
        portfolioId,
        positionId,
        position,
        schedule,
        scheduleAmount,
        scheduledDate: nextDueDate,
        price,
        shares,
        exchangeRate: exchangeRate ?? undefined,
        scheduledDate: nextDueDate,
        price,
        shares,
        exchangeRate: exchangeRate ?? undefined,
      });

      logs.push({
        userId,
        portfolioId,
        positionId,
        symbol: position.symbol,
        scheduledDate: nextDueDate,
        amount: scheduleAmount,
        currency: schedule.currency,
        status: 'success',
        shares: executedShares,
        price: executedPrice,
        balanceBefore: balanceImpact?.before,
        balanceAfter: balanceImpact?.after,
      });
    } catch (error) {
      logs.push({
        userId: 'unknown',
        portfolioId: 'unknown',
        positionId: 'unknown',
        symbol: 'unknown',
        scheduledDate: '',
        amount: 0,
        currency: 'USD',
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await persistAutomationLogs(triggeredAt, logs, Boolean(options?.dryRun));

  return {
    triggeredAt,
    processed: logs.length,
    summary: {
      success: logs.filter((log) => log.status === 'success').length,
      skipped: logs.filter((log) => log.status === 'skipped').length,
      preview: logs.filter((log) => log.status === 'preview').length,
      error: logs.filter((log) => log.status === 'error').length,
    },
    logs,
  };
}

async function persistAutomationLogs(triggeredAt: string, logs: ExecutionLog[], skipLogging: boolean) {
  if (skipLogging || !logs.length) {
    return;
  }

  const db = getFirestoreAdmin();
  const batch = db.batch();

  logs.forEach((log) => {
    const docRef = db.collection('automationLogs').doc();
    batch.set(docRef, {
      ...log,
      triggeredAt,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
}

