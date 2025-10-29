/**
 * 개인화 뉴스 API
 * 
 * GET: 사용자 보유 종목 기반 개인화 뉴스 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { collectNewsForSymbols, type RSSNewsItem } from '@/lib/apis/news';
import { analyzePersonalizedNews, analyzeSentiment, type PersonalizedNews } from '@/lib/services/news-analysis';
import { getPortfolioPositions } from '@/lib/services/position';

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
    const symbols = positions.map(p => p.symbol);

    // 종목별 뉴스 수집
    const rawNews = await collectNewsForSymbols(symbols);

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

    return NextResponse.json({
      success: true,
      news: personalizedNews,
      portfolioSymbols: symbols,
      totalNews: personalizedNews.length,
    });
  } catch (error) {
    console.error('Personalized news error:', error);
    return NextResponse.json(
      { error: '개인화 뉴스 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

