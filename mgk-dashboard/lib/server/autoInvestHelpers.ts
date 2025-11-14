import type { AutoInvestFrequency } from '@/types';
import { getFirestoreAdmin } from './firebaseAdmin';
import {
  adjustToNextTradingDay,
  advanceByFrequency,
  formatDate,
  parseISODate,
} from '@/lib/utils/tradingCalendar';

export function computeNextDueDate(params: {
  startDate: string;
  frequency: AutoInvestFrequency;
  market: 'US' | 'KR' | 'GLOBAL';
  today: string;
  lastExecuted?: string | null;
}): string | null {
  const { startDate, frequency, market, today, lastExecuted } = params;
  const todayDate = parseISODate(today);
  let pointer = adjustToNextTradingDay(startDate, market);
  let guard = 0;

  const executedDate = lastExecuted ? parseISODate(lastExecuted) : null;
  let candidate: string | null = null;

  while (pointer <= todayDate && guard < 5000) {
    const dateString = formatDate(pointer);
    if (!executedDate || pointer > executedDate) {
      candidate = dateString;
    }

    pointer = adjustToNextTradingDay(advanceByFrequency(pointer, frequency), market);
    guard += 1;
  }

  if (candidate === today) {
    return candidate;
  }

  return null;
}

export async function loadCurrentSchedule(
  userId: string,
  portfolioId: string,
  positionId: string,
  currentScheduleId?: string | null
) {
  const db = getFirestoreAdmin();
  const schedulesRef = db
    .collection('users')
    .doc(userId)
    .collection('portfolios')
    .doc(portfolioId)
    .collection('positions')
    .doc(positionId)
    .collection('autoInvestSchedules');

  if (currentScheduleId) {
    const scheduleDoc = await schedulesRef.doc(currentScheduleId).get();
    if (scheduleDoc.exists) {
      return { id: scheduleDoc.id, ...(scheduleDoc.data() as Record<string, any>) };
    }
  }

  const snapshot = await schedulesRef.orderBy('effectiveFrom', 'desc').limit(1).get();
  if (snapshot.empty) {
    return null;
  }

  const docSnapshot = snapshot.docs[0];
  return { id: docSnapshot.id, ...(docSnapshot.data() as Record<string, any>) };
}

