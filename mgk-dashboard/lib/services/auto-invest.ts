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
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createTransaction } from './transaction';
import { InsufficientBalanceError } from './balance';
import { recalculatePositionFromTransactions } from './position';
import type { AutoInvestFrequency, AutoInvestSchedule, Position, Transaction } from '@/types';
import { getHistoricalPrice, getHistoricalExchangeRate } from '@/lib/apis/alphavantage';
import {
  adjustToNextTradingDay,
  advanceByFrequency,
  determineMarketFromContext,
  formatDate,
  getMarketToday,
  isFutureTradingDate,
  parseISODate,
} from '@/lib/utils/tradingCalendar';

function computeScheduledTradingDates(
  startDate: string,
  frequency: AutoInvestFrequency,
  market: 'US' | 'KR' | 'GLOBAL',
  endBoundary: Date
): string[] {
  const purchaseDates: string[] = [];
  const seen = new Set<string>();
  let pointer = parseISODate(startDate);
  let guard = 0;

  while (pointer <= endBoundary && guard < 5000) {
    const tradingDate = adjustToNextTradingDay(pointer, market);
    if (tradingDate > endBoundary) {
      break;
    }

    const dateString = formatDate(tradingDate);
    if (!seen.has(dateString)) {
      seen.add(dateString);
      purchaseDates.push(dateString);
    }

    pointer = advanceByFrequency(pointer, frequency);
    guard += 1;
  }

  return purchaseDates;
}

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
    pricePerShare?: number; // fallback price when historical lookup fails
    currency: 'USD' | 'KRW';
    market?: 'US' | 'KR' | 'GLOBAL';
  }
): Promise<{ count: number; totalShares: number; totalAmount: number }> {
  try {
    const market = determineMarketFromContext(config.market, config.currency, config.symbol);
    const today = getMarketToday(market);

    const purchaseDates = computeScheduledTradingDates(
      config.startDate,
      config.frequency,
      market,
      today
    );

    console.log(`📊 자동 투자 거래 내역 생성: ${purchaseDates.length}건 (시장: ${market})`);

    // 거래 내역 저장
    let totalShares = 0;
    let totalAmount = 0;
    let createdCount = 0;
    const exchangeRateCache = new Map<string, number>();
    const transactionsRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`
    );
    const existingAutoTransactions = await getDocs(
      query(
        transactionsRef,
        where('positionId', '==', positionId),
        where('purchaseMethod', '==', 'auto')
      )
    );
    const existingKeys = new Set<string>();
    existingAutoTransactions.forEach((docSnapshot) => {
      const data = docSnapshot.data() as Transaction;
      if (data.date) {
        existingKeys.add(`${data.date}:${data.amount}`);
      }
    });

    for (const targetDate of purchaseDates) {
      if (isFutureTradingDate(targetDate, market)) {
        continue;
      }

      if (existingKeys.has(`${targetDate}:${config.amount}`)) {
        continue;
      }

      let unitPrice: number | null = null;
      try {
        unitPrice = await getHistoricalPrice(
          config.symbol,
          targetDate,
          'auto',
          market
        );
      } catch (error) {
        console.warn(
          `⚠️ ${config.symbol} ${targetDate} 시세 조회 실패, 폴백 가격 사용 예정`,
          error
        );
      }

      if (!unitPrice || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        if (config.pricePerShare && Number.isFinite(config.pricePerShare) && config.pricePerShare > 0) {
          unitPrice = config.pricePerShare;
          console.warn(
            `⚠️ ${targetDate} 가격 조회 실패 → fallback 가격 ${unitPrice.toFixed(2)} 적용 (${config.symbol})`
          );
        } else {
          console.warn(
            `⚠️ ${targetDate} 가격과 fallback 가격이 없어 자동 투자 거래를 건너뜁니다. (${config.symbol})`
          );
          continue;
        }
      }

      const shares = Number((config.amount / unitPrice).toFixed(6));

      let exchangeRate: number | undefined;
      if (config.currency === 'USD') {
        if (exchangeRateCache.has(targetDate)) {
          exchangeRate = exchangeRateCache.get(targetDate);
        } else {
          const fx = await getHistoricalExchangeRate(targetDate, 'USD', 'KRW');
          if (fx !== null && Number.isFinite(fx)) {
            exchangeRateCache.set(targetDate, fx);
            exchangeRate = fx;
          }
        }
      }

      try {
        await createTransaction(userId, portfolioId, positionId, {
          type: 'buy',
          symbol: config.symbol,
          shares,
          price: unitPrice,
          amount: config.amount,
          date: targetDate,
          note: `자동 투자 (${config.frequency})`,
          currency: config.currency,
          purchaseMethod: 'auto',
          purchaseUnit: 'amount',
          exchangeRate,
          executedAt: new Date().toISOString(),
          scheduledDate: targetDate,
          status: 'completed',
        });

        totalShares += shares;
        totalAmount += config.amount;
        createdCount += 1;
        existingKeys.add(`${targetDate}:${config.amount}`);
      } catch (error) {
        if (error instanceof InsufficientBalanceError) {
          console.warn(
            `⚠️ 자동 투자 잔액 부족으로 건너뜁니다: ${config.symbol} ${targetDate} (${config.amount} ${config.currency})`
          );
          continue;
        }
        throw error;
      }
    }

    const totalAmountDisplay =
      config.currency === 'KRW'
        ? `${Math.round(totalAmount).toLocaleString('ko-KR')}원`
        : `$${totalAmount.toFixed(2)}`;

    console.log(
      `✅ 자동 투자 거래 내역 생성 완료: ${createdCount}/${purchaseDates.length}건, 총 ${totalShares.toFixed(4)}주, 총 ${totalAmountDisplay}`
    );

    return {
      count: createdCount,
      totalShares,
      totalAmount,
    };
  } catch (error) {
    console.error('Error generating auto invest transactions:', error);
    throw error;
  }
}

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

    const sanitizedConfig: Record<string, unknown> = {
      frequency: schedule.frequency,
      amount: schedule.amount,
      startDate: existingConfig?.startDate || schedule.effectiveFrom,
      isActive: existingConfig?.isActive ?? true,
      currentScheduleId: scheduleRef.id,
      lastUpdated: schedule.effectiveFrom,
    };

    if (existingConfig?.lastExecuted) {
      sanitizedConfig.lastExecuted = existingConfig.lastExecuted;
    }

    batch.set(
      positionRef,
      {
        autoInvestConfig: sanitizedConfig,
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
    pricePerShare?: number;
    symbol: string;
    stockId: string;
    market?: 'US' | 'KR' | 'GLOBAL';
  }
): Promise<{ removed: number; created: number; error?: string }> {
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
      market: options.market,
    });

    await recalculatePositionFromTransactions(userId, portfolioId, positionId);

    return {
      removed: toDelete.length,
      created: generationResult.count,
    };
  } catch (error) {
    console.error('Error rewriting auto invest transactions:', error);
    return {
      removed: 0,
      created: 0,
      error: error instanceof Error ? error.message : '자동 투자 거래 재생성 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 정기 구매 날짜 목록 생성 (미리보기용)
 */
export function getAutoInvestDates(
  startDate: string,
  frequency: AutoInvestFrequency,
  endDate?: string,
  market: 'US' | 'KR' | 'GLOBAL' = 'US'
): string[] {
  const resolvedMarket = determineMarketFromContext(market);
  const boundary = endDate ? parseISODate(endDate) : getMarketToday(resolvedMarket);

  return computeScheduledTradingDates(startDate, frequency, resolvedMarket, boundary);
}

/**
 * 개별 자동 투자 스케줄 조회
 */
export async function getAutoInvestSchedule(
  userId: string,
  portfolioId: string,
  positionId: string,
  scheduleId: string
): Promise<AutoInvestSchedule | null> {
  try {
    const scheduleRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions/${positionId}/autoInvestSchedules`,
      scheduleId
    );
    
    const scheduleDoc = await getDoc(scheduleRef);
    
    if (!scheduleDoc.exists()) {
      return null;
    }
    
    return {
      id: scheduleDoc.id,
      ...(scheduleDoc.data() as AutoInvestSchedule),
    };
  } catch (error) {
    console.error('Error getting auto invest schedule:', error);
    throw error;
  }
}

