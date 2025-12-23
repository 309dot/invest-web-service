import axios from 'axios';
import type { PriceData, PriceCacheEntry, PriceCacheResolution } from '@/types';
import { getFirestoreAdmin } from '@/lib/server/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

const ALPHA_VANTAGE_API_KEY =
  process.env.ALPHA_VANTAGE_API_KEY ||
  process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY ||
  '';
const BASE_URL = 'https://www.alphavantage.co/query';

// API 키 검증
if (!ALPHA_VANTAGE_API_KEY) {
  console.error('❌ ALPHA_VANTAGE_API_KEY 또는 NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY가 설정되지 않았습니다!');
  console.error('Vercel Dashboard → Settings → Environment Variables에서 설정하세요.');
}

console.log('🔑 Alpha Vantage API Key:', ALPHA_VANTAGE_API_KEY ? `${ALPHA_VANTAGE_API_KEY.substring(0, 8)}...` : '없음');

// Cache for API responses (5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const FX_SERIES_CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours
const KOREAN_SYMBOL_PATTERN = /^[0-9]{4,6}$/;
const PRICE_CACHE_COLLECTION = 'priceCache';

function isKoreanMarketSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  return KOREAN_SYMBOL_PATTERN.test(symbol) || upper.endsWith('.KS') || upper.endsWith('.KQ');
}

function buildKoreanSymbolCandidates(symbol: string): string[] {
  const upper = symbol.toUpperCase();
  if (upper.endsWith('.KS') || upper.endsWith('.KQ')) {
    return [upper];
  }
  return [`${symbol}.KS`, `${symbol}.KQ`];
}

function resolveMarket(symbol: string): 'US' | 'KR' | 'GLOBAL' {
  return isKoreanMarketSymbol(symbol) ? 'KR' : 'US';
}

function buildPriceCacheKey(symbol: string, market: 'US' | 'KR' | 'GLOBAL', resolution: PriceCacheResolution) {
  return `${symbol}:${market}:${resolution}`;
}

function timestampToDate(ts: any): Date | null {
  if (!ts) {
    return null;
  }
  if (typeof ts.toDate === 'function') {
    return ts.toDate();
  }
  if (typeof ts.seconds === 'number') {
    return new Date(ts.seconds * 1000);
  }
  return null;
}

function isCacheEntryValid(entry: PriceCacheEntry | null): entry is PriceCacheEntry {
  if (!entry) return false;
  const expireDate = timestampToDate((entry as any).expireAt);
  if (!expireDate) return false;
  return expireDate.getTime() >= Date.now();
}

function priceCacheEntryToPriceData(entry: PriceCacheEntry): PriceData {
  const sourceDate =
    timestampToDate((entry as any).sourceTimestamp) ?? timestampToDate((entry as any).cachedAt) ?? new Date();
  const previousClose = entry.previousClose ?? entry.open ?? entry.price;
  const change = entry.price - (previousClose ?? entry.price);
  const changePercent =
    previousClose && previousClose !== 0 ? (change / previousClose) * 100 : 0;

  const cachedAtIso =
    timestampToDate((entry as any).cachedAt)?.toISOString() ??
    (typeof (entry as any).cachedAt === 'string' ? (entry as any).cachedAt : undefined);

  return {
    symbol: entry.symbol,
    price: entry.price,
    change,
    changePercent,
    timestamp: sourceDate,
    source: 'cached',
    metadata: {
      cacheKey: entry.cacheKey,
      cachedAt: cachedAtIso,
    },
  };
}

async function loadPriceCache(
  symbol: string,
  market: 'US' | 'KR' | 'GLOBAL',
  resolution: PriceCacheResolution
): Promise<PriceCacheEntry | null> {
  try {
    const cacheKey = buildPriceCacheKey(symbol, market, resolution);
    const firestore = getFirestoreAdmin();
    const snapshot = await firestore.collection(PRICE_CACHE_COLLECTION).doc(cacheKey).get();
    if (!snapshot.exists) {
      return null;
    }
    const data = snapshot.data() as PriceCacheEntry;
    if (!isCacheEntryValid(data)) {
      return null;
    }
    return data;
  } catch (error) {
    console.error('[priceCache] Failed to load cache', { symbol, market, resolution, error });
    return null;
  }
}

function formatDateKST(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Seoul',
  });
}

/**
 * Get current price for a stock symbol
 */
