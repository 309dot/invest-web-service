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
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Position, SellAlertConfig, Stock, Transaction } from '@/types';
import {
  assertCurrency,
  convertWithRate,
  getUsdKrwRate,
  type SupportedCurrency,
} from '@/lib/currency';
import { getCurrentPrice, getHistoricalPrice } from '@/lib/apis/alphavantage';
import { getKoreanStockPrice } from '@/lib/apis/yahoo-finance';
import {
  determineMarketFromContext,
  formatDate as formatTradingDate,
  getMarketToday,
} from '@/lib/utils/tradingCalendar';
import { sendSellAlert } from '@/lib/services/notifications';

const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const FLOAT_TOLERANCE = 1e-6;

type PriceSource = 'realtime' | 'historical' | 'fallback' | 'cached';

interface PriceCacheEntry {
  price: number | null;
  source: PriceSource;
  timestamp: string;
}

function normalizeSymbolForAlphaVantage(symbol: string): string {
  return symbol.replace('-', '.').toUpperCase();
}

async function applyLatestMarketPrices(positions: Position[]): Promise<Position[]> {
  if (positions.length === 0) {
    return positions;
  }

  const priceCache = new Map<string, PriceCacheEntry>();
  const groupedBySymbol = new Map<string, Position[]>();

  positions.forEach((position) => {
    const key = `${position.symbol}_${position.currency ?? 'USD'}`;
    const group = groupedBySymbol.get(key) ?? [];
    group.push(position);
    groupedBySymbol.set(key, group);
  });

  for (const [key, group] of groupedBySymbol.entries()) {
    const sample = group[0];
    const symbol = sample.symbol;
    const isKorean = sample.currency === 'KRW' || /^[0-9]{4,6}$/.test(symbol);
    let price: number | null = null;
    let source: PriceSource = 'cached';

    try {
      if (isKorean) {
        price = await getKoreanStockPrice(symbol);
        if (price && Number.isFinite(price) && price > 0) {
          source = 'realtime';
        }
      } else {
        const alphaSymbol = normalizeSymbolForAlphaVantage(symbol);
        const currentPrice = await getCurrentPrice(alphaSymbol);
        if (Number.isFinite(currentPrice?.price)) {
          price = currentPrice!.price;
          source = 'realtime';
        } else {
          price = null;
        }
      }
    } catch (error) {
      console.error('Realtime price lookup failed:', symbol, error);
      price = null;
    }

    if (!price || !Number.isFinite(price) || price <= 0) {
      try {
        const market = determineMarketFromContext(sample.market, sample.currency, sample.symbol);
        const today = formatTradingDate(getMarketToday(market));
        const historical = await getHistoricalPrice(
          normalizeSymbolForAlphaVantage(symbol),
          today,
          sample.purchaseMethod === 'auto' ? 'auto' : 'manual',
          market
        );
        if (historical && Number.isFinite(historical) && historical > 0) {
          price = historical;
          source = 'historical';
        }
      } catch (error) {
        console.warn('Historical price lookup failed:', symbol, error);
      }
    }

    if (!price || !Number.isFinite(price) || price <= 0) {
      if (sample.currentPrice && sample.currentPrice > 0) {
        price = sample.currentPrice;
        source = 'fallback';
      } else if (sample.averagePrice && sample.averagePrice > 0) {
        price = sample.averagePrice;
        source = 'fallback';
      } else {
        price = null;
        source = 'fallback';
      }
    }

    priceCache.set(key, {
      price,
      source,
      timestamp: new Date().toISOString(),
    });
  }

  return positions
    .map((position) => {
      const key = `${position.symbol}_${position.currency ?? 'USD'}`;
      const cachedEntry = priceCache.get(key);
      const currentPrice = cachedEntry && cachedEntry.price && cachedEntry.price > 0
        ? cachedEntry.price
        : position.currentPrice;
      const totalValue = position.shares * currentPrice;
      const returnRate = calculateReturnRate(totalValue, position.totalInvested);
      const profitLoss = totalValue - position.totalInvested;

      return {
        ...position,
        currentPrice,
        totalValue,
        returnRate,
        profitLoss,
        priceSource: cachedEntry?.source ?? 'cached',
        priceTimestamp: cachedEntry?.timestamp ?? new Date().toISOString(),
      } as Position;
    })
    .sort((a, b) => b.totalValue - a.totalValue);
}

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
  let lastTradePrice = 0;
  let firstPurchaseDate: string | null = null;
  let lastTransactionDate: string | null = null;

  transactions.forEach((tx) => {
    const price = tx.price || 0;
    const quantity = tx.shares || 0;

    if (price > 0) {
      lastTradePrice = price;
    }

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

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      currentPrice = price;
    }
    if (!firstPurchaseDate) {
      firstPurchaseDate = tx.date;
    }
    lastTransactionDate = tx.date;
  });

  if ((!Number.isFinite(currentPrice) || currentPrice <= 0) && lastTradePrice > 0) {
    currentPrice = lastTradePrice;
  }

  const totalValue = shares * currentPrice;
  const returnRate = calculateReturnRate(totalValue, totalInvested);
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

