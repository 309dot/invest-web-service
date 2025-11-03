/**
 * 거래 관리 서비스
 * 
 * 매수/매도 거래 이력을 관리하는 서비스
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  deleteDoc,
  limit as firestoreLimit,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Position, Transaction } from '@/types';
import { updatePositionAfterTransaction, recalculatePositionFromTransactions } from './position';
import {
  adjustToNextTradingDay,
  determineMarketFromContext,
  formatDate as formatMarketDate,
  isTradingDay,
} from '@/lib/utils/tradingCalendar';
import { getHistoricalExchangeRate } from '@/lib/apis/alphavantage';
import {
  convertWithRate,
  getUsdKrwRate,
  type SupportedCurrency,
} from '@/lib/currency';

async function normalizeTransactions(
  userId: string,
  portfolioId: string,
  transactions: Transaction[],
  positionMap: Map<string, Partial<Position>>
): Promise<void> {
  const fxCache = new Map<string, number | null>();

  for (const transaction of transactions) {
    const resolvedCurrency = resolveTransactionCurrency(transaction, positionMap);
    const updatePayload: Record<string, unknown> = {};

    if (transaction.currency !== resolvedCurrency) {
      updatePayload.currency = resolvedCurrency;
      transaction.currency = resolvedCurrency;
    }

    if (!transaction.id || !transaction.date) {
      if (
        resolvedCurrency === 'USD' &&
        transaction.date &&
        transaction.exchangeRate === undefined
      ) {
        let fx = fxCache.get(transaction.date);
        if (fx === undefined) {
          fx = await getHistoricalExchangeRate(transaction.date, 'USD', 'KRW');
          fxCache.set(transaction.date, fx ?? null);
        }
        if (fx !== null && Number.isFinite(fx)) {
          updatePayload.exchangeRate = fx;
          transaction.exchangeRate = fx as number;
        }
      }

      if (Object.keys(updatePayload).length > 0 && transaction.id) {
        const transactionRef = doc(
          db,
          `users/${userId}/portfolios/${portfolioId}/transactions`,
          transaction.id
        );
        await updateDoc(transactionRef, updatePayload);
      }
      continue;
    }

    const position = transaction.positionId
      ? positionMap.get(transaction.positionId)
      : undefined;

    const market = determineMarketFromContext(
      (position?.market as any) || undefined,
      position?.currency,
      transaction.symbol
    );

    if (transaction.purchaseMethod === 'auto' && !isTradingDay(transaction.date, market)) {
      const adjustedDate = formatMarketDate(adjustToNextTradingDay(transaction.date, market));
      if (adjustedDate !== transaction.date) {
        updatePayload.date = adjustedDate;
        transaction.date = adjustedDate;
      }
    }

    const fxDate = (updatePayload.date as string | undefined) || transaction.date;
    if (resolvedCurrency === 'USD' && fxDate && transaction.exchangeRate === undefined) {
      let fx = fxCache.get(fxDate);
      if (fx === undefined) {
        fx = await getHistoricalExchangeRate(fxDate, 'USD', 'KRW');
        fxCache.set(fxDate, fx ?? null);
      }
      if (fx !== null && Number.isFinite(fx)) {
        updatePayload.exchangeRate = fx;
        transaction.exchangeRate = fx as number;
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const transactionRef = doc(
        db,
        `users/${userId}/portfolios/${portfolioId}/transactions`,
        transaction.id
      );
      await updateDoc(transactionRef, updatePayload);
    }
  }

  transactions.sort((a, b) => {
    if (a.date === b.date) {
      return 0;
    }
    return a.date < b.date ? 1 : -1;
  });
}

function resolveTransactionCurrency(
  transaction: Transaction,
  positionMap: Map<string, Partial<Position>>
): 'USD' | 'KRW' {
  const raw = transaction.currency;
  if (typeof raw === 'string') {
    const upper = raw.toUpperCase();
    if (upper === 'USD' || upper === 'KRW') {
      return upper;
    }
  }

  const position = transaction.positionId
    ? positionMap.get(transaction.positionId)
    : undefined;

  if (position) {
    if (position.currency === 'KRW' || position.currency === 'USD') {
      return position.currency;
    }
    if (position.market === 'KR') {
      return 'KRW';
    }
  }

  if (/^[0-9]/.test(transaction.symbol || '')) {
    return 'KRW';
  }

  return 'USD';
}

/**
 * 거래 생성
 */