export async function getCurrentPrice(symbol: string): Promise<PriceData> {
  const cacheKey = `price-${symbol}`;
  const cached = cache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol,
        apikey: ALPHA_VANTAGE_API_KEY,
      },
      timeout: 10000,
    });

    const quote = response.data['Global Quote'];

    if (!quote || Object.keys(quote).length === 0) {
      throw new Error('No data returned from Alpha Vantage API');
    }

    const priceData: PriceData = {
      symbol: quote['01. symbol'],
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
      timestamp: new Date(),
      source: 'live',
    };

    // Cache the result
    cache.set(cacheKey, { data: priceData, timestamp: Date.now() });

    const market = resolveMarket(symbol);
    const resolution: PriceCacheResolution = 'intraday';
    try {
      const firestore = getFirestoreAdmin();
      const priceCacheDoc = firestore
        .collection(PRICE_CACHE_COLLECTION)
        .doc(buildPriceCacheKey(symbol, market, resolution));
      const cachedAt = new Date();
      const expireAt = new Date(cachedAt.getTime() + 10 * 60 * 1000); // 10분 TTL

      const payload: PriceCacheEntry = {
        cacheKey: buildPriceCacheKey(symbol, market, resolution),
        symbol,
        market,
        currency: market === 'KR' ? 'KRW' : 'USD',
        resolution,
        price: priceData.price,
        open: priceData.price,
        high: priceData.price,
        low: priceData.price,
        previousClose: priceData.price - priceData.change,
        volume: undefined,
        source: 'alphavantage',
        sourceTimestamp: Timestamp.fromDate(priceData.timestamp),
        cachedAt: Timestamp.fromDate(cachedAt),
        expireAt: Timestamp.fromDate(expireAt),
      };

      await priceCacheDoc.set(payload, { merge: true });
    } catch (error) {
      console.error('[priceCache] Failed to persist latest price', { symbol, error });
    }

    return priceData;
  } catch (error) {
    console.error('Error fetching price from Alpha Vantage:', error);

    const market = resolveMarket(symbol);
    const cacheEntry = await loadPriceCache(symbol, market, 'intraday');
    if (cacheEntry) {
      console.warn('[priceCache] Falling back to Firestore cache for current price', {
        symbol,
        market,
        cachedAt: timestampToDate((cacheEntry as any).cachedAt)?.toISOString(),
      });
      return priceCacheEntryToPriceData(cacheEntry);
    }

    // If API fails, try to return cached data even if expired
    if (cached) {
      console.warn('Returning expired cache data due to API error');
      return {
        ...cached.data,
        source: cached.data.source === 'cached' ? 'cached' : 'stale',
      };
    }

    throw new Error('Failed to fetch stock price');
  }
}

/**
 * Get intraday price data for charting
 */
export async function getIntradayData(symbol: string, interval: '5min' | '15min' | '30min' | '60min' = '60min') {
  const cacheKey = `intraday-${symbol}-${interval}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'TIME_SERIES_INTRADAY',
        symbol: symbol,
        interval: interval,
        apikey: ALPHA_VANTAGE_API_KEY,
      },
      timeout: 10000,
    });

    const timeSeries = response.data[`Time Series (${interval})`];

    if (!timeSeries) {
      throw new Error('No intraday data returned');
    }

    const data = Object.entries(timeSeries).map(([timestamp, values]: [string, any]) => ({
      timestamp: new Date(timestamp),
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume']),
    }));

    cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  } catch (error) {
    console.error('Error fetching intraday data:', error);

    if (cached) {
      return cached.data;
    }

    throw new Error('Failed to fetch intraday data');
  }
}

/**
 * Get daily time series data
 */
export async function getDailyData(symbol: string, outputsize: 'compact' | 'full' = 'compact') {
  const cacheKey = `daily-${symbol}-${outputsize}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    console.log(`📡 Calling Alpha Vantage API for ${symbol}...`);
    console.log(`   API Key: ${ALPHA_VANTAGE_API_KEY ? 'Exists' : 'Missing'}`);
    
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: symbol,
        outputsize: outputsize,
        apikey: ALPHA_VANTAGE_API_KEY,
      },
      timeout: 10000,
    });

    console.log(`📊 API Response keys:`, Object.keys(response.data));

    // API 에러 메시지 확인
    if (response.data['Error Message']) {
      console.error('❌ Alpha Vantage Error:', response.data['Error Message']);
      throw new Error(response.data['Error Message']);
    }

    // API 호출 제한 확인
    if (response.data['Note']) {
      console.error('⚠️ API Rate Limit:', response.data['Note']);
      throw new Error('API rate limit exceeded');
    }

    // 정보 메시지 확인 (demo 키 등)
    if (response.data['Information']) {
      console.error('ℹ️ API Information:', response.data['Information']);
      throw new Error('Invalid API key or demo key');
    }

    const timeSeries = response.data['Time Series (Daily)'];

    if (!timeSeries) {
      console.error('❌ No Time Series data in response');
      throw new Error('No daily data returned');
    }

    const data = Object.entries(timeSeries).map(([date, values]: [string, any]) => ({
      date: date,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume']),
    }));

    cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  } catch (error) {
    console.error('Error fetching daily data:', error);

    if (cached) {
      return cached.data;
    }

    throw new Error('Failed to fetch daily data');
  }
}

