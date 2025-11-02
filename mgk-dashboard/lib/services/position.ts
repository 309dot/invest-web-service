/**
 * 포지션 관리 서비스
 * 
 * 포트폴리오 내 종목별 포지션을 생성, 조회, 수정, 삭제하는 서비스
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
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Position, Stock, Transaction } from '@/types';

const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const FLOAT_TOLERANCE = 1e-6;

function metricsNeedUpdate(
  existing: Position,
  calculated: {
    shares: number;
    averagePrice: number;
    totalInvested: number;
    currentPrice: number;
    totalValue: number;
    returnRate: number;
    profitLoss: number;
    transactionCount: number;
  }
): boolean {
  const conditions = [
    Math.abs((existing.shares ?? 0) - calculated.shares) > FLOAT_TOLERANCE,
    Math.abs((existing.averagePrice ?? 0) - calculated.averagePrice) > FLOAT_TOLERANCE,
    Math.abs((existing.totalInvested ?? 0) - calculated.totalInvested) > FLOAT_TOLERANCE,
    Math.abs((existing.totalValue ?? 0) - calculated.totalValue) > FLOAT_TOLERANCE,
    (existing.transactionCount ?? 0) !== calculated.transactionCount,
  ];

  return conditions.some(Boolean);
}

function aggregatePositionMetrics(
  transactions: Transaction[],
  existingPosition: Position | null
) {
  if (transactions.length === 0) {
    return {
      shares: 0,
      averagePrice: 0,
      totalInvested: 0,
      currentPrice: existingPosition?.currentPrice ?? 0,
      totalValue: 0,
      returnRate: 0,
      profitLoss: 0,
      transactionCount: 0,
      firstPurchaseDate:
        existingPosition?.firstPurchaseDate || formatDateString(new Date()),
      lastTransactionDate:
        existingPosition?.lastTransactionDate ||
        existingPosition?.firstPurchaseDate ||
        formatDateString(new Date()),
    };
  }

  let shares = 0;
  let totalInvested = 0;
  let averagePrice = existingPosition?.averagePrice ?? 0;
  let currentPrice = existingPosition?.currentPrice ?? 0;
  let firstPurchaseDate: string | null = null;
  let lastTransactionDate: string | null = null;

  transactions.forEach((tx) => {
    const price = tx.price || 0;
    const quantity = tx.shares || 0;

    if (tx.type === 'buy') {
      const cost = quantity * price;
      totalInvested += cost;
      shares += quantity;
      averagePrice = shares > 0 ? totalInvested / shares : 0;
    } else if (tx.type === 'sell') {
      shares -= quantity;
      if (shares < 0) {
        shares = 0;
      }
      const costBasis = averagePrice * quantity;
      totalInvested = Math.max(0, totalInvested - costBasis);
      if (shares === 0) {
        averagePrice = 0;
      }
    }

    currentPrice = price;
    if (!firstPurchaseDate) {
      firstPurchaseDate = tx.date;
    }
    lastTransactionDate = tx.date;
  });

  const totalValue = shares * currentPrice;
  const returnRate = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
  const profitLoss = totalValue - totalInvested;

  return {
    shares,
    averagePrice,
    totalInvested,
    currentPrice,
    totalValue,
    returnRate,
    profitLoss,
    transactionCount: transactions.length,
    firstPurchaseDate: firstPurchaseDate || existingPosition?.firstPurchaseDate || formatDateString(new Date()),
    lastTransactionDate:
      lastTransactionDate ||
      firstPurchaseDate ||
      existingPosition?.lastTransactionDate ||
      formatDateString(new Date()),
  } as const;
}

/**
 * 포지션 생성
 */