function normalizeSellAlertSettings(
  existing: SellAlertConfig | undefined,
  updates: {
    enabled: boolean;
    targetReturnRate?: number;
    sellRatio?: number;
    notifyEmail?: string | null;
    triggerOnce?: boolean;
  }
): SellAlertConfig {
  const targetReturnRate = updates.targetReturnRate ?? existing?.targetReturnRate ?? 0;
  const sellRatio = updates.sellRatio ?? existing?.sellRatio ?? 100;
  const notifyEmail = updates.notifyEmail !== undefined ? updates.notifyEmail : existing?.notifyEmail ?? null;
  const triggerOnce = updates.triggerOnce !== undefined ? updates.triggerOnce : existing?.triggerOnce ?? true;

  return {
    enabled: updates.enabled,
    targetReturnRate: Math.max(0, Number.isFinite(targetReturnRate) ? targetReturnRate : 0),
    sellRatio: Math.min(100, Math.max(0, Number.isFinite(sellRatio) ? sellRatio : 100)),
    notifyEmail: notifyEmail ? notifyEmail : null,
    triggerOnce,
    lastTriggeredAt: updates.enabled ? existing?.lastTriggeredAt ?? null : null,
  };
}

async function markSellAlertTriggered(
  userId: string,
  portfolioId: string,
  positionId: string,
  timestamp: string
) {
  const positionRef = doc(
    db,
    `users/${userId}/portfolios/${portfolioId}/positions`,
    positionId
  );

  await updateDoc(positionRef, {
    'sellAlert.lastTriggeredAt': timestamp,
    updatedAt: Timestamp.now(),
  });
}

async function evaluateSellAlerts(
  userId: string,
  portfolioId: string,
  positions: Position[]
): Promise<void> {
  for (const position of positions) {
    if (!position.id) {
      continue;
    }

    const config = position.sellAlert;
    if (!config || !config.enabled) {
      continue;
    }

    if (!Number.isFinite(config.targetReturnRate)) {
      continue;
    }

    if (!Number.isFinite(position.returnRate)) {
      continue;
    }

    const currentReturnRate = position.returnRate;
    if (currentReturnRate < config.targetReturnRate) {
      continue;
    }

    if (config.triggerOnce && config.lastTriggeredAt) {
      continue;
    }

    if (!config.triggerOnce && config.lastTriggeredAt) {
      const lastTime = new Date(config.lastTriggeredAt).getTime();
      if (!Number.isNaN(lastTime)) {
        const hoursElapsed = (Date.now() - lastTime) / (1000 * 60 * 60);
        if (hoursElapsed < 6) {
          continue;
        }
      }
    }

    const sellRatio = Math.min(100, Math.max(0, config.sellRatio));
    const sharesToSell = position.shares * (sellRatio / 100);

    await sendSellAlert({
      userId,
      portfolioId,
      positionId: position.id,
      symbol: position.symbol,
      currency: position.currency,
      currentPrice: position.currentPrice,
      currentReturnRate,
      targetReturnRate: config.targetReturnRate,
      sellRatio,
      sharesToSell,
      notifyEmail: config.notifyEmail ?? null,
    });

    const timestamp = new Date().toISOString();
    await markSellAlertTriggered(userId, portfolioId, position.id, timestamp);

    position.sellAlert = {
      ...config,
      lastTriggeredAt: timestamp,
    };
  }
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
    const returnRate = calculateReturnRate(totalValue, totalInvested);
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
        query(transactionsRef, where('positionId', '==', docSnapshot.id))
      );

      const transactions: Transaction[] = transactionsSnapshot.docs
        .map((txDoc) => ({
          id: txDoc.id,
          ...txDoc.data(),
        } as Transaction))
        .sort((a, b) => a.date.localeCompare(b.date));

      const resolvedCurrency = assertCurrency(
        (positionData as Position).currency,
        positionData.market === 'KR' ? 'KRW' : 'USD'
      );

      const normalizedPosition = {
        ...positionData,
        currency: resolvedCurrency,
      } as Position;

      const metrics = aggregatePositionMetrics(transactions, normalizedPosition);

      if (normalizedPosition && metricsNeedUpdate(normalizedPosition, metrics)) {
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
          ...normalizedPosition,
          ...metrics,
        });
      } else {
        positions.push({
          ...normalizedPosition,
          ...metrics,
        });
      }
    }

    const enrichedPositions = await applyLatestMarketPrices(positions);
    await evaluateSellAlerts(userId, portfolioId, enrichedPositions);
    return enrichedPositions;
  } catch (error) {
    console.error('Error getting portfolio positions:', error);
    return [];
  }
}