/**
 * Get historical price for a specific date
 * 매수 가격 자동 결정 우선순위:
 * 1순위: 해당일 종가 (Close Price)
 * 2순위: 해당일 시가 (Open Price)  
 * 3순위: 전일 종가 (휴장일 대응)
 */
export async function getHistoricalPrice(
  symbol: string,
  date: string,
  purchaseMethod?: 'manual' | 'auto',
  market?: 'US' | 'KR' | 'GLOBAL'
): Promise<number | null> {
  try {
    const normalizedMethod: 'manual' | 'auto' = purchaseMethod || 'manual';
    console.log(`🔍 Fetching historical price for ${symbol} on ${date} (method: ${normalizedMethod})`);

    const inferredMarket = market || (isKoreanMarketSymbol(symbol) ? 'KR' : 'US');

    if (inferredMarket === 'KR') {
      return await getKoreanHistoricalPrice(symbol, date, normalizedMethod);
    }

    if (!ALPHA_VANTAGE_API_KEY) {
      console.error('❌ API 키가 없어서 가격을 조회할 수 없습니다!');
      return null;
    }

    const dailyData = await getDailyData(symbol, 'full');

    console.log(`📊 Daily data entries:`, dailyData ? dailyData.length : 0);
    
    if (!dailyData || dailyData.length === 0) {
      console.warn(`⚠️ No daily data found for ${symbol}`);
      console.warn('가능한 원인:');
      console.warn('1. API 키가 유효하지 않음');
      console.warn('2. API 호출 제한 초과 (5 req/min, 500 req/day)');
      console.warn('3. 잘못된 심볼');
      return null;
    }
    
    // Find the exact date or the closest previous trading day
    const targetDate = new Date(date);
    let closestDate: string | null = null;
    let closestDiff = Infinity;
    
    for (const entry of dailyData) {
      const entryDate = new Date(entry.date);
      const diff = targetDate.getTime() - entryDate.getTime();
      
      // Only consider dates on or before the target date
      if (diff >= 0 && diff < closestDiff) {
        closestDiff = diff;
        closestDate = entry.date;
      }
    }
    
    if (closestDate) {
      const priceEntry = dailyData.find((entry: { date: string; open: number; close: number }) => entry.date === closestDate);
      if (priceEntry) {
        let price: number;
        
        // 구매 방식에 따른 가격 결정
        if (normalizedMethod === 'auto') {
          // 자동 구매: 시장가 매수 시뮬레이션 (시가 + 종가) / 2
          if (priceEntry.open && priceEntry.close) {
            price = (priceEntry.open + priceEntry.close) / 2;
            console.log(`✅ Auto purchase - Average price for ${symbol} on ${closestDate}: $${price.toFixed(2)} (Open: $${priceEntry.open}, Close: $${priceEntry.close})`);
          } else {
            price = priceEntry.close || priceEntry.open;
            console.log(`✅ Auto purchase - Fallback price for ${symbol} on ${closestDate}: $${price.toFixed(2)}`);
          }
        } else {
          // 수동 구매: 종가 우선, 없으면 시가
          if (priceEntry.close) {
            price = priceEntry.close;
            console.log(`✅ Manual purchase - Close price for ${symbol} on ${closestDate}: $${price.toFixed(2)}`);
          } else if (priceEntry.open) {
            price = priceEntry.open;
            console.log(`✅ Manual purchase - Open price for ${symbol} on ${closestDate}: $${price.toFixed(2)}`);
          } else {
            console.warn(`⚠️ No price data available for ${symbol} on ${closestDate}`);
            return null;
          }
        }
        
        return price;
      }
    }
    
    console.warn(`⚠️ No price found for ${symbol} on or before ${date}`);
    return null;
  } catch (error) {
    console.error('Error fetching historical price:', error);
    return null;
  }
}

