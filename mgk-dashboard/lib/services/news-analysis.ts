/**
 * 뉴스 분석 서비스
 * 
 * 보유 종목 관련성, 영향도, 감성 분석
 */

import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit, addDoc, Timestamp } from 'firebase/firestore';
import type { Position } from '@/types';

export interface NewsItem {
  id?: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  relatedSymbols?: string[];
  relevanceScore?: number;
  impactLevel?: 'high' | 'medium' | 'low';
  sentiment?: 'positive' | 'negative' | 'neutral';
  sentimentScore?: number; // -1 to 1
  keywords?: string[];
  category?: string;
}

export interface PersonalizedNews extends NewsItem {
  personalRelevance: number; // 0-100
  affectedPositions: {
    symbol: string;
    portfolioWeight: number;
    estimatedImpact: 'high' | 'medium' | 'low';
  }[];
  reason: string;
}

/**
 * 뉴스와 종목의 관련성 점수 계산
 */
export function calculateRelevanceScore(
  newsItem: NewsItem,
  symbol: string
): number {
  let score = 0;
  
  const titleLower = newsItem.title.toLowerCase();
  const descLower = newsItem.description?.toLowerCase() || '';
  const symbolLower = symbol.toLowerCase();
  
  // 티커 심볼이 제목에 있으면 높은 점수
  if (titleLower.includes(symbolLower)) {
    score += 50;
  }
  
  // 티커 심볼이 설명에 있으면 중간 점수
  if (descLower.includes(symbolLower)) {
    score += 30;
  }
  
  // 관련 심볼 목록에 있으면
  if (newsItem.relatedSymbols?.includes(symbol)) {
    score += 40;
  }
  
  // 키워드 매칭
  if (newsItem.keywords) {
    const keywordMatch = newsItem.keywords.some(
      keyword => keyword.toLowerCase() === symbolLower
    );
    if (keywordMatch) {
      score += 20;
    }
  }
  
  return Math.min(score, 100);
}

/**
 * 뉴스의 감성 분석 (간단한 키워드 기반)
 */
export function analyzeSentiment(newsItem: NewsItem): {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
} {
  const text = `${newsItem.title} ${newsItem.description || ''}`.toLowerCase();
  
  const positiveWords = [
    'surge', 'soar', 'gain', 'profit', 'growth', 'beat', 'exceed',
    'positive', 'bullish', 'rally', 'upgrade', 'strong', 'record',
    '상승', '급등', '호실적', '성장', '증가', '긍정', '강세'
  ];
  
  const negativeWords = [
    'fall', 'drop', 'loss', 'decline', 'miss', 'warning', 'negative',
    'bearish', 'downgrade', 'weak', 'concern', 'risk', 'crash',
    '하락', '급락', '손실', '감소', '부정', '약세', '우려'
  ];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    if (text.includes(word)) positiveCount++;
  });
  
  negativeWords.forEach(word => {
    if (text.includes(word)) negativeCount++;
  });
  
  const totalWords = positiveCount + negativeCount;
  
  if (totalWords === 0) {
    return { sentiment: 'neutral', score: 0 };
  }
  
  const score = (positiveCount - negativeCount) / totalWords;
  
  if (score > 0.2) {
    return { sentiment: 'positive', score };
  } else if (score < -0.2) {
    return { sentiment: 'negative', score };
  } else {
    return { sentiment: 'neutral', score };
  }
}

/**
 * 영향도 수준 결정
 */
export function determineImpactLevel(
  relevanceScore: number,
  sentimentScore: number
): 'high' | 'medium' | 'low' {
  const combinedScore = relevanceScore * Math.abs(sentimentScore);
  
  if (combinedScore > 50) return 'high';
  if (combinedScore > 20) return 'medium';
  return 'low';
}

/**
 * 개인화된 뉴스 분석
 */
