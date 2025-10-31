export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 개인화 뉴스 API
 * 
 * GET: 사용자 보유 종목 기반 개인화 뉴스 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { collectNewsForSymbols, type SymbolNewsTarget } from '@/lib/apis/news';
import { analyzePersonalizedNews, analyzeSentiment } from '@/lib/services/news-analysis';
import { getPortfolioPositions } from '@/lib/services/position';

function summarizeContent(text?: string, maxSentences: number = 3): string {
  if (!text) {
    return '요약 정보를 불러오지 못했습니다.';
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '요약 정보를 불러오지 못했습니다.';
  }

  const delimiters = new Set(['.', '!', '?', '。', '？', '！']);
  const sentences: string[] = [];
  let buffer = '';

  for (const char of normalized) {
    buffer += char;

    if (delimiters.has(char)) {
      const trimmed = buffer.trim();
      if (trimmed) {
        sentences.push(trimmed);
      }
      buffer = '';

      if (sentences.length >= maxSentences) {
        break;
      }
    }
  }

  if (sentences.length < maxSentences) {
    const tail = buffer.trim();
    if (tail) {
      sentences.push(tail);
    }
  }

  if (sentences.length === 0) {
    return normalized;
  }

  return sentences.slice(0, maxSentences).join(' ');
}

/**
 * GET /api/news/personalized?userId=xxx&portfolioId=xxx
 * 보유 종목 기반 개인화 뉴스
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const portfolioId = searchParams.get('portfolioId') || 'main';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 포지션 조회
    const positions = await getPortfolioPositions(userId, portfolioId);

    if (positions.length === 0) {
      return NextResponse.json({
        success: true,
        news: [],
        message: '보유 종목이 없습니다. 종목을 추가해주세요.',
      });
    }

    // 보유 종목 심볼 추출
    const symbolTargets: SymbolNewsTarget[] = positions.map((position) => ({
      symbol: position.symbol,
      displayName: position.name,
      keywords: [
        position.name,
        `${position.name} ${position.symbol}`,
        position.market === 'KR' ? `${position.name} 주가` : `${position.name} stock`,
        position.market === 'KR' ? `${position.name} 뉴스` : `${position.name} news`,
      ],
    }));

    // 종목별 뉴스 수집 (한국어 우선, 결과가 없으면 영어로 재시도)
    let rawNews = await collectNewsForSymbols(symbolTargets, 'ko');
    if (rawNews.length === 0) {
      rawNews = await collectNewsForSymbols(symbolTargets, 'en');
    }

    // 감성 분석 추가
    const newsWithSentiment = rawNews.map(news => {
      const sentiment = analyzeSentiment({
        title: news.title,
        description: news.description || '',
        url: news.link,
        source: news.source,
        publishedAt: news.pubDate.toISOString(),
      });

      return {
        title: news.title,
        description: news.description || '',
        url: news.link,
        source: news.source,
        publishedAt: news.pubDate.toISOString(),
        relatedSymbols: news.relatedSymbols || [],
        keywords: news.keywords || [],
        category: news.category || 'general',
        sentiment: sentiment.sentiment,
        sentimentScore: sentiment.score,
      };
    });

    // 개인화 분석
    const personalizedNews = await analyzePersonalizedNews(
      newsWithSentiment,
      positions
    );

    const enrichedNews = personalizedNews.map((item) => ({
      ...item,
      summary: summarizeContent(item.description),
    }));

    const symbols = positions.map(p => p.symbol);

    return NextResponse.json({
      success: true,
      news: enrichedNews,
      portfolioSymbols: symbols,
      totalNews: enrichedNews.length,
    });
  } catch (error) {
    console.error('Personalized news error:', error);
    return NextResponse.json(
      { error: '개인화 뉴스 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

