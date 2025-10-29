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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction } from '@/types';
import { updatePositionAfterTransaction } from './position';

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
  }
): Promise<string> {
  try {
    const transactionsRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`
    );
    const transactionRef = doc(transactionsRef);

    const transaction: Omit<Transaction, 'id'> = {
      positionId,
      type: transactionData.type,
      symbol: transactionData.symbol,
      shares: transactionData.shares,
      price: transactionData.price,
      amount: transactionData.amount,
      fee: transactionData.fee || 0,
      tax: transactionData.tax || 0,
      totalCost: transactionData.amount + (transactionData.fee || 0) + (transactionData.tax || 0),
      date: transactionData.date,
      note: transactionData.note || '',
      exchangeRate: transactionData.exchangeRate,
      createdAt: Timestamp.now(),
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

    const q = query(
      transactionsRef,
      where('positionId', '==', positionId),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);

    const transactions: Transaction[] = [];
    snapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data(),
      } as Transaction);
    });

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

    await deleteDoc(transactionRef);
    console.log(`✅ 거래 삭제: ${transactionId}`);

    // TODO: 거래 삭제 시 포지션 재계산 필요
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
  totalBuys: number;
  totalSells: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  averageBuyPrice: number;
  averageSellPrice: number;
  transactionCount: number;
}> {
  try {
    const options = period
      ? { startDate: period.startDate, endDate: period.endDate }
      : undefined;

    const transactions = await getPortfolioTransactions(userId, portfolioId, options);

    const buys = transactions.filter((t) => t.type === 'buy');
    const sells = transactions.filter((t) => t.type === 'sell');

    const totalBuyAmount = buys.reduce((sum, t) => sum + t.amount, 0);
    const totalSellAmount = sells.reduce((sum, t) => sum + t.amount, 0);
    const totalBuys = buys.reduce((sum, t) => sum + t.shares, 0);
    const totalSells = sells.reduce((sum, t) => sum + t.shares, 0);

    const averageBuyPrice = totalBuys > 0 ? totalBuyAmount / totalBuys : 0;
    const averageSellPrice = totalSells > 0 ? totalSellAmount / totalSells : 0;

    return {
      totalBuys,
      totalSells,
      totalBuyAmount,
      totalSellAmount,
      averageBuyPrice,
      averageSellPrice,
      transactionCount: transactions.length,
    };
  } catch (error) {
    console.error('Error calculating transaction stats:', error);
    return {
      totalBuys: 0,
      totalSells: 0,
      totalBuyAmount: 0,
      totalSellAmount: 0,
      averageBuyPrice: 0,
      averageSellPrice: 0,
      transactionCount: 0,
    };
  }
}

