/**
 * 자동 투자 관련 서비스
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createTransaction } from './transaction';
import { recalculatePositionFromTransactions } from './position';
import type { AutoInvestFrequency, AutoInvestSchedule, Position, Transaction } from '@/types';

/**
 * 자동 투자 거래 내역 생성
 * 시작일부터 오늘까지 정기적으로 구매한 거래 내역을 자동 생성
 */
export async function generateAutoInvestTransactions(
  userId: string,
  portfolioId: string,
  positionId: string,
  config: {
    symbol: string;
    stockId: string;
    frequency: AutoInvestFrequency;
    amount: number;
    startDate: string; // YYYY-MM-DD
    pricePerShare: number; // 평균 가격 또는 시작일 가격
    currency: 'USD' | 'KRW';
  }
): Promise<{ count: number; totalShares: number; totalAmount: number }> {
  try {
    const startDate = new Date(config.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const transactions: Array<{
      date: string;
      shares: number;
      price: number;
      amount: number;
    }> = [];

    const currentDate = new Date(startDate);

    // 빈도에 따라 거래 날짜 계산
    while (currentDate <= today) {
      const dateString = currentDate.toISOString().split('T')[0];
      const shares = config.amount / config.pricePerShare;

      transactions.push({
        date: dateString,
        shares,
        price: config.pricePerShare,
        amount: config.amount,
      });

      // 다음 거래 날짜 계산
      switch (config.frequency) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'quarterly':
          currentDate.setMonth(currentDate.getMonth() + 3);
          break;
      }
    }

    console.log(`📊 자동 투자 거래 내역 생성: ${transactions.length}건`);

    // 거래 내역 저장
    let totalShares = 0;
    let totalAmount = 0;

    for (const tx of transactions) {
      await createTransaction(userId, portfolioId, positionId, {
        type: 'buy',
        symbol: config.symbol,
        shares: tx.shares,
        price: tx.price,
        amount: tx.amount,
        date: tx.date,
        note: `자동 투자 (${config.frequency})`,
        currency: config.currency,
        purchaseMethod: 'auto',
        purchaseUnit: 'amount',
      });

      totalShares += tx.shares;
      totalAmount += tx.amount;
    }

    const totalAmountDisplay =
      config.currency === 'KRW'
        ? `${Math.round(totalAmount).toLocaleString('ko-KR')}원`
        : `$${totalAmount.toFixed(2)}`;

    console.log(
      `✅ 자동 투자 거래 내역 생성 완료: ${transactions.length}건, 총 ${totalShares.toFixed(4)}주, 총 ${totalAmountDisplay}`
    );

    return {
      count: transactions.length,
      totalShares,
      totalAmount,
    };
  } catch (error) {
    console.error('Error generating auto invest transactions:', error);
    throw error;
  }
}

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export async function listAutoInvestSchedules(
  userId: string,
  portfolioId: string,
  positionId: string
): Promise<AutoInvestSchedule[]> {
  try {
    const schedulesRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions/${positionId}/autoInvestSchedules`
    );

    const snapshot = await getDocs(query(schedulesRef, orderBy('effectiveFrom', 'desc')));

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as AutoInvestSchedule),
    }));
  } catch (error) {
    console.error('Error listing auto invest schedules:', error);
    throw error;
  }
}

export async function createAutoInvestSchedule(
  userId: string,
  portfolioId: string,
  positionId: string,
  schedule: {
    frequency: AutoInvestFrequency;
    amount: number;
    currency: 'USD' | 'KRW';
    effectiveFrom: string;
    createdBy: string;
    note?: string;
  }
): Promise<string> {
  try {
    const schedulesRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions/${positionId}/autoInvestSchedules`
    );
    const scheduleRef = doc(schedulesRef);
    const batch = writeBatch(db);
    const now = Timestamp.now();

    const previousSnapshot = await getDocs(
      query(schedulesRef, orderBy('effectiveFrom', 'desc'), limit(1))
    );

    if (!previousSnapshot.empty) {
      const previousDoc = previousSnapshot.docs[0];
      const previousData = previousDoc.data() as AutoInvestSchedule;
      const prevEffectiveTo = previousData.effectiveTo;

      if (!prevEffectiveTo || prevEffectiveTo >= schedule.effectiveFrom) {
        const prevEndDate = new Date(schedule.effectiveFrom);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        batch.update(previousDoc.ref, {
          effectiveTo: formatDate(prevEndDate),
          updatedAt: now,
        });
      }
    }

    batch.set(scheduleRef, {
      userId,
      portfolioId,
      positionId,
      frequency: schedule.frequency,
      amount: schedule.amount,
      currency: schedule.currency,
      effectiveFrom: schedule.effectiveFrom,
      effectiveTo: null,
      note: schedule.note || '',
      createdBy: schedule.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    const positionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions`,
      positionId
    );
    const positionSnapshot = await getDoc(positionRef);
    const existingConfig = positionSnapshot.exists()
      ? ((positionSnapshot.data() as Position).autoInvestConfig ?? null)
      : null;

    batch.set(
      positionRef,
      {
        autoInvestConfig: {
          frequency: schedule.frequency,
          amount: schedule.amount,
          startDate: existingConfig?.startDate || schedule.effectiveFrom,
          isActive: existingConfig?.isActive ?? true,
          lastExecuted: existingConfig?.lastExecuted,
          currentScheduleId: scheduleRef.id,
          lastUpdated: schedule.effectiveFrom,
        },
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();
    return scheduleRef.id;
  } catch (error) {
    console.error('Error creating auto invest schedule:', error);
    throw error;
  }
}

export async function rewriteAutoInvestTransactions(
  userId: string,
  portfolioId: string,
  positionId: string,
  options: {
    effectiveFrom: string;
    frequency: AutoInvestFrequency;
    amount: number;
    currency: 'USD' | 'KRW';
    pricePerShare: number;
    symbol: string;
    stockId: string;
  }
): Promise<{ removed: number; created: number }> {
  try {
    const transactionsRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`
    );

    const autoTransactionsSnapshot = await getDocs(
      query(
        transactionsRef,
        where('positionId', '==', positionId),
        where('purchaseMethod', '==', 'auto')
      )
    );

    const toDelete = autoTransactionsSnapshot.docs.filter((doc) => {
      const data = doc.data() as Transaction;
      return data.date >= options.effectiveFrom;
    });

    if (toDelete.length > 0) {
      const deleteBatch = writeBatch(db);
      toDelete.forEach((docRef) => deleteBatch.delete(docRef.ref));
      await deleteBatch.commit();
    }

    const generationResult = await generateAutoInvestTransactions(userId, portfolioId, positionId, {
      symbol: options.symbol,
      stockId: options.stockId,
      frequency: options.frequency,
      amount: options.amount,
      startDate: options.effectiveFrom,
      pricePerShare: options.pricePerShare,
      currency: options.currency,
    });

    await recalculatePositionFromTransactions(userId, portfolioId, positionId);

    return {
      removed: toDelete.length,
      created: generationResult.count,
    };
  } catch (error) {
    console.error('Error rewriting auto invest transactions:', error);
    throw error;
  }
}

/**
 * 정기 구매 날짜 목록 생성 (미리보기용)
 */
export function getAutoInvestDates(
  startDate: string,
  frequency: AutoInvestFrequency,
  endDate?: string
): string[] {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(0, 0, 0, 0);

  const dates: string[] = [];
  const currentDate = new Date(start);

  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split('T')[0]);

    switch (frequency) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'quarterly':
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
    }
  }

    return dates;
}

