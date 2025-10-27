import { Timestamp } from 'firebase/firestore';

import {
  addDocument,
  deleteDocument,
  getDocumentsWithLimit,
  updateDocument,
} from '@/lib/firestore';
import type { WatchlistItem } from '@/types';

const COLLECTION_NAME = 'watchlist';

export async function addWatchlistItem(data: {
  symbol: string;
  targetPrice?: number;
  memo?: string;
}) {
  const payload: Omit<WatchlistItem, 'id'> = {
    symbol: data.symbol.toUpperCase(),
    targetPrice: data.targetPrice ?? undefined,
    memo: data.memo?.trim() ? data.memo.trim() : undefined,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  return addDocument<WatchlistItem>(COLLECTION_NAME, payload);
}

export async function updateWatchlistItem(id: string, data: Partial<WatchlistItem>) {
  return updateDocument(COLLECTION_NAME, id, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function removeWatchlistItem(id: string) {
  return deleteDocument(COLLECTION_NAME, id);
}

export async function listWatchlistItems(limitCount = 50) {
  return getDocumentsWithLimit<WatchlistItem>(COLLECTION_NAME, limitCount, 'createdAt', 'desc');
}