export async function createPosition(
  userId: string,
  portfolioId: string,
  stock: Omit<Stock, 'id'>,
  initialData: {
    purchaseMethod: Position['purchaseMethod'];
    shares?: number;
    averagePrice?: number;
    totalInvested?: number;
    autoInvestConfig?: Position['autoInvestConfig'];
    firstPurchaseDate?: string;
  }
): Promise<string> {
  try {
    const positionId = `${portfolioId}_${stock.symbol}`;
    const positionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions`,
      positionId
    );

    // 현재 주가는 나중에 API로 가져올 수 있음
    const currentPrice = initialData.averagePrice || 0;
    const shares = initialData.shares || 0;
    const totalInvested = initialData.totalInvested || shares * currentPrice;
    const totalValue = shares * currentPrice;
    const returnRate =
      totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
    const profitLoss = totalValue - totalInvested;

    // Position 데이터 생성 (undefined 필드 제외)
    const position: Omit<Position, 'id'> = {
      portfolioId,
      stockId: stock.symbol,
      symbol: stock.symbol,
      name: stock.name,
      market: stock.market,
      exchange: stock.exchange || '',
      assetType: stock.assetType,
      sector: stock.sector || '미분류',
      currency: stock.currency,
      shares: shares,
      averagePrice: initialData.averagePrice || 0,
      totalInvested,
      currentPrice,
      totalValue,
      returnRate,
      profitLoss,
      purchaseMethod: initialData.purchaseMethod,
      ...(initialData.autoInvestConfig && { autoInvestConfig: initialData.autoInvestConfig }), // undefined 방지
      firstPurchaseDate: initialData.firstPurchaseDate || new Date().toISOString().split('T')[0],
      lastTransactionDate: initialData.firstPurchaseDate || new Date().toISOString().split('T')[0],
      transactionCount: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(positionRef, position);
    console.log(`✅ 포지션 생성: ${positionId}`);

    return positionId;
  } catch (error) {
    console.error('Error creating position:', error);
    throw error;
  }
}

/**
 * 포지션 조회
 */
export async function getPosition(
  userId: string,
  portfolioId: string,
  positionId: string
): Promise<Position | null> {
  try {
    const positionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions`,
      positionId
    );
    const positionDoc = await getDoc(positionRef);

    if (!positionDoc.exists()) {
      return null;
    }

    return {
      id: positionDoc.id,
      ...positionDoc.data(),
    } as Position;
  } catch (error) {
    console.error('Error getting position:', error);
    return null;
  }
}

/**
 * 포트폴리오의 모든 포지션 조회
 */
export async function getPortfolioPositions(
  userId: string,
  portfolioId: string
): Promise<Position[]> {
  try {
    const positionsRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions`
    );
    const q = query(positionsRef, orderBy('totalValue', 'desc'));
    const snapshot = await getDocs(q);

    const positions: Position[] = [];

    for (const docSnapshot of snapshot.docs) {
      const positionData = {
        id: docSnapshot.id,
        ...docSnapshot.data(),
      } as Position;

      const transactionsRef = collection(
        db,
        `users/${userId}/portfolios/${portfolioId}/transactions`
      );
      const transactionsSnapshot = await getDocs(
        query(
          transactionsRef,
          where('positionId', '==', docSnapshot.id),
          orderBy('date', 'asc')
        )
      );

      const transactions: Transaction[] = [];
      transactionsSnapshot.forEach((txDoc) => {
        transactions.push({
          id: txDoc.id,
          ...txDoc.data(),
        } as Transaction);
      });

      const metrics = aggregatePositionMetrics(transactions, positionData);

      if (positionData && metricsNeedUpdate(positionData, metrics)) {
        const positionRef = doc(
          db,
          `users/${userId}/portfolios/${portfolioId}/positions`,
          docSnapshot.id
        );

        await setDoc(
          positionRef,
          {
            shares: metrics.shares,
            averagePrice: metrics.averagePrice,
            totalInvested: metrics.totalInvested,
            currentPrice: metrics.currentPrice,
            totalValue: metrics.totalValue,
            returnRate: metrics.returnRate,
            profitLoss: metrics.profitLoss,
            transactionCount: metrics.transactionCount,
            firstPurchaseDate: metrics.firstPurchaseDate,
            lastTransactionDate: metrics.lastTransactionDate,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );

        positions.push({
          ...positionData,
          ...metrics,
        });
      } else {
        positions.push({
          ...positionData,
          ...metrics,
        });
      }
    }

    return positions;
  } catch (error) {
    console.error('Error getting portfolio positions:', error);
    return [];
  }
}

/**
 * 특정 종목의 포지션 찾기
 */
export async function findPositionBySymbol(
  userId: string,
  portfolioId: string,
  symbol: string
): Promise<Position | null> {
  try {
    const positionsRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions`
    );
    const q = query(positionsRef, where('symbol', '==', symbol));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Position;
  } catch (error) {
    console.error('Error finding position by symbol:', error);
    return null;
  }
}

/**
 * 평균 매수가 계산
 */
export function calculateAveragePrice(
  currentShares: number,
  currentAveragePrice: number,
  newShares: number,
  newPrice: number
): number {
  const totalShares = currentShares + newShares;
  if (totalShares === 0) return 0;

  const currentValue = currentShares * currentAveragePrice;
  const newValue = newShares * newPrice;
  return (currentValue + newValue) / totalShares;
}

/**
 * 수익률 계산
 */
export function calculateReturnRate(
  currentPrice: number,
  averagePrice: number
): number {
  if (averagePrice === 0) return 0;
  return ((currentPrice - averagePrice) / averagePrice) * 100;
}

/**
 * 포지션 업데이트 (거래 후)
 */
