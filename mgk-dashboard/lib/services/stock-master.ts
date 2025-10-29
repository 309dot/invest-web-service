/**
 * 종목 마스터 관리 서비스
 * 
 * 기능:
 * - 검색된 종목 자동 저장
 * - 종목 정보 조회 및 업데이트
 * - 인기 종목 추적
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
  limit,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Stock } from '@/types';

/**
 * 종목을 stocks 컬렉션에 저장 (없으면 생성, 있으면 업데이트)
 */
export async function ensureStock(stockData: Omit<Stock, 'id'>): Promise<string> {
  try {
    const stockId = stockData.symbol;
    const stockRef = doc(db, 'stocks', stockId);
    
    // 기존 종목 확인
    const stockDoc = await getDoc(stockRef);
    
    if (stockDoc.exists()) {
      // 기존 종목이 있으면 검색 횟수만 증가
      await setDoc(
        stockRef,
        {
          searchCount: increment(1),
          lastUpdated: Timestamp.now(),
        },
        { merge: true }
      );
    } else {
      // 새 종목 생성
      await setDoc(stockRef, {
        ...stockData,
        searchCount: 1,
        lastUpdated: Timestamp.now(),
      });
    }
    
    return stockId;
  } catch (error) {
    console.error('Error ensuring stock:', error);
    throw error;
  }
}

/**
 * 여러 종목을 한 번에 저장
 */
export async function ensureMultipleStocks(
  stocks: Omit<Stock, 'id'>[]
): Promise<string[]> {
  const stockIds: string[] = [];
  
  for (const stock of stocks) {
    try {
      const stockId = await ensureStock(stock);
      stockIds.push(stockId);
    } catch (error) {
      console.error(`Failed to ensure stock ${stock.symbol}:`, error);
    }
  }
  
  return stockIds;
}

/**
 * 심볼로 종목 조회
 */
export async function getStockBySymbol(symbol: string): Promise<Stock | null> {
  try {
    const stockRef = doc(db, 'stocks', symbol);
    const stockDoc = await getDoc(stockRef);
    
    if (!stockDoc.exists()) {
      return null;
    }
    
    return {
      id: stockDoc.id,
      ...stockDoc.data(),
    } as Stock;
  } catch (error) {
    console.error('Error getting stock by symbol:', error);
    return null;
  }
}

/**
 * 여러 심볼로 종목 조회
 */
export async function getStocksBySymbols(symbols: string[]): Promise<Stock[]> {
  const stocks: Stock[] = [];
  
  for (const symbol of symbols) {
    const stock = await getStockBySymbol(symbol);
    if (stock) {
      stocks.push(stock);
    }
  }
  
  return stocks;
}

/**
 * 인기 종목 조회 (검색 횟수 기준)
 */
export async function getPopularStocks(limitCount: number = 10): Promise<Stock[]> {
  try {
    const stocksRef = collection(db, 'stocks');
    const q = query(
      stocksRef,
      orderBy('searchCount', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const stocks: Stock[] = [];
    
    snapshot.forEach((doc) => {
      stocks.push({
        id: doc.id,
        ...doc.data(),
      } as Stock);
    });
    
    return stocks;
  } catch (error) {
    console.error('Error getting popular stocks:', error);
    return [];
  }
}

/**
 * 시장별 인기 종목 조회
 */
export async function getPopularStocksByMarket(
  market: Stock['market'],
  limitCount: number = 10
): Promise<Stock[]> {
  try {
    const stocksRef = collection(db, 'stocks');
    const q = query(
      stocksRef,
      where('market', '==', market),
      orderBy('searchCount', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const stocks: Stock[] = [];
    
    snapshot.forEach((doc) => {
      stocks.push({
        id: doc.id,
        ...doc.data(),
      } as Stock);
    });
    
    return stocks;
  } catch (error) {
    console.error('Error getting popular stocks by market:', error);
    return [];
  }
}

/**
 * 자산 유형별 종목 조회
 */
export async function getStocksByAssetType(
  assetType: Stock['assetType'],
  limitCount: number = 20
): Promise<Stock[]> {
  try {
    const stocksRef = collection(db, 'stocks');
    const q = query(
      stocksRef,
      where('assetType', '==', assetType),
      orderBy('searchCount', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const stocks: Stock[] = [];
    
    snapshot.forEach((doc) => {
      stocks.push({
        id: doc.id,
        ...doc.data(),
      } as Stock);
    });
    
    return stocks;
  } catch (error) {
    console.error('Error getting stocks by asset type:', error);
    return [];
  }
}

/**
 * 섹터별 종목 조회
 */
export async function getStocksBySector(
  sector: Stock['sector'],
  limitCount: number = 20
): Promise<Stock[]> {
  try {
    const stocksRef = collection(db, 'stocks');
    const q = query(
      stocksRef,
      where('sector', '==', sector),
      orderBy('searchCount', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const stocks: Stock[] = [];
    
    snapshot.forEach((doc) => {
      stocks.push({
        id: doc.id,
        ...doc.data(),
      } as Stock);
    });
    
    return stocks;
  } catch (error) {
    console.error('Error getting stocks by sector:', error);
    return [];
  }
}

/**
 * 종목 정보 업데이트
 */
export async function updateStock(
  symbol: string,
  updates: Partial<Omit<Stock, 'id' | 'symbol'>>
): Promise<void> {
  try {
    const stockRef = doc(db, 'stocks', symbol);
    await setDoc(
      stockRef,
      {
        ...updates,
        lastUpdated: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating stock:', error);
    throw error;
  }
}

/**
 * 종목 검색 횟수 증가
 */
export async function incrementSearchCount(symbol: string): Promise<void> {
  try {
    const stockRef = doc(db, 'stocks', symbol);
    await setDoc(
      stockRef,
      {
        searchCount: increment(1),
        lastUpdated: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error incrementing search count:', error);
  }
}

/**
 * 종목 삭제 (관리자용)
 */
export async function deleteStock(symbol: string): Promise<void> {
  try {
    const stockRef = doc(db, 'stocks', symbol);
    await setDoc(stockRef, { deleted: true, deletedAt: Timestamp.now() }, { merge: true });
  } catch (error) {
    console.error('Error deleting stock:', error);
    throw error;
  }
}

/**
 * 최근 업데이트된 종목 조회
 */
export async function getRecentlyUpdatedStocks(limitCount: number = 10): Promise<Stock[]> {
  try {
    const stocksRef = collection(db, 'stocks');
    const q = query(
      stocksRef,
      orderBy('lastUpdated', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const stocks: Stock[] = [];
    
    snapshot.forEach((doc) => {
      stocks.push({
        id: doc.id,
        ...doc.data(),
      } as Stock);
    });
    
    return stocks;
  } catch (error) {
    console.error('Error getting recently updated stocks:', error);
    return [];
  }
}

