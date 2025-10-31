import axios from 'axios';
import { Timestamp } from 'firebase/firestore';

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
    
    const sectorMap: Record<string, string> = {
      technology: 'technology',
      tech: 'technology',
      healthcare: 'healthcare',
      health: 'healthcare',
      financial: 'financial',
      finance: 'financial',
      consumer: 'consumer',
      industrial: 'industrial',
      energy: 'energy',
      materials: 'materials',
      utilities: 'utilities',
      realestate: 'real-estate',
      communication: 'communication',
    };

    // Filter for Korean exchanges (KS = KOSPI, KQ = KOSDAQ)
    const koreanStocks = quotes
      .filter((quote: any) => {
        const symbol = quote.symbol || '';
        return symbol.endsWith('.KS') || symbol.endsWith('.KQ');
      })
      .map((quote: any) => {
        const rawSector = (quote.sector || '').toLowerCase().replace(/\s+/g, '');

        const shortName = quote.shortname || '';
        const longName = quote.longname || '';
        const hangulName = /[가-힣]/.test(shortName) ? shortName : /[가-힣]/.test(longName) ? longName : shortName || longName || quote.symbol;

        return {
          symbol: quote.symbol.replace(/\.(KS|KQ)$/, ''), // Remove exchange suffix
          name: hangulName || quote.symbol,
          market: 'KR' as const,
          exchange: quote.exchDisp || (quote.symbol.endsWith('.KS') ? 'KOSPI' : 'KOSDAQ'),
          assetType: quote.quoteType?.toLowerCase() === 'etf' ? 'etf' : 'stock',
          sector: sectorMap[rawSector] || 'other',
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