export async function analyzePersonalizedNews(
  newsItems: NewsItem[],
  positions: Position[]
): Promise<PersonalizedNews[]> {
  if (positions.length === 0) {
    return [];
  }
  
  const totalPortfolioValue = positions.reduce((sum, p) => sum + p.totalValue, 0);
  
  const personalizedNews: PersonalizedNews[] = [];
  
  for (const news of newsItems) {
    let maxRelevance = 0;
    const affectedPositions: PersonalizedNews['affectedPositions'] = [];
    
    // 각 포지션과의 관련성 계산
    for (const position of positions) {
      const relevance = calculateRelevanceScore(news, position.symbol);
      
      if (relevance > 10) { // 최소 관련성 임계값
        const portfolioWeight = totalPortfolioValue > 0 
          ? (position.totalValue / totalPortfolioValue) * 100 
          : 0;
        
        const sentiment = news.sentiment 
          ? { sentiment: news.sentiment, score: news.sentimentScore || 0 }
          : analyzeSentiment(news);
        
        const impactLevel = determineImpactLevel(relevance, sentiment.score);
        
        affectedPositions.push({
          symbol: position.symbol,
          portfolioWeight,
          estimatedImpact: impactLevel,
        });
        
        // 보유 비중을 고려한 개인 관련성
        const weightedRelevance = relevance * (portfolioWeight / 100);
        maxRelevance = Math.max(maxRelevance, weightedRelevance);
      }
    }
    
    if (affectedPositions.length > 0) {
      // 여러 종목 영향 시 가중치 보너스
      const multiStockBonus = Math.min(affectedPositions.length * 5, 20);
      maxRelevance = Math.min(maxRelevance + multiStockBonus, 100);
      
      const sentiment = news.sentiment 
        ? { sentiment: news.sentiment, score: news.sentimentScore || 0 }
        : analyzeSentiment(news);
      
      personalizedNews.push({
        ...news,
        sentiment: sentiment.sentiment,
        sentimentScore: sentiment.score,
        personalRelevance: maxRelevance,
        affectedPositions,
        reason: generateRelevanceReason(affectedPositions, sentiment.sentiment),
      });
    }
  }
  
  // 개인 관련성 순으로 정렬
  return personalizedNews.sort((a, b) => b.personalRelevance - a.personalRelevance);
}

/**
 * 관련성 이유 생성
 */
function generateRelevanceReason(
  affectedPositions: PersonalizedNews['affectedPositions'],
  sentiment: 'positive' | 'negative' | 'neutral'
): string {
  const symbols = affectedPositions.map(p => p.symbol).join(', ');
  const highImpact = affectedPositions.filter(p => p.estimatedImpact === 'high').length;
  
  if (affectedPositions.length === 1) {
    return `${symbols} 보유 종목 관련 뉴스`;
  }
  
  if (highImpact > 0) {
    return `${symbols} 등 ${affectedPositions.length}개 보유 종목에 높은 영향 예상`;
  }
  
  return `${symbols} 등 ${affectedPositions.length}개 보유 종목 관련`;
}

/**
 * 뉴스 저장 (캐싱 및 이력)
 */
export async function saveNewsItem(
  newsItem: NewsItem
): Promise<string> {
  const newsRef = collection(db, 'newsItems');
  
  const newsData = {
    ...newsItem,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(newsRef, newsData);
  return docRef.id;
}

/**
 * 최근 뉴스 조회
 */
export async function getRecentNews(
  limitCount: number = 50,
  category?: string
): Promise<NewsItem[]> {
  const newsRef = collection(db, 'newsItems');
  
  let q = query(
    newsRef,
    orderBy('publishedAt', 'desc'),
    limit(limitCount)
  );
  
  if (category) {
    q = query(
      newsRef,
      where('category', '==', category),
      orderBy('publishedAt', 'desc'),
      limit(limitCount)
    );
  }
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as NewsItem));
}

/**
 * 종목별 뉴스 조회
 */
export async function getNewsForSymbol(
  symbol: string,
  limitCount: number = 20
): Promise<NewsItem[]> {
  const newsRef = collection(db, 'newsItems');
  
  const q = query(
    newsRef,
    where('relatedSymbols', 'array-contains', symbol),
    orderBy('publishedAt', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as NewsItem));
}

/**
 * 북마크된 뉴스 조회
 */
export async function getBookmarkedNews(
  userId: string
): Promise<NewsItem[]> {
  const bookmarksRef = collection(db, `users/${userId}/bookmarkedNews`);
  
  const q = query(
    bookmarksRef,
    orderBy('bookmarkedAt', 'desc'),
    limit(50)
  );
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as NewsItem));
}

/**
 * 뉴스 북마크 추가/제거
 */
export async function toggleBookmark(
  userId: string,
  newsItem: NewsItem
): Promise<boolean> {
  const bookmarkRef = collection(db, `users/${userId}/bookmarkedNews`);
  
  // 이미 북마크되어 있는지 확인
  const q = query(bookmarkRef, where('url', '==', newsItem.url));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    // 북마크 추가
    await addDoc(bookmarkRef, {
      ...newsItem,
      bookmarkedAt: Timestamp.now(),
    });
    return true;
  } else {
    // 북마크 제거
    const docToDelete = snapshot.docs[0];
    await docToDelete.ref.delete();
    return false;
  }
}

