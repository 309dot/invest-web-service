/**
 * Notification service helpers
 */

import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type BalanceAlertType = 'threshold' | 'insufficient';

export interface BalanceAlertPayload {
  userId: string;
  portfolioId: string;
  currency: 'USD' | 'KRW';
  currentBalance: number;
  threshold?: number | null;
  requiredAmount?: number;
  deficit?: number;
  type: BalanceAlertType;
  email?: string | null;
  metadata?: Record<string, unknown>;
}

export async function sendBalanceAlert(payload: BalanceAlertPayload): Promise<void> {
  const {
    userId,
    portfolioId,
    currency,
    currentBalance,
    threshold,
    requiredAmount,
    deficit,
    type,
    email,
    metadata = {},
  } = payload;

  const alertMessage = {
    type,
    userId,
    portfolioId,
    currency,
    currentBalance,
    threshold: threshold ?? undefined,
    requiredAmount,
    deficit,
    email: email ?? undefined,
    metadata,
    timestamp: new Date().toISOString(),
  };

  // TODO: Integrate with actual email/SMS provider
  console.warn('[Balance Alert]', JSON.stringify(alertMessage, null, 2));
}

export interface SellAlertPayload {
  userId: string;
  portfolioId: string;
  positionId: string;
  symbol: string;
  currency: 'USD' | 'KRW';
  currentPrice: number;
  currentReturnRate: number;
  targetReturnRate: number;
  sellRatio: number;
  sharesToSell: number;
  notifyEmail?: string | null;
}

export async function sendSellAlert(payload: SellAlertPayload): Promise<void> {
  const {
    userId,
    portfolioId,
    positionId,
    symbol,
    currency,
    currentPrice,
    currentReturnRate,
    targetReturnRate,
    sellRatio,
    sharesToSell,
    notifyEmail,
  } = payload;

  const alertMessage = {
    type: 'sell-alert',
    userId,
    portfolioId,
    positionId,
    symbol,
    currency,
    currentPrice,
    currentReturnRate,
    targetReturnRate,
    sellRatio,
    sharesToSell,
    email: notifyEmail ?? undefined,
    timestamp: new Date().toISOString(),
  };

  // TODO: Integrate with transactional email service
  console.warn('[Sell Alert]', JSON.stringify(alertMessage, null, 2));

  try {
    await addDoc(
      collection(db, `users/${userId}/sellAlerts`),
      {
        ...alertMessage,
        portfolioId,
        positionId,
        status: 'pending',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
    );
  } catch (error) {
    console.error('Failed to persist sell alert notification', error);
  }
}


