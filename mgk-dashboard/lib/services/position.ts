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

    const position: Omit<Position, 'id'> = {
      portfolioId,
      stockId: stock.symbol,
      symbol: stock.symbol,
      shares: shares,
      averagePrice: initialData.averagePrice || 0,
      totalInvested,
      currentPrice,
      totalValue,
      returnRate,
      profitLoss,
      purchaseMethod: initialData.purchaseMethod,
      autoInvestConfig: initialData.autoInvestConfig,
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
    snapshot.forEach((doc) => {
      positions.push({
        id: doc.id,
        ...doc.data(),
      } as Position);
    });

    return positions;
  } catch (error) {
    console.error('Error getting portfolio positions:', error);
    return [];
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
    const position = await getPosition(userId, portfolioId, positionId);
    if (!position) {
      throw new Error('Position not found');
    }

    let newShares = position.shares;
    let newAveragePrice = position.averagePrice;
    let newTotalInvested = position.totalInvested;

    if (transaction.type === 'buy') {
      // 매수
      newAveragePrice = calculateAveragePrice(
        position.shares,
        position.averagePrice,
        transaction.shares,
        transaction.price
      );
      newShares = position.shares + transaction.shares;
      newTotalInvested = position.totalInvested + transaction.shares * transaction.price;
    } else if (transaction.type === 'sell') {
      // 매도
      newShares = position.shares - transaction.shares;
      if (newShares < 0) {
        throw new Error('Cannot sell more shares than owned');
      }
      // 평균 매수가는 그대로 유지
      newTotalInvested = newShares * position.averagePrice;
    }

    const currentPrice = transaction.price; // 실제로는 API에서 가져와야 함
    const newTotalValue = newShares * currentPrice;
    const newReturnRate = calculateReturnRate(currentPrice, newAveragePrice);
    const newProfitLoss = newTotalValue - newTotalInvested;

    const positionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions`,
      positionId
    );

    await setDoc(
      positionRef,
      {
        shares: newShares,
        averagePrice: newAveragePrice,
        totalInvested: newTotalInvested,
        currentPrice,
        totalValue: newTotalValue,
        returnRate: newReturnRate,
        profitLoss: newProfitLoss,
        lastTransactionDate: transaction.date,
        transactionCount: position.transactionCount + 1,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    console.log(`✅ 포지션 업데이트: ${positionId}`);
  } catch (error) {
    console.error('Error updating position after transaction:', error);
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
): Promise<void> {
  try {
    const positionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions`,
      positionId
    );

    await deleteDoc(positionRef);
    console.log(`✅ 포지션 삭제: ${positionId}`);
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

