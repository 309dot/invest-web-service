/**
 * 잔액 및 충전 관리 서비스
 * 
 * 원화/달러 충전 및 잔액 추적
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
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface BalanceRecord {
  id?: string;
  userId: string;
  portfolioId: string;
  currency: 'KRW' | 'USD';
  balance: number; // 현재 잔액
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ChargeRecord {
  id?: string;
  userId: string;
  portfolioId: string;
  type: 'deposit' | 'withdrawal'; // 입금/출금
  currency: 'KRW' | 'USD';
  amount: number;
  exchangeRate?: number; // 원화->달러 환전 시
  convertedAmount?: number; // 환전된 금액
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: Timestamp;
}

/**
 * 잔액 조회
 */
export async function getBalance(
  userId: string,
  portfolioId: string,
  currency: 'KRW' | 'USD'
): Promise<number> {
  try {
    const balanceRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/balance`,
      currency
    );
    const balanceDoc = await getDoc(balanceRef);

    if (!balanceDoc.exists()) {
      return 0;
    }

    const data = balanceDoc.data() as BalanceRecord;
    return data.balance || 0;
  } catch (error) {
    console.error('Error getting balance:', error);
    return 0;
  }
}

/**
 * 모든 잔액 조회
 */
export async function getAllBalances(
  userId: string,
  portfolioId: string
): Promise<{ KRW: number; USD: number }> {
  try {
    const [krwBalance, usdBalance] = await Promise.all([
      getBalance(userId, portfolioId, 'KRW'),
      getBalance(userId, portfolioId, 'USD'),
    ]);

    return {
      KRW: krwBalance,
      USD: usdBalance,
    };
  } catch (error) {
    console.error('Error getting all balances:', error);
    return { KRW: 0, USD: 0 };
  }
}

/**
 * 잔액 업데이트
 */
export async function updateBalance(
  userId: string,
  portfolioId: string,
  currency: 'KRW' | 'USD',
  amount: number
): Promise<void> {
  try {
    const balanceRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/balance`,
      currency
    );

    const balanceDoc = await getDoc(balanceRef);
    const currentBalance = balanceDoc.exists()
      ? (balanceDoc.data() as BalanceRecord).balance
      : 0;

    const newBalance = currentBalance + amount;

    if (newBalance < 0) {
      throw new Error('잔액이 부족합니다.');
    }

    const balanceData: BalanceRecord = {
      userId,
      portfolioId,
      currency,
      balance: newBalance,
      createdAt: balanceDoc.exists()
        ? (balanceDoc.data() as BalanceRecord).createdAt
        : Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(balanceRef, balanceData);
    console.log(`✅ 잔액 업데이트: ${currency} ${newBalance}`);
  } catch (error) {
    console.error('Error updating balance:', error);
    throw error;
  }
}

/**
 * 충전 기록 생성
 */
export async function createChargeRecord(
  userId: string,
  portfolioId: string,
  chargeData: {
    type: 'deposit' | 'withdrawal';
    currency: 'KRW' | 'USD';
    amount: number;
    exchangeRate?: number;
    convertedAmount?: number;
    date: string;
    note?: string;
  }
): Promise<string> {
  try {
    const chargesRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/charges`
    );
    const chargeRef = doc(chargesRef);

    const charge: ChargeRecord = {
      userId,
      portfolioId,
      type: chargeData.type,
      currency: chargeData.currency,
      amount: chargeData.amount,
      exchangeRate: chargeData.exchangeRate,
      convertedAmount: chargeData.convertedAmount,
      date: chargeData.date,
      memo: chargeData.memo || '',
      createdAt: Timestamp.now(),
    };

    await setDoc(chargeRef, charge);
    console.log(`✅ 충전 기록 생성: ${chargeRef.id}`);

    // 잔액 업데이트
    const balanceChange = chargeData.type === 'deposit' ? chargeData.amount : -chargeData.amount;
    await updateBalance(userId, portfolioId, chargeData.currency, balanceChange);

    // 환전한 경우 반대 통화 잔액도 업데이트
    if (chargeData.convertedAmount && chargeData.exchangeRate) {
      const targetCurrency = chargeData.currency === 'KRW' ? 'USD' : 'KRW';
      const targetChange = chargeData.type === 'deposit' ? -chargeData.convertedAmount : chargeData.convertedAmount;
      await updateBalance(userId, portfolioId, targetCurrency, targetChange);
    }

    return chargeRef.id;
  } catch (error) {
    console.error('Error creating charge record:', error);
    throw error;
  }
}

/**
 * 충전 이력 조회
 */
export async function getChargeHistory(
  userId: string,
  portfolioId: string,
  options?: {
    currency?: 'KRW' | 'USD';
    type?: 'deposit' | 'withdrawal';
    limit?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<ChargeRecord[]> {
  try {
    const chargesRef = collection(
      db,
      `users/${userId}/portfolios/${portfolioId}/charges`
    );

    let q = query(chargesRef, orderBy('date', 'desc'));

    // 필터 적용
    if (options?.currency) {
      q = query(q, where('currency', '==', options.currency));
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

    const charges: ChargeRecord[] = [];
    snapshot.forEach((doc) => {
      charges.push({
        id: doc.id,
        ...doc.data(),
      } as ChargeRecord);
    });

    return charges;
  } catch (error) {
    console.error('Error getting charge history:', error);
    return [];
  }
}

/**
 * 충전 통계 계산
 */
export async function calculateChargeStats(
  userId: string,
  portfolioId: string,
  period?: {
    startDate: string;
    endDate: string;
  }
): Promise<{
  totalDeposits: { KRW: number; USD: number };
  totalWithdrawals: { KRW: number; USD: number };
  chargeCount: number;
}> {
  try {
    const options = period
      ? { startDate: period.startDate, endDate: period.endDate }
      : undefined;

    const charges = await getChargeHistory(userId, portfolioId, options);

    const deposits = charges.filter((c) => c.type === 'deposit');
    const withdrawals = charges.filter((c) => c.type === 'withdrawal');

    const totalDeposits = {
      KRW: deposits.filter((c) => c.currency === 'KRW').reduce((sum, c) => sum + c.amount, 0),
      USD: deposits.filter((c) => c.currency === 'USD').reduce((sum, c) => sum + c.amount, 0),
    };

    const totalWithdrawals = {
      KRW: withdrawals.filter((c) => c.currency === 'KRW').reduce((sum, c) => sum + c.amount, 0),
      USD: withdrawals.filter((c) => c.currency === 'USD').reduce((sum, c) => sum + c.amount, 0),
    };

    return {
      totalDeposits,
      totalWithdrawals,
      chargeCount: charges.length,
    };
  } catch (error) {
    console.error('Error calculating charge stats:', error);
    return {
      totalDeposits: { KRW: 0, USD: 0 },
      totalWithdrawals: { KRW: 0, USD: 0 },
      chargeCount: 0,
    };
  }
}

/**
 * 잔액 초기화 (포트폴리오 생성 시)
 */
export async function initializeBalances(
  userId: string,
  portfolioId: string
): Promise<void> {
  try {
    const batch = writeBatch(db);

    const krwRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/balance`,
      'KRW'
    );
    const usdRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/balance`,
      'USD'
    );

    batch.set(krwRef, {
      userId,
      portfolioId,
      currency: 'KRW',
      balance: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    batch.set(usdRef, {
      userId,
      portfolioId,
      currency: 'USD',
      balance: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await batch.commit();
    console.log(`✅ 잔액 초기화: ${portfolioId}`);
  } catch (error) {
    console.error('Error initializing balances:', error);
    throw error;
  }
}