export async function createTransaction(
  userId: string,
  portfolioId: string,
  positionId: string,
  transactionData: {
    type: Transaction['type'];
    symbol: string;
    shares: number;
    price: number;
    amount: number;
    date: string;
    fee?: number;
    tax?: number;
    note?: string;
    exchangeRate?: number;
    currency?: string;
    purchaseMethod?: Transaction['purchaseMethod'];
    purchaseUnit?: Transaction['purchaseUnit'];
  }
): Promise<string> {
  try {
    const transactionsRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`
    );
    const transactionRef = doc(transactionsRef);

    const normalizedCurrency =
      transactionData.currency && typeof transactionData.currency === 'string'
        ? transactionData.currency.toUpperCase()
        : undefined;

    const resolvedCurrency: 'USD' | 'KRW' =
      normalizedCurrency === 'KRW' || normalizedCurrency === 'USD'
        ? normalizedCurrency
        : 'USD';

    const transaction: Omit<Transaction, 'id'> = {
      portfolioId,
      positionId,
      stockId: transactionData.symbol,
      type: transactionData.type,
      symbol: transactionData.symbol,
      shares: transactionData.shares,
      price: transactionData.price,
      amount: transactionData.amount,
      fee: transactionData.fee || 0,
      totalAmount: transactionData.amount + (transactionData.fee || 0),
      date: transactionData.date,
      memo: transactionData.note || '',
      purchaseMethod: transactionData.purchaseMethod || 'manual',
      purchaseUnit: transactionData.purchaseUnit || 'shares',
      createdAt: Timestamp.now(),
      currency: resolvedCurrency,
      ...(typeof transactionData.exchangeRate === 'number' && {
        exchangeRate: transactionData.exchangeRate,
      }),
    };

    await setDoc(transactionRef, transaction);
    console.log(`✅ 거래 생성: ${transactionRef.id}`);

    // 포지션 업데이트
    await updatePositionAfterTransaction(userId, portfolioId, positionId, {
      type: transactionData.type,
      shares: transactionData.shares,
      price: transactionData.price,
      date: transactionData.date,
    });

    return transactionRef.id;
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
}

/**
 * 거래 조회
 */
export async function getTransaction(
  userId: string,
  portfolioId: string,
  transactionId: string
): Promise<Transaction | null> {
  try {
    const transactionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`,
      transactionId
    );
    const transactionDoc = await getDoc(transactionRef);

    if (!transactionDoc.exists()) {
      return null;
    }

    return {
      id: transactionDoc.id,
      ...transactionDoc.data(),
    } as Transaction;
  } catch (error) {
    console.error('Error getting transaction:', error);
    return null;
  }
}

/**
 * 포트폴리오의 모든 거래 조회
 */
export async function getPortfolioTransactions(
  userId: string,
  portfolioId: string,
  options?: {
    symbol?: string;
    type?: Transaction['type'];
    limit?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<Transaction[]> {
  try {
    const transactionsRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`
    );

    let q = query(transactionsRef, orderBy('date', 'desc'));

    // 필터 적용
    if (options?.symbol) {
      q = query(q, where('symbol', '==', options.symbol));
    }
    if (options?.type) {
      q = query(q, where('type', '==', options.type));
    }
    if (options?.startDate) {
      q = query(q, where('date', '>=', options.startDate));
    }
    if (options?.endDate) {
      q = query(q, where('date', '<=', options.endDate));
    }
    if (options?.limit) {
      q = query(q, firestoreLimit(options.limit));
    }

    const snapshot = await getDocs(q);

    const transactions: Transaction[] = [];
    snapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data(),
      } as Transaction);
    });

    const positionMap = new Map<string, Partial<Position>>();
    const positionsSnapshot = await getDocs(
      collection(db, `users/${userId}/portfolios/${portfolioId}/positions`)
    );
    positionsSnapshot.forEach((docSnapshot) => {
      positionMap.set(docSnapshot.id, docSnapshot.data() as Partial<Position>);
    });

    await normalizeTransactions(userId, portfolioId, transactions, positionMap);

    return transactions;
  } catch (error) {
    console.error('Error getting portfolio transactions:', error);
    return [];
  }
}

/**
 * 포지션의 모든 거래 조회
 */
export async function getPositionTransactions(
  userId: string,
  portfolioId: string,
  positionId: string
): Promise<Transaction[]> {
  try {
    const transactionsRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`
    );

    const q = query(transactionsRef, where('positionId', '==', positionId));

    const snapshot = await getDocs(q);

    const transactions: Transaction[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Transaction),
    }));

    const positionSnapshot = await getDoc(
      doc(db, `users/${userId}/portfolios/${portfolioId}/positions`, positionId)
    );

    const positionMap = new Map<string, Partial<Position>>();
    if (positionSnapshot.exists()) {
      positionMap.set(positionId, positionSnapshot.data() as Partial<Position>);
    }

    await normalizeTransactions(userId, portfolioId, transactions, positionMap);

    return transactions;
  } catch (error) {
    console.error('Error getting position transactions:', error);
    return [];
  }
}

/**
 * 거래 삭제
 */