export async function updateSellAlertSettings(
  userId: string,
  portfolioId: string,
  positionId: string,
  settings: {
    enabled: boolean;
    targetReturnRate?: number;
    sellRatio?: number;
    notifyEmail?: string | null;
    triggerOnce?: boolean;
  }
): Promise<SellAlertConfig> {
  const positionRef = doc(
    db,
    `users/${userId}/portfolios/${portfolioId}/positions`,
    positionId
  );

  const snapshot = await getDoc(positionRef);

  if (!snapshot.exists()) {
    throw new Error('포지션을 찾을 수 없습니다.');
  }

  const existing = snapshot.data().sellAlert as SellAlertConfig | undefined;
  const normalized = normalizeSellAlertSettings(existing, settings);

  await updateDoc(positionRef, {
    sellAlert: normalized,
    updatedAt: Timestamp.now(),
  });

  return normalized;
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
  totalValue: number,
  totalInvested: number
): number {
  if (!Number.isFinite(totalValue) || !Number.isFinite(totalInvested) || totalInvested <= 0) {
    return 0;
  }
  return ((totalValue - totalInvested) / totalInvested) * 100;
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
      query(transactionsRef, where('positionId', '==', positionId))
    );

    const transactions: Transaction[] = transactionsSnapshot.docs
      .map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      } as Transaction))
      .sort((a, b) => a.date.localeCompare(b.date));

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
      const newReturnRate = calculateReturnRate(newTotalValue, position.totalInvested);
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
 * 포트폴리오 총계 계산 (통화별 분리)
 */
export async function calculatePortfolioTotals(
  userId: string,
  portfolioId: string,
  options: {
    positions?: Position[];
  } = {}
): Promise<{
  byCurrency: Record<SupportedCurrency, {
    totalInvested: number;
    totalValue: number;
    count: number;
  }>;
  converted: Record<SupportedCurrency, {
    totalInvested: number;
    totalValue: number;
  }>;
  combined: {
    baseCurrency: SupportedCurrency;
    totalInvested: number;
    totalValue: number;
    returnRate: number;
  };
  exchangeRate: {
    base: 'USD';
    quote: 'KRW';
    rate: number;
    source: 'cache' | 'live' | 'fallback';
  };
}> {
  try {
    const positions = options.positions ?? (await getPortfolioPositions(userId, portfolioId));

    const byCurrency: Record<SupportedCurrency, {
      totalInvested: number;
      totalValue: number;
      count: number;
    }> = {
      USD: { totalInvested: 0, totalValue: 0, count: 0 },
      KRW: { totalInvested: 0, totalValue: 0, count: 0 },
    };

    positions.forEach((p) => {
      const resolvedCurrency = assertCurrency(p.currency, p.market === 'KR' ? 'KRW' : 'USD');
      byCurrency[resolvedCurrency].totalInvested += p.totalInvested;
      byCurrency[resolvedCurrency].totalValue += p.totalValue;
      byCurrency[resolvedCurrency].count += 1;
    });

    const { rate, source } = await getUsdKrwRate();

    const totalInvestedUsd =
      byCurrency.USD.totalInvested + convertWithRate(byCurrency.KRW.totalInvested, 'KRW', 'USD', rate);
    const totalValueUsd =
      byCurrency.USD.totalValue + convertWithRate(byCurrency.KRW.totalValue, 'KRW', 'USD', rate);

    const totalInvestedKrw =
      byCurrency.KRW.totalInvested + convertWithRate(byCurrency.USD.totalInvested, 'USD', 'KRW', rate);
    const totalValueKrw =
      byCurrency.KRW.totalValue + convertWithRate(byCurrency.USD.totalValue, 'USD', 'KRW', rate);

    const combinedReturnRate =
      totalInvestedUsd > 0 ? ((totalValueUsd - totalInvestedUsd) / totalInvestedUsd) * 100 : 0;

    return {
      byCurrency,
      combined: {
        baseCurrency: 'USD',
        totalInvested: totalInvestedUsd,
        totalValue: totalValueUsd,
        returnRate: combinedReturnRate,
      },
      converted: {
        USD: {
          totalInvested: totalInvestedUsd,
          totalValue: totalValueUsd,
        },
        KRW: {
          totalInvested: totalInvestedKrw,
          totalValue: totalValueKrw,
        },
      },
      exchangeRate: {
        base: 'USD',
        quote: 'KRW',
        rate,
        source,
      },
    };
  } catch (error) {
    console.error('Error calculating portfolio totals:', error);
    return {
      byCurrency: {
        USD: { totalInvested: 0, totalValue: 0, count: 0 },
        KRW: { totalInvested: 0, totalValue: 0, count: 0 },
      },
      combined: {
        baseCurrency: 'USD',
        totalInvested: 0,
        totalValue: 0,
        returnRate: 0,
      },
      converted: {
        USD: { totalInvested: 0, totalValue: 0 },
        KRW: { totalInvested: 0, totalValue: 0 },
      },
      exchangeRate: {
        base: 'USD',
        quote: 'KRW',
        rate: 0,
        source: 'fallback',
      },
    };
  }
}

