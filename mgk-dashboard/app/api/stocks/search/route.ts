import { NextRequest, NextResponse } from 'next/server';
import type { Stock } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { searchKoreanStocks as searchYahooKR } from '@/lib/apis/yahoo-finance';

// Alpha Vantage API를 사용한 주식 검색
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY || 'demo';
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

// 캐시 (5분)
const searchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5분

interface AlphaVantageSearchResult {
  '1. symbol': string;
  '2. name': string;
  '3. type': string;
  '4. region': string;
  '5. marketOpen': string;
  '6. marketClose': string;
  '7. timezone': string;
  '8. currency': string;
  '9. matchScore': string;
}

/**
 * Alpha Vantage 검색 결과를 Stock 타입으로 변환
 */
function mapAlphaVantageToStock(result: AlphaVantageSearchResult): Omit<Stock, 'id'> {
  const symbol = result['1. symbol'];
  const name = result['2. name'];
  const type = result['3. type'].toLowerCase();
  const region = result['4. region'];
  const currency = result['8. currency'];

  // 자산 유형 결정
  let assetType: Stock['assetType'] = 'stock';
  if (type.includes('etf')) {
    assetType = 'etf';
  } else if (type.includes('reit')) {
    assetType = 'reit';
  } else if (type.includes('fund')) {
    assetType = 'fund';
  }

  // 시장 결정
  let market: Stock['market'] = 'US';
  if (region.includes('Korea')) {
    market = 'KR';
  } else if (region.includes('United States')) {
    market = 'US';
  } else {
    market = 'GLOBAL';
  }

  // 섹터는 나중에 추가 API 호출로 가져올 수 있음
  return {
    symbol,
    name,
    market,
    assetType,
    currency: currency === 'KRW' ? 'KRW' : 'USD',
    exchange: region,
    description: `${name} (${symbol})`,
    searchCount: 0,
    createdAt: Timestamp.now(),
  };
}

/**
 * Alpha Vantage API로 주식 검색
 */