export async function deleteTransaction(
  userId: string,
  portfolioId: string,
  transactionId: string
): Promise<void> {
  try {
    const transactionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`,
      transactionId
    );

    const transactionSnapshot = await getDoc(transactionRef);
    if (!transactionSnapshot.exists()) {
      console.warn(`⚠️ 거래가 존재하지 않아 삭제할 수 없습니다: ${transactionId}`);
      return;
    }

    const transactionData = transactionSnapshot.data() as Transaction;
    const positionId = transactionData.positionId;

    await deleteDoc(transactionRef);
    console.log(`✅ 거래 삭제: ${transactionId}`);

    if (positionId) {
      await recalculatePositionFromTransactions(userId, portfolioId, positionId);
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
}

/**
 * 거래 통계 계산
 */
export async function calculateTransactionStats(
  userId: string,
  portfolioId: string,
  period?: {
    startDate: string;
    endDate: string;
  }
): Promise<{
  transactionCount: number;
  byCurrency: {
    USD: {
      totalBuys: number;
      totalSells: number;
      totalBuyAmount: number;
      totalSellAmount: number;
      averageBuyPrice: number;
      averageSellPrice: number;
    };
    KRW: {
      totalBuys: number;
      totalSells: number;
      totalBuyAmount: number;
      totalSellAmount: number;
      averageBuyPrice: number;
      averageSellPrice: number;
    };
  };
  combined: {
    baseCurrency: SupportedCurrency;
    totalBuyAmount: number;
    totalSellAmount: number;
    netAmount: number;
  };
  converted: Record<SupportedCurrency, {
    totalBuyAmount: number;
    totalSellAmount: number;
    netAmount: number;
  }>;
  exchangeRate: {
    base: 'USD';
    quote: 'KRW';
    rate: number;
    source: 'cache' | 'live' | 'fallback';
  };
}> {
  try {
    const options = period
      ? { startDate: period.startDate, endDate: period.endDate }
      : undefined;

    const transactions = await getPortfolioTransactions(userId, portfolioId, options);

    const positionMap = new Map<string, Partial<Position>>();
    const positionsSnapshot = await getDocs(
      collection(db, `users/${userId}/portfolios/${portfolioId}/positions`)
    );
    positionsSnapshot.forEach((docSnapshot) => {
      positionMap.set(docSnapshot.id, docSnapshot.data() as Partial<Position>);
    });

    const byCurrencyTemplate = {
      totalBuys: 0,
      totalSells: 0,
      totalBuyAmount: 0,
      totalSellAmount: 0,
    };

    const mutableStats: Record<SupportedCurrency, {
      totalBuys: number;
      totalSells: number;
      totalBuyAmount: number;
      totalSellAmount: number;
    }> = {
      USD: { ...byCurrencyTemplate },
      KRW: { ...byCurrencyTemplate },
    };

    transactions.forEach((transaction) => {
      const currency = resolveTransactionCurrency(transaction, positionMap);
      if (transaction.type === 'buy') {
        mutableStats[currency].totalBuyAmount += transaction.amount;
        mutableStats[currency].totalBuys += transaction.shares;
      } else if (transaction.type === 'sell') {
        mutableStats[currency].totalSellAmount += transaction.amount;
        mutableStats[currency].totalSells += transaction.shares;
      }
    });

    const finalize = (currency: 'USD' | 'KRW') => {
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
      mutableStats.USD.totalBuyAmount + convertWithRate(mutableStats.KRW.totalBuyAmount, 'KRW', 'USD', rate);
    const totalSellUsd =
      mutableStats.USD.totalSellAmount + convertWithRate(mutableStats.KRW.totalSellAmount, 'KRW', 'USD', rate);

    const totalBuyKrw =
      mutableStats.KRW.totalBuyAmount + convertWithRate(mutableStats.USD.totalBuyAmount, 'USD', 'KRW', rate);
    const totalSellKrw =
      mutableStats.KRW.totalSellAmount + convertWithRate(mutableStats.USD.totalSellAmount, 'USD', 'KRW', rate);

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
  } catch (error) {
    console.error('Error calculating transaction stats:', error);
    return {
      transactionCount: 0,
      byCurrency: {
        USD: {
          totalBuys: 0,
          totalSells: 0,
          totalBuyAmount: 0,
          totalSellAmount: 0,
          averageBuyPrice: 0,
          averageSellPrice: 0,
        },
        KRW: {
          totalBuys: 0,
          totalSells: 0,
          totalBuyAmount: 0,
          totalSellAmount: 0,
          averageBuyPrice: 0,
          averageSellPrice: 0,
        },
      },
      combined: {
        baseCurrency: 'USD',
        totalBuyAmount: 0,
        totalSellAmount: 0,
        netAmount: 0,
      },
      converted: {
        USD: { totalBuyAmount: 0, totalSellAmount: 0, netAmount: 0 },
        KRW: { totalBuyAmount: 0, totalSellAmount: 0, netAmount: 0 },
      },
      exchangeRate: {
        base: 'USD',
        quote: 'KRW',
        rate: 0,
        source: 'fallback',
      },
    };
  }
}