/**
 * 자동 투자 스케줄 수정
 */
export async function updateAutoInvestSchedule(
  userId: string,
  portfolioId: string,
  positionId: string,
  scheduleId: string,
  updateData: {
    frequency?: AutoInvestFrequency;
    amount?: number;
    effectiveFrom?: string;
    note?: string;
  }
): Promise<void> {
  try {
    const scheduleRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions/${positionId}/autoInvestSchedules`,
      scheduleId
    );
    
    const scheduleDoc = await getDoc(scheduleRef);
    if (!scheduleDoc.exists()) {
      throw new Error('스케줄을 찾을 수 없습니다.');
    }
    
    const batch = writeBatch(db);
    const now = Timestamp.now();
    
    // effectiveFrom이 변경되는 경우, 이전 스케줄의 effectiveTo도 조정
    if (updateData.effectiveFrom) {
      const schedulesRef = collection(
        db,
        `users/${userId}/portfolios/${portfolioId}/positions/${positionId}/autoInvestSchedules`
      );
      
      // 현재 스케줄보다 이전의 스케줄 중 effectiveTo가 설정되지 않았거나 새 시작일 이후인 것 찾기
      const previousSnapshot = await getDocs(
        query(
          schedulesRef,
          where('effectiveFrom', '<', updateData.effectiveFrom),
          orderBy('effectiveFrom', 'desc'),
          limit(1)
        )
      );
      
      if (!previousSnapshot.empty) {
        const previousDoc = previousSnapshot.docs[0];
        const prevEndDate = new Date(updateData.effectiveFrom);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        batch.update(previousDoc.ref, {
          effectiveTo: formatDate(prevEndDate),
          updatedAt: now,
        });
      }
    }
    
    // 스케줄 업데이트
    batch.update(scheduleRef, {
      ...updateData,
      updatedAt: now,
    });
    
    await batch.commit();
    console.log(`✅ 자동 투자 스케줄 수정: ${scheduleId}`);
  } catch (error) {
    console.error('Error updating auto invest schedule:', error);
    throw error;
  }
}

/**
 * 자동 투자 스케줄 삭제
 */
export async function deleteAutoInvestSchedule(
  userId: string,
  portfolioId: string,
  positionId: string,
  scheduleId: string,
  deleteRelatedTransactions: boolean = false
): Promise<{ deletedTransactions: number }> {
  try {
    const scheduleRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions/${positionId}/autoInvestSchedules`,
      scheduleId
    );
    
    const scheduleDoc = await getDoc(scheduleRef);
    if (!scheduleDoc.exists()) {
      throw new Error('스케줄을 찾을 수 없습니다.');
    }
    
    const scheduleData = scheduleDoc.data() as AutoInvestSchedule;
    let deletedTransactions = 0;
    
    // 관련 거래 삭제 옵션이 활성화된 경우
    if (deleteRelatedTransactions) {
      const transactionsRef = collection(
        db,
        `users/${userId}/portfolios/${portfolioId}/transactions`
      );
      
      const autoTransactionsSnapshot = await getDocs(
        query(
          transactionsRef,
          where('positionId', '==', positionId),
          where('purchaseMethod', '==', 'auto'),
          where('date', '>=', scheduleData.effectiveFrom)
        )
      );
      
      const toDelete = autoTransactionsSnapshot.docs.filter((doc) => {
        const data = doc.data();
        // effectiveTo가 있으면 그 범위 내의 거래만 삭제
        if (scheduleData.effectiveTo) {
          return data.date <= scheduleData.effectiveTo;
        }
        return true;
      });
      
      if (toDelete.length > 0) {
        const deleteBatch = writeBatch(db);
        toDelete.forEach((docRef) => deleteBatch.delete(docRef.ref));
        await deleteBatch.commit();
        deletedTransactions = toDelete.length;
      }
    }
    
    // 스케줄 삭제
    await deleteDoc(scheduleRef);
    console.log(`✅ 자동 투자 스케줄 삭제: ${scheduleId}, 거래 삭제: ${deletedTransactions}건`);
    
    // 포지션 재계산
    if (deletedTransactions > 0) {
      await recalculatePositionFromTransactions(userId, portfolioId, positionId);
    }
    
    return { deletedTransactions };
  } catch (error) {
    console.error('Error deleting auto invest schedule:', error);
    throw error;
  }
}

