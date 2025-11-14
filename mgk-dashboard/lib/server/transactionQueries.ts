import { getFirestoreAdmin } from './firebaseAdmin';
import { computeNextDueDate, loadCurrentSchedule } from './autoInvestHelpers';
import {
  determineMarketFromContext,
  formatDate,
  getMarketToday,
} from '@/lib/utils/tradingCalendar';
import {
  convertWithRate,
  getUsdKrwRate,
  type SupportedCurrency,
} from '@/lib/currency';

type TransactionRecord = {
  id: string;
  [key: string]: any;
};

type TransactionFilters = {
  symbol?: string;
  type?: 'buy' | 'sell' | 'dividend';
  purchaseMethod?: 'auto' | 'manual';
  startDate?: string;
  endDate?: string;
  limit?: number;
};

export async function fetchTransactionsServer(
  userId: string,
  portfolioId: string,
  filters: TransactionFilters = {}
) {
  const db = getFirestoreAdmin();
  let query = db
    .collection('users')
    .doc(userId)
    .collection('portfolios')
    .doc(portfolioId)
    .collection('transactions')
    .orderBy('date', 'desc');

  if (filters.symbol) {
    query = query.where('symbol', '==', filters.symbol);
  }

  if (filters.type) {
    query = query.where('type', '==', filters.type);
  }

  if (filters.purchaseMethod) {
    query = query.where('purchaseMethod', '==', filters.purchaseMethod);
  }

  if (filters.startDate) {
    query = query.where('date', '>=', filters.startDate);
  }

  if (filters.endDate) {
    query = query.where('date', '<=', filters.endDate);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, any>),
  }));
}

function resolveTransactionCurrency(
  transaction: TransactionRecord,
  positionMap: Map<string, Record<string, any>>
): 'USD' | 'KRW' {
  const symbol = (transaction.symbol || '').trim();

  if (/^[0-9]{4,6}$/.test(symbol)) {
    return 'KRW';
  }

  const position = transaction.positionId
    ? positionMap.get(transaction.positionId)
    : undefined;

  if (position) {
    if (position.market === 'KR') {
      return 'KRW';
    }
    if (position.currency === 'KRW' || position.currency === 'USD') {
      return position.currency;
    }
  }

  const raw = transaction.currency;
  if (typeof raw === 'string') {
    const upper = raw.toUpperCase();
    if (upper === 'KRW') {
      return 'KRW';
    }
    if (upper === 'USD') {
      return 'USD';
    }
  }

  return 'USD';
}