export async function updatePositionAfterTransaction(
  userId: string,
  portfolioId: string,
  positionId: string,
  transaction: {
    type: Transaction['type'];
    shares: number;
    price: number;
    date: string;
  }
): Promise<void> {
  try {
    const existingPosition = await getPosition(userId, portfolioId, positionId);
    if (!existingPosition) {
      throw new Error('Position not found');
    }

    await recalculatePositionFromTransactions(userId, portfolioId, positionId);

    console.log(`✅ 포지션 재계산 업데이트: ${positionId}`);
  } catch (error) {
    console.error('Error updating position after transaction:', error);
    throw error;
  }
}

export async function recalculatePositionFromTransactions(
  userId: string,
  portfolioId: string,
  positionId: string
): Promise<void> {
  try {
    const positionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions`,
      positionId
    );
    const positionSnapshot = await getDoc(positionRef);
    const existingPosition = positionSnapshot.exists()
      ? (positionSnapshot.data() as Position)
      : null;

    const transactionsRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`
    );
    const transactionsSnapshot = await getDocs(
      query(transactionsRef, where('positionId', '==', positionId), orderBy('date', 'asc'))
    );

    const transactions: Transaction[] = [];
    transactionsSnapshot.forEach((docSnapshot) => {
      transactions.push({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      } as Transaction);
    });

    const metrics = aggregatePositionMetrics(transactions, existingPosition);

    await setDoc(
      positionRef,
      {
        shares: metrics.shares,
        averagePrice: metrics.averagePrice,
        totalInvested: metrics.totalInvested,
        currentPrice: metrics.currentPrice,
        totalValue: metrics.totalValue,
        returnRate: metrics.returnRate,
        profitLoss: metrics.profitLoss,
        transactionCount: metrics.transactionCount,
        firstPurchaseDate: metrics.firstPurchaseDate,
        lastTransactionDate: metrics.lastTransactionDate,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error recalculating position from transactions:', error);
    throw error;
  }
}

/**
 * 포지션 삭제
 */
export async function deletePosition(
  userId: string,
  portfolioId: string,
  positionId: string
): Promise<{ deletedTransactions: number }>
{
  try {
    const positionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions`,
      positionId
    );

    const transactionsRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`
    );
    const transactionsQuery = query(transactionsRef, where('positionId', '==', positionId));
    const transactionsSnapshot = await getDocs(transactionsQuery);

    const batch = writeBatch(db);
    let deletedTransactions = 0;

    transactionsSnapshot.forEach((transactionDoc) => {
      batch.delete(transactionDoc.ref);
      deletedTransactions += 1;
    });

    batch.delete(positionRef);

    await batch.commit();

    console.log(`✅ 포지션 삭제: ${positionId} (거래 ${deletedTransactions}건 포함)`);

    return { deletedTransactions };
  } catch (error) {
    console.error('Error deleting position:', error);
    throw error;
  }
}

/**
 * 현재 주가로 모든 포지션 업데이트
 */
export async function updatePositionPrices(
  userId: string,
  portfolioId: string,
  priceData: Map<string, number> // symbol -> currentPrice
): Promise<void> {
  try {
    const positions = await getPortfolioPositions(userId, portfolioId);
    const batch = writeBatch(db);

    for (const position of positions) {
      const currentPrice = priceData.get(position.symbol);
      if (!currentPrice) continue;

      const newTotalValue = position.shares * currentPrice;
      const newReturnRate = calculateReturnRate(currentPrice, position.averagePrice);
      const newProfitLoss = newTotalValue - position.totalInvested;

      const positionRef = doc(
        db,
        `users/${userId}/portfolios/${portfolioId}/positions`,
        position.id!
      );

      batch.update(positionRef, {
        currentPrice,
        totalValue: newTotalValue,
        returnRate: newReturnRate,
        profitLoss: newProfitLoss,
        updatedAt: Timestamp.now(),
      });
    }

    await batch.commit();
    console.log(`✅ ${positions.length}개 포지션 주가 업데이트`);
  } catch (error) {
    console.error('Error updating position prices:', error);
    throw error;
  }
}

/**
 * 포트폴리오 총계 계산
 */
export async function calculatePortfolioTotals(
  userId: string,
  portfolioId: string
): Promise<{
  totalInvested: number;
  totalValue: number;
  returnRate: number;
}> {
  try {
    const positions = await getPortfolioPositions(userId, portfolioId);

    const totalInvested = positions.reduce((sum, p) => sum + p.totalInvested, 0);
    const totalValue = positions.reduce((sum, p) => sum + p.totalValue, 0);
    const returnRate =
      totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalValue,
      returnRate,
    };
  } catch (error) {
    console.error('Error calculating portfolio totals:', error);
    return {
      totalInvested: 0,
      totalValue: 0,
      returnRate: 0,
    };
  }
}

