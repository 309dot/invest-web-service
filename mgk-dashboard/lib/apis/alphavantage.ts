import axios from 'axios';
import { PriceData } from '@/types';

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
    };

    // Cache the result
    cache.set(cacheKey, { data: priceData, timestamp: Date.now() });

    return priceData;
  } catch (error) {
    console.error('Error fetching price from Alpha Vantage:', error);

    // If API fails, try to return cached data even if expired
    if (cached) {
      console.warn('Returning expired cache data due to API error');
      return cached.data;
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
  purchaseMethod?: 'manual' | 'auto'
): Promise<number | null> {
  try {
    console.log(`🔍 Fetching historical price for ${symbol} on ${date} (method: ${purchaseMethod || 'manual'})`);
    
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
        if (purchaseMethod === 'auto') {
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

/**
 * Clear the cache (useful for testing or forced refresh)
 */
export function clearCache() {
  cache.clear();
}
