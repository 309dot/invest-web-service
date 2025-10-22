import axios from 'axios';
import { ExchangeRateData } from '@/types';

const EXCHANGE_RATE_API_KEY = process.env.NEXT_PUBLIC_EXCHANGE_RATE_API_KEY || '';
const BASE_URL = 'https://v6.exchangerate-api.com/v6';

// Cache for API responses (5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get USD to KRW exchange rate
 */
export async function getExchangeRate(from: string = 'USD', to: string = 'KRW'): Promise<ExchangeRateData> {
  const cacheKey = `rate-${from}-${to}`;
  const cached = cache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await axios.get(`${BASE_URL}/${EXCHANGE_RATE_API_KEY}/pair/${from}/${to}`, {
      timeout: 10000,
    });

    if (response.data.result !== 'success') {
      throw new Error('Exchange rate API returned error');
    }

    const rateData: ExchangeRateData = {
      base: from,
      target: to,
      rate: response.data.conversion_rate,
      timestamp: new Date(),
    };

    // Cache the result
    cache.set(cacheKey, { data: rateData, timestamp: Date.now() });

    return rateData;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);

    // If API fails, try to return cached data even if expired
    if (cached) {
      console.warn('Returning expired cache data due to API error');
      return cached.data;
    }

    // Fallback to a default rate if all else fails
    console.warn('Using fallback exchange rate');
    return {
      base: from,
      target: to,
      rate: 1340, // Fallback rate
      timestamp: new Date(),
    };
  }
}

/**
 * Get multiple exchange rates at once
 */
export async function getMultipleRates(base: string, targets: string[]) {
  const cacheKey = `rates-${base}-${targets.join(',')}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await axios.get(`${BASE_URL}/${EXCHANGE_RATE_API_KEY}/latest/${base}`, {
      timeout: 10000,
    });

    if (response.data.result !== 'success') {
      throw new Error('Exchange rate API returned error');
    }

    const rates: { [key: string]: number } = {};
    targets.forEach(target => {
      if (response.data.conversion_rates[target]) {
        rates[target] = response.data.conversion_rates[target];
      }
    });

    const rateData = {
      base: base,
      rates: rates,
      timestamp: new Date(),
    };

    cache.set(cacheKey, { data: rateData, timestamp: Date.now() });

    return rateData;
  } catch (error) {
    console.error('Error fetching multiple exchange rates:', error);

    if (cached) {
      return cached.data;
    }

    throw new Error('Failed to fetch exchange rates');
  }
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(amount: number, from: string, to: string): Promise<number> {
  try {
    const rateData = await getExchangeRate(from, to);
    return amount * rateData.rate;
  } catch (error) {
    console.error('Error converting currency:', error);
    throw new Error('Failed to convert currency');
  }
}

/**
 * Get historical exchange rates (if needed)
 */
export async function getHistoricalRate(date: string, from: string = 'USD', to: string = 'KRW') {
  // Note: Historical rates may require a paid plan on some APIs
  // This is a placeholder for future implementation
  console.warn('Historical rates not implemented yet');
  return null;
}

/**
 * Clear the cache
 */
export function clearCache() {
  cache.clear();
}
