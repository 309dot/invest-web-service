import axios from 'axios';

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
      .map((quote: any) => ({
        symbol: quote.symbol.replace(/\.(KS|KQ)$/, ''), // Remove exchange suffix
        name: quote.longname || quote.shortname || quote.symbol,
        market: 'KR',
        exchange: quote.exchDisp || (quote.symbol.endsWith('.KS') ? 'KOSPI' : 'KOSDAQ'),
        assetType: quote.quoteType === 'ETF' ? 'ETF' : 'Stock',
        sector: quote.sector || '미분류',
        currency: 'KRW',
      }));

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