async function searchAlphaVantage(keyword: string): Promise<Omit<Stock, 'id'>[]> {
  // 캐시 확인
  const cacheKey = `search:${keyword.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const url = new URL(ALPHA_VANTAGE_BASE_URL);
    url.searchParams.append('function', 'SYMBOL_SEARCH');
    url.searchParams.append('keywords', keyword);
    url.searchParams.append('apikey', ALPHA_VANTAGE_API_KEY);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }

    const data = await response.json();

    // API 제한 확인
    if (data.Note) {
      console.warn('Alpha Vantage API rate limit reached');
      return [];
    }

    const matches = data.bestMatches || [];
    const stocks = matches
      .slice(0, 10) // 상위 10개만
      .map((match: AlphaVantageSearchResult) => mapAlphaVantageToStock(match));

    // 캐시 저장
    searchCache.set(cacheKey, { data: stocks, timestamp: Date.now() });

    return stocks;
  } catch (error) {
    console.error('Alpha Vantage search error:', error);
    return [];
  }
}

/**
 * 한국 주식 검색 (Yahoo Finance API 사용)
 */
async function searchKoreanStocks(keyword: string): Promise<Omit<Stock, 'id'>[]> {
  try {
    const yahooResults = await searchYahooKR(keyword);
    
    // Yahoo Finance 결과를 Stock 타입으로 변환
    return yahooResults.map((result: any) => ({
      symbol: result.symbol,
      name: result.name,
      market: 'KR',
      assetType: result.assetType === 'ETF' ? 'etf' : 'stock',
      sector: result.sector || '미분류',
      currency: 'KRW',
      exchange: result.exchange,
      description: `${result.name} (${result.symbol})`,
      searchCount: 0,
      createdAt: Timestamp.now(),
    }));
  } catch (error) {
    console.error('Korean stock search error:', error);
    return [];
  }
}

/**
 * 인기 종목 (자주 검색되는 종목)
 */
function getPopularStocks(): Omit<Stock, 'id'>[] {
  return [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      market: 'US',
      assetType: 'stock',
      sector: 'technology',
      currency: 'USD',
      exchange: 'NASDAQ',
      description: 'Apple Inc. - 아이폰, 맥, 아이패드 제조사',
      searchCount: 1000,
      createdAt: Timestamp.now(),
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      market: 'US',
      assetType: 'stock',
      sector: 'technology',
      currency: 'USD',
      exchange: 'NASDAQ',
      description: 'Microsoft Corporation - 소프트웨어 및 클라우드 서비스',
      searchCount: 950,
      createdAt: Timestamp.now(),
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      market: 'US',
      assetType: 'stock',
      sector: 'technology',
      currency: 'USD',
      exchange: 'NASDAQ',
      description: 'Alphabet Inc. - Google 모회사',
      searchCount: 900,
      createdAt: Timestamp.now(),
    },
    {
      symbol: 'TSLA',
      name: 'Tesla Inc.',
      market: 'US',
      assetType: 'stock',
      sector: 'consumer',
      currency: 'USD',
      exchange: 'NASDAQ',
      description: 'Tesla Inc. - 전기차 및 에너지 솔루션',
      searchCount: 850,
      createdAt: Timestamp.now(),
    },
    {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      market: 'US',
      assetType: 'stock',
      sector: 'technology',
      currency: 'USD',
      exchange: 'NASDAQ',
      description: 'NVIDIA Corporation - GPU 및 AI 칩 제조사',
      searchCount: 800,
      createdAt: Timestamp.now(),
    },
    {
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF Trust',
      market: 'US',
      assetType: 'etf',
      sector: 'other',
      currency: 'USD',
      exchange: 'NYSE',
      description: 'SPDR S&P 500 ETF Trust - S&P 500 지수 추종 ETF',
      searchCount: 750,
      createdAt: Timestamp.now(),
    },
    {
      symbol: 'QQQ',
      name: 'Invesco QQQ Trust',
      market: 'US',
      assetType: 'etf',
      sector: 'technology',
      currency: 'USD',
      exchange: 'NASDAQ',
      description: 'Invesco QQQ Trust - 나스닥 100 지수 추종 ETF',
      searchCount: 700,
      createdAt: Timestamp.now(),
    },
    {
      symbol: '005930',
      name: '삼성전자',
      market: 'KR',
      assetType: 'stock',
      sector: 'technology',
      currency: 'KRW',
      exchange: 'KOSPI',
      description: '삼성전자 - 대한민국 대표 전자 기업',
      searchCount: 650,
      createdAt: Timestamp.now(),
    },
  ];
}

/**
 * GET /api/stocks/search
 * 
 * Query Parameters:
 * - q: 검색 키워드 (필수)
 * - market: 시장 필터 (US, KR, GLOBAL) - 선택
 * - type: 자산 유형 필터 (stock, etf, reit, fund) - 선택
 * - popular: 인기 종목만 반환 (true/false) - 선택
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const marketFilter = searchParams.get('market') as Stock['market'] | null;
    const typeFilter = searchParams.get('type') as Stock['assetType'] | null;
    const popularOnly = searchParams.get('popular') === 'true';

    // 인기 종목 요청
    if (popularOnly) {
      let results = getPopularStocks();

      // 필터 적용
      if (marketFilter) {
        results = results.filter((stock) => stock.market === marketFilter);
      }
      if (typeFilter) {
        results = results.filter((stock) => stock.assetType === typeFilter);
      }

      return NextResponse.json({
        success: true,
        data: results,
        count: results.length,
        source: 'popular',
      });
    }

    // 검색 키워드 필수
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Search query is required' },
        { status: 400 }
      );
    }

    // 너무 짧은 키워드
    if (query.trim().length < 1) {
      return NextResponse.json(
        { success: false, error: 'Search query too short' },
        { status: 400 }
      );
    }

    // 병렬로 미국/한국 주식 검색
    const [usStocks, krStocks] = await Promise.all([
      searchAlphaVantage(query),
      searchKoreanStocks(query),
    ]);

    // 결과 합치기
    let allStocks = [...usStocks, ...krStocks];

    // 필터 적용
    if (marketFilter) {
      allStocks = allStocks.filter((stock) => stock.market === marketFilter);
    }
    if (typeFilter) {
      allStocks = allStocks.filter((stock) => stock.assetType === typeFilter);
    }

    // 중복 제거 (symbol 기준)
    const uniqueStocks = Array.from(
      new Map(allStocks.map((stock) => [stock.symbol, stock])).values()
    );

    return NextResponse.json({
      success: true,
      data: uniqueStocks,
      count: uniqueStocks.length,
      query,
      filters: {
        market: marketFilter,
        type: typeFilter,
      },
    });
  } catch (error) {
    console.error('Stock search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

