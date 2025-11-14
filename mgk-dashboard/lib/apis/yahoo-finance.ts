import axios from 'axios';
import { Timestamp } from 'firebase/firestore';
import type { Sector } from '@/types';
import { normalizeSector } from '@/lib/utils/sectors';

const BASE_URL = 'https://query2.finance.yahoo.com/v1';

// Cache for API responses (5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Search for Korean stocks/ETFs using Yahoo Finance
 */
export async function searchKoreanStocks(query: string): Promise<any[]> {
  const cacheKey = `search-kr-${query}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Yahoo Finance uses .KS for KOSPI and .KQ for KOSDAQ
    const response = await axios.get(`${BASE_URL}/finance/search`, {
      params: {
        q: query,
        quotesCount: 20,
        newsCount: 0,
        enableFuzzyQuery: false,
        quotesQueryId: 'tss_match_phrase_query',
        multiQuoteQueryId: 'multi_quote_single_token_query',
        enableCb: false,
        enableNavLinks: false,
        enableEnhancedTrivialQuery: false,
        lang: 'ko-KR',
      },
      timeout: 10000,
    });

    const quotes = response.data?.quotes || [];
    
    // Filter for Korean exchanges (KS = KOSPI, KQ = KOSDAQ)
    const koreanStocks = quotes
      .filter((quote: any) => {
        const symbol = quote.symbol || '';
        return symbol.endsWith('.KS') || symbol.endsWith('.KQ');
      })
      .map((quote: any) => {
        const shortName = quote.shortname || '';
        const longName = quote.longname || '';
        const hangulName = /[가-힣]/.test(shortName) ? shortName : /[가-힣]/.test(longName) ? longName : shortName || longName || quote.symbol;

        return {
          symbol: quote.symbol.replace(/\.(KS|KQ)$/, ''), // Remove exchange suffix
          name: hangulName || quote.symbol,
          market: 'KR' as const,
          exchange: quote.exchDisp || (quote.symbol.endsWith('.KS') ? 'KOSPI' : 'KOSDAQ'),
          assetType: quote.quoteType?.toLowerCase() === 'etf' ? 'etf' : 'stock',
          sector: normalizeSector(quote.sector),
          currency: 'KRW' as const,
          description: longName || shortName || quote.symbol,
          searchCount: 0,
          createdAt: Timestamp.now(),
        };
      });

    cache.set(cacheKey, { data: koreanStocks, timestamp: Date.now() });
    return koreanStocks;
  } catch (error) {
    console.error('Error searching Korean stocks:', error);
    
    if (cached) {
      console.warn('Returning expired cache data due to API error');
      return cached.data;
    }
    
    return [];
  }
}

/**
 * Get current price for Korean stock
 */
export async function getKoreanStockPrice(symbol: string): Promise<number | null> {
  try {
    // Add exchange suffix for Yahoo Finance
    const yahooSymbol = `${symbol}.KS`; // Try KOSPI first
    
    const response = await axios.get(`${BASE_URL}/finance/quote`, {
      params: {
        symbols: yahooSymbol,
      },
      timeout: 10000,
    });

    const quote = response.data?.quoteResponse?.result?.[0];
    
    if (!quote) {
      // Try KOSDAQ if KOSPI fails
      const kosdaqSymbol = `${symbol}.KQ`;
      const kosdaqResponse = await axios.get(`${BASE_URL}/finance/quote`, {
        params: {
          symbols: kosdaqSymbol,
        },
        timeout: 10000,
      });
      
      const kosdaqQuote = kosdaqResponse.data?.quoteResponse?.result?.[0];
      return kosdaqQuote?.regularMarketPrice || null;
    }
    
    return quote.regularMarketPrice || null;
  } catch (error) {
    console.error('Error fetching Korean stock price:', error);
    return null;
  }
}

/**
 * Clear the cache
 */
export function clearCache() {
  cache.clear();
}

type EtfSectorWeight = {
  sector: Sector;
  weight: number;
};

const ETF_SECTOR_CACHE = new Map<string, { data: EtfSectorWeight[] | null; timestamp: number }>();

function normalizeWeight(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value > 1) {
    return value / 100;
  }
  if (value < 0) {
    return 0;
  }
  return value;
}

async function fetchYahooSectorWeights(symbol: string): Promise<EtfSectorWeight[] | null> {
  try {
    const response = await axios.get(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}`,
      {
        params: { modules: 'topHoldings' },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (portfolio-analyzer)',
        },
      }
    );

    const sectorWeightings =
      response.data?.quoteSummary?.result?.[0]?.topHoldings?.sectorWeightings;

    if (!Array.isArray(sectorWeightings) || sectorWeightings.length === 0) {
      return null;
    }

    const weights: EtfSectorWeight[] = sectorWeightings
      .map((entry: Record<string, number>) => {
        const [key, raw] = Object.entries(entry)[0] ?? [];
        if (!key || raw === undefined || raw === null) {
          return null;
        }
        const sector = normalizeSector(key);
        const weight = normalizeWeight(Number(raw));
        if (weight <= 0) {
          return null;
        }
        return { sector, weight };
      })
      .filter((item): item is EtfSectorWeight => Boolean(item));

    if (weights.length === 0) {
      return null;
    }

    const total = weights.reduce((sum, item) => sum + item.weight, 0);
    if (total > 0 && Math.abs(total - 1) > 0.05) {
      return weights.map((item) => ({
        sector: item.sector,
        weight: item.weight / total,
      }));
    }

    if (total < 1 - 1e-3) {
      return [
        ...weights,
        { sector: 'other', weight: Math.max(0, 1 - total) },
      ];
    }

    return weights;
  } catch (error) {
    console.error('Error fetching ETF sector weights:', symbol, error);
    return null;
  }
}

export async function getEtfSectorWeights(symbol: string): Promise<EtfSectorWeight[] | null> {
  const cacheKey = symbol.toUpperCase();
  const cached = ETF_SECTOR_CACHE.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const candidates = symbol.includes('.')
    ? [symbol]
    : [symbol, `${symbol}.KS`, `${symbol}.KQ`];

  for (const candidate of candidates) {
    const weights = await fetchYahooSectorWeights(candidate);
    if (weights && weights.length > 0) {
      ETF_SECTOR_CACHE.set(cacheKey, { data: weights, timestamp: Date.now() });
      return weights;
    }
  }

  ETF_SECTOR_CACHE.set(cacheKey, { data: null, timestamp: Date.now() });
  return null;
}

