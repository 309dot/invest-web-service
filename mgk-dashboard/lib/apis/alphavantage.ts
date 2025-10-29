import axios from 'axios';
import { PriceData } from '@/types';

const ALPHA_VANTAGE_API_KEY = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY || '';
const BASE_URL = 'https://www.alphavantage.co/query';

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
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: symbol,
        outputsize: outputsize,
        apikey: ALPHA_VANTAGE_API_KEY,
      },
      timeout: 10000,
    });

    const timeSeries = response.data['Time Series (Daily)'];

    if (!timeSeries) {
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
 */
export async function getHistoricalPrice(symbol: string, date: string): Promise<number | null> {
  try {
    const dailyData = await getDailyData(symbol, 'full');
    
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
      const priceEntry = dailyData.find((entry: { date: string; close: number }) => entry.date === closestDate);
      return priceEntry ? priceEntry.close : null;
    }
    
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