async function getKoreanHistoricalPrice(
  symbol: string,
  date: string,
  purchaseMethod: 'manual' | 'auto'
): Promise<number | null> {
  const candidates = buildKoreanSymbolCandidates(symbol);
  const targetDate = new Date(`${date}T00:00:00Z`);
  const periodEnd = Math.floor(targetDate.getTime() / 1000) + 2 * 24 * 60 * 60; // target day + buffer
  const periodStart = periodEnd - 10 * 24 * 60 * 60; // 10 days window

  for (const candidate of candidates) {
    try {
      const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${candidate}`, {
        params: {
          period1: periodStart,
          period2: periodEnd,
          interval: '1d',
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PriceFetcher/1.0)',
        },
      });

      const result = response.data?.chart?.result?.[0];
      if (!result || !Array.isArray(result.timestamp) || result.timestamp.length === 0) {
        continue;
      }

      const quotes = result.indicators?.quote?.[0];
      if (!quotes) {
        continue;
      }

      const targetKey = targetDate.toISOString().slice(0, 10);
      let chosenIndex = -1;

      for (let i = 0; i < result.timestamp.length; i += 1) {
        const ts = result.timestamp[i];
        const dateKey = formatDateKST(ts);
        if (dateKey === targetKey) {
          chosenIndex = i;
          break;
        }
        if (dateKey < targetKey) {
          chosenIndex = i; // keep closest previous trading day
        }
      }

      if (chosenIndex === -1) {
        continue;
      }

      const open = quotes.open?.[chosenIndex];
      const close = quotes.close?.[chosenIndex];

      if (purchaseMethod === 'auto') {
        if (Number.isFinite(open) && Number.isFinite(close)) {
          return ((open as number) + (close as number)) / 2;
        }
        if (Number.isFinite(close)) {
          return close as number;
        }
        if (Number.isFinite(open)) {
          return open as number;
        }
      } else {
        if (Number.isFinite(close)) {
          return close as number;
        }
        if (Number.isFinite(open)) {
          return open as number;
        }
      }
    } catch (error) {
      console.error(`Yahoo price fetch failed for ${candidate}:`, error);
    }
  }

  console.warn(`⚠️ Unable to fetch Korean historical price for ${symbol} on ${date}`);
  return null;
}

function subtractOneDay(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function getHistoricalExchangeRate(
  date: string,
  fromSymbol = 'USD',
  toSymbol = 'KRW'
): Promise<number | null> {
  const normalizedDate = date.slice(0, 10);
  const cacheKey = `fx-series-${fromSymbol}-${toSymbol}`;

  try {
    let series: Record<string, any> | null = null;
    const cachedSeries = cache.get(cacheKey);

    if (cachedSeries && Date.now() - cachedSeries.timestamp < FX_SERIES_CACHE_DURATION) {
      series = cachedSeries.data as Record<string, any>;
    } else {
      if (!ALPHA_VANTAGE_API_KEY) {
        console.warn('❌ Alpha Vantage API 키가 없어 환율을 조회할 수 없습니다.');
        return null;
      }

      const response = await axios.get(BASE_URL, {
        params: {
          function: 'FX_DAILY',
          from_symbol: fromSymbol,
          to_symbol: toSymbol,
          outputsize: 'full',
          apikey: ALPHA_VANTAGE_API_KEY,
        },
        timeout: 10000,
      });

      if (response.data['Error Message']) {
        console.error('❌ Alpha Vantage FX Error:', response.data['Error Message']);
        return null;
      }

      if (response.data['Note']) {
        console.error('⚠️ Alpha Vantage FX Rate Limit:', response.data['Note']);
        return null;
      }

      const rawSeries = response.data['Time Series FX (Daily)'];
      if (!rawSeries) {
        console.warn('⚠️ 환율 데이터가 응답에 없습니다.');
        return null;
      }

      series = rawSeries as Record<string, any>;
      cache.set(cacheKey, { data: series, timestamp: Date.now() });
    }

    if (!series) {
      return null;
    }

    let lookupDate = normalizedDate;
    let attempts = 0;

    while (!series[lookupDate] && attempts < 10) {
      lookupDate = subtractOneDay(lookupDate);
      attempts += 1;
    }

    const entry = series[lookupDate];
    if (!entry) {
      console.warn(`⚠️ ${normalizedDate} 이전 10일 이내 환율 데이터를 찾지 못했습니다.`);
      return null;
    }

    const close = parseFloat(entry['4. close']);
    if (Number.isFinite(close)) {
      return close;
    }

    const open = parseFloat(entry['1. open']);
    if (Number.isFinite(open)) {
      return open;
    }

    console.warn(`⚠️ ${lookupDate} 환율 데이터에 유효한 값이 없습니다.`);
    return null;
  } catch (error) {
    console.error('Error fetching historical exchange rate:', error);
    return null;
  }
}

/**
 * Clear the cache (useful for testing or forced refresh)
 */
export function clearCache() {
  cache.clear();
}