/**
 * 과거 스케줄 재적용
 * 선택한 스케줄을 현재 활성 스케줄로 만들고 거래 재생성
 */
export async function reapplySchedule(
  userId: string,
  portfolioId: string,
  positionId: string,
  scheduleId: string,
  options: {
    effectiveFrom: string;
    pricePerShare?: number;
    symbol: string;
    stockId: string;
    currency: 'USD' | 'KRW';
    market?: 'US' | 'KR' | 'GLOBAL';
  }
): Promise<{ removed: number; created: number; newScheduleId: string }> {
  try {
    const scheduleRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/positions/${positionId}/autoInvestSchedules`,
      scheduleId
    );
    
    const scheduleDoc = await getDoc(scheduleRef);
    if (!scheduleDoc.exists()) {
      throw new Error('스케줄을 찾을 수 없습니다.');
    }
    
    const scheduleData = scheduleDoc.data() as AutoInvestSchedule;
    
    // 새로운 스케줄 생성 (기존 스케줄의 frequency와 amount 사용)
    const newScheduleId = await createAutoInvestSchedule(
      userId,
      portfolioId,
      positionId,
      {
        frequency: scheduleData.frequency,
        amount: scheduleData.amount,
        currency: options.currency,
        effectiveFrom: options.effectiveFrom,
        createdBy: userId,
        note: `스케줄 재적용: ${scheduleId}`,
      }
    );
    
    // 거래 재생성
    const rewriteSummary = await rewriteAutoInvestTransactions(
      userId,
      portfolioId,
      positionId,
      {
        effectiveFrom: options.effectiveFrom,
        frequency: scheduleData.frequency,
        amount: scheduleData.amount,
        currency: options.currency,
        pricePerShare: options.pricePerShare,
        symbol: options.symbol,
        stockId: options.stockId,
        market: options.market,
      }
    );
    
    console.log(`✅ 스케줄 재적용 완료: ${scheduleId} -> ${newScheduleId}`);
    
    return {
      removed: rewriteSummary.removed,
      created: rewriteSummary.created,
      newScheduleId,
    };
  } catch (error) {
    console.error('Error reapplying schedule:', error);
    throw error;
  }
}