export async function calculateTransactionStatsServer(
  userId: string,
  portfolioId: string,
  filters: TransactionFilters = {}
) {
  const transactions = await fetchTransactionsServer(userId, portfolioId, filters);
  const db = getFirestoreAdmin();
  const positionsSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('portfolios')
    .doc(portfolioId)
    .collection('positions')
    .get();

  const positionMap = new Map<string, Record<string, any>>();
  positionsSnapshot.forEach((docSnapshot) => {
    positionMap.set(docSnapshot.id, docSnapshot.data() as Record<string, any>);
  });

  const statsTemplate = {
    totalBuys: 0,
    totalSells: 0,
    totalBuyAmount: 0,
    totalSellAmount: 0,
  };

  const mutableStats: Record<SupportedCurrency, typeof statsTemplate> = {
    USD: { ...statsTemplate },
    KRW: { ...statsTemplate },
  };

  transactions.forEach((transaction) => {
    const currency = resolveTransactionCurrency(transaction, positionMap);
    if (transaction.type === 'buy') {
      mutableStats[currency].totalBuyAmount += transaction.amount ?? 0;
      mutableStats[currency].totalBuys += transaction.shares ?? 0;
    } else if (transaction.type === 'sell') {
      mutableStats[currency].totalSellAmount += transaction.amount ?? 0;
      mutableStats[currency].totalSells += transaction.shares ?? 0;
    }
  });

  const finalize = (currency: SupportedCurrency) => {
    const totals = mutableStats[currency];
    return {
      totalBuys: totals.totalBuys,
      totalSells: totals.totalSells,
      totalBuyAmount: totals.totalBuyAmount,
      totalSellAmount: totals.totalSellAmount,
      averageBuyPrice:
        totals.totalBuys > 0 ? totals.totalBuyAmount / totals.totalBuys : 0,
      averageSellPrice:
        totals.totalSells > 0 ? totals.totalSellAmount / totals.totalSells : 0,
    };
  };

  const { rate, source } = await getUsdKrwRate();

  const totalBuyUsd =
    mutableStats.USD.totalBuyAmount +
    convertWithRate(mutableStats.KRW.totalBuyAmount, 'KRW', 'USD', rate);
  const totalSellUsd =
    mutableStats.USD.totalSellAmount +
    convertWithRate(mutableStats.KRW.totalSellAmount, 'KRW', 'USD', rate);

  const totalBuyKrw =
    mutableStats.KRW.totalBuyAmount +
    convertWithRate(mutableStats.USD.totalBuyAmount, 'USD', 'KRW', rate);
  const totalSellKrw =
    mutableStats.KRW.totalSellAmount +
    convertWithRate(mutableStats.USD.totalSellAmount, 'USD', 'KRW', rate);

  return {
    transactionCount: transactions.length,
    byCurrency: {
      USD: finalize('USD'),
      KRW: finalize('KRW'),
    },
    combined: {
      baseCurrency: 'USD' as SupportedCurrency,
      totalBuyAmount: totalBuyUsd,
      totalSellAmount: totalSellUsd,
      netAmount: totalSellUsd - totalBuyUsd,
    },
    converted: {
      USD: {
        totalBuyAmount: totalBuyUsd,
        totalSellAmount: totalSellUsd,
        netAmount: totalSellUsd - totalBuyUsd,
      },
      KRW: {
        totalBuyAmount: totalBuyKrw,
        totalSellAmount: totalSellKrw,
        netAmount: totalSellKrw - totalBuyKrw,
      },
    },
    exchangeRate: {
      base: 'USD' as const,
      quote: 'KRW' as const,
      rate,
      source,
    },
  };
}

type UpcomingAutoInvestPlan = {
  positionId: string;
  symbol: string;
  amount: number;
  currency: 'USD' | 'KRW';
  scheduledDate: string;
  displayDate: string;
  frequency: string;
  executed: boolean;
  isToday: boolean;
};

export async function buildUpcomingAutoInvests(
  userId: string,
  portfolioId: string
): Promise<UpcomingAutoInvestPlan[]> {
  const db = getFirestoreAdmin();
  const positionsSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('portfolios')
    .doc(portfolioId)
    .collection('positions')
    .get();

  const todayKst = formatDate(getMarketToday('KR'));
  const plans: UpcomingAutoInvestPlan[] = [];

  for (const docSnapshot of positionsSnapshot.docs) {
    const position = docSnapshot.data();
    const autoInvestConfig = position.autoInvestConfig;

    if (!autoInvestConfig?.isActive) {
      continue;
    }

    const schedule = await loadCurrentSchedule(
      userId,
      portfolioId,
      docSnapshot.id,
      autoInvestConfig.currentScheduleId
    );

    if (!schedule) {
      continue;
    }

    const effectiveFrom = schedule.effectiveFrom || autoInvestConfig.startDate;
    if (!effectiveFrom) {
      continue;
    }

    const market = determineMarketFromContext(position.market, schedule.currency, position.symbol);
    const today = formatDate(getMarketToday(market));

    const nextDueDate = computeNextDueDate({
      startDate: effectiveFrom,
      frequency: schedule.frequency,
      market,
      today,
      lastExecuted: autoInvestConfig.lastExecuted,
    });

    if (!nextDueDate) {
      continue;
    }

    const transactionSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('portfolios')
      .doc(portfolioId)
      .collection('transactions')
      .where('positionId', '==', docSnapshot.id)
      .where('purchaseMethod', '==', 'auto')
      .where('date', '==', nextDueDate)
      .limit(1)
      .get();

    plans.push({
      positionId: docSnapshot.id,
      symbol: position.symbol,
      amount: Number(schedule.amount ?? 0),
      currency: schedule.currency,
      scheduledDate: nextDueDate,
      displayDate: nextDueDate,
      frequency: schedule.frequency,
      executed: !transactionSnapshot.empty,
      isToday: nextDueDate === todayKst || nextDueDate === today,
    });
  }

  return plans.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}

