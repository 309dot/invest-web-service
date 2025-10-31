/**
 * 자동 투자 관련 서비스
 */

import { createTransaction } from './transaction';
import { updatePositionAfterTransaction } from './position';
import type { AutoInvestFrequency } from '@/types';

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

    let currentDate = new Date(startDate);

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
      });

      // 포지션 업데이트
      await updatePositionAfterTransaction(userId, portfolioId, positionId, {
        type: 'buy',
        shares: tx.shares,
        price: tx.price,
        date: tx.date,
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
  let currentDate = new Date(start);

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

