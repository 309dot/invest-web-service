"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  RefreshCw,
  Bookmark,
  Filter,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { formatRelativeDate } from '@/lib/utils/formatters';
import type { PersonalizedNews } from '@/lib/services/news-analysis';

export default function NewsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [news, setNews] = useState<PersonalizedNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  const [selectedImpact, setSelectedImpact] = useState<string>('all');
  const [selectedNews, setSelectedNews] = useState<PersonalizedNews | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchNews = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/news/personalized?userId=${user.uid}&portfolioId=main`);
      
      if (response.ok) {
        const data = await response.json();
        setNews(data.news || []);
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNews();
    }
  }, [user]);

  // 필터링된 뉴스
  const filteredNews = news.filter(item => {
    if (selectedSymbol !== 'all') {
      const hasSymbol = item.affectedPositions.some(p => p.symbol === selectedSymbol);
      if (!hasSymbol) return false;
    }

    if (selectedSentiment !== 'all' && item.sentiment !== selectedSentiment) {
      return false;
    }

    if (selectedImpact !== 'all') {
      const hasImpact = item.affectedPositions.some(p => p.estimatedImpact === selectedImpact);
      if (!hasImpact) return false;
    }

    return true;
  });

  // 심볼 목록 추출
  const symbols = Array.from(new Set(news.flatMap(item => 
    item.affectedPositions.map(p => p.symbol)
  )));

  // 감성 아이콘
  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  // 감성 배지
  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <Badge variant="default" className="bg-green-500">긍정</Badge>;
      case 'negative':
        return <Badge variant="destructive">부정</Badge>;
      default:
        return <Badge variant="outline">중립</Badge>;
    }
  };

  // 영향도 배지
  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'high':
        return <Badge variant="destructive">높음</Badge>;
      case 'medium':
        return <Badge variant="default">중간</Badge>;
      default:
        return <Badge variant="outline">낮음</Badge>;
    }
  };

  if (authLoading || !user) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Newspaper className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">개인화 뉴스</h1>
                <p className="text-muted-foreground">보유 종목 관련 최신 뉴스</p>
              </div>
            </div>
            <Button onClick={fetchNews} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </div>

          {/* 필터 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                필터
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 종목 필터 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">종목</label>
                  <select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="all">전체</option>
                    {symbols.map(symbol => (
                      <option key={symbol} value={symbol}>{symbol}</option>
                    ))}
                  </select>
                </div>

                {/* 감성 필터 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">감성</label>
                  <select
                    value={selectedSentiment}
                    onChange={(e) => setSelectedSentiment(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="all">전체</option>
                    <option value="positive">긍정</option>
                    <option value="neutral">중립</option>
                    <option value="negative">부정</option>
                  </select>
                </div>

                {/* 영향도 필터 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">영향도</label>
                  <select
                    value={selectedImpact}
                    onChange={(e) => setSelectedImpact(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="all">전체</option>
                    <option value="high">높음</option>
                    <option value="medium">중간</option>
                    <option value="low">낮음</option>
                  </select>
                </div>
              </div>

              {/* 필터 초기화 */}
              {(selectedSymbol !== 'all' || selectedSentiment !== 'all' || selectedImpact !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSymbol('all');
                    setSelectedSentiment('all');
                    setSelectedImpact('all');
                  }}
                  className="mt-4"
                >
                  필터 초기화
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 뉴스 목록 */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredNews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground mb-2">
                  {news.length === 0 ? '뉴스가 없습니다.' : '필터 조건에 맞는 뉴스가 없습니다.'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {news.length === 0 
                    ? '포트폴리오에 종목을 추가하면 관련 뉴스를 받아볼 수 있습니다.'
                    : '다른 필터 조건을 선택해보세요.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredNews.map((item, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* 제목 */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNews(item);
                            setIsModalOpen(true);
                          }}
                          className="text-left w-full"
                        >
                          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 hover:text-primary">
                            {getSentimentIcon(item.sentiment || 'neutral')}
                            {item.title}
                          </h3>
                        </button>

                        {/* 설명 */}
                        {(item.summary || item.description) && (
                          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                            {item.summary || item.description}
                          </p>
                        )}

                        {/* 메타 정보 */}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="text-xs text-muted-foreground">
                            {item.source} • {formatRelativeDate(item.publishedAt)}
                          </span>
                          {getSentimentBadge(item.sentiment || 'neutral')}
                          <Badge variant="outline">
                            관련성: {item.personalRelevance.toFixed(0)}%
                          </Badge>
                        </div>

                        {/* 영향받는 종목 */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium">영향 종목:</span>
                          {item.affectedPositions.map((pos, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <Badge variant="secondary">{pos.symbol}</Badge>
                              {getImpactBadge(pos.estimatedImpact)}
                            </div>
                          ))}
                        </div>

                        {/* 이유 */}
                        <p className="text-xs text-muted-foreground mt-2">
                          {item.reason}
                        </p>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(item.url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                        >
                          <Bookmark className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 결과 카운트 */}
          {!loading && filteredNews.length > 0 && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              총 {filteredNews.length}개의 뉴스 (전체 {news.length}개 중)
            </div>
          )}
        </main>
      </div>

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setSelectedNews(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getSentimentIcon(selectedNews?.sentiment || 'neutral')}
              {selectedNews?.title || '뉴스 상세'}
            </DialogTitle>
            <DialogDescription>
              {selectedNews?.source}
              {selectedNews ? ` • ${formatRelativeDate(selectedNews.publishedAt)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {selectedNews?.summary || '요약 정보를 불러오지 못했습니다.'}
            </p>
            {(selectedNews?.content || selectedNews?.description) && (
              <div className="rounded-md bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                {selectedNews?.content || selectedNews?.description}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium">영향 종목:</span>
              {selectedNews?.affectedPositions.map((pos, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <Badge variant="secondary">{pos.symbol}</Badge>
                  {getImpactBadge(pos.estimatedImpact)}
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-muted-foreground">
                개인화 점수: {selectedNews?.personalRelevance.toFixed(0)}%
              </span>
              {selectedNews?.url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedNews.url, '_blank')}
                >
                  원문 보기
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

