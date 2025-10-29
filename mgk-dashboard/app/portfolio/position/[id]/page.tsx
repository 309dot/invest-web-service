"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Edit2, Save, X, TrendingUp, TrendingDown, DollarSign, Calendar, Trash2 } from 'lucide-react';
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils/formatters';
import type { Position } from '@/types';

export default function PositionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const positionId = params.id as string;

  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 수정 가능한 필드
  const [editedData, setEditedData] = useState({
    shares: '',
    averagePrice: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && positionId) {
      fetchPosition();
    }
  }, [user, positionId]);

  const fetchPosition = async () => {
    try {
      setLoading(true);
      // TODO: API에서 특정 포지션 조회
      // 현재는 임시로 전체 포지션에서 찾기
      const response = await fetch(`/api/positions?portfolioId=main`);
      const data = await response.json();
      
      const found = data.positions?.find((p: Position) => p.id === positionId);
      if (found) {
        setPosition(found);
        setEditedData({
          shares: found.shares.toString(),
          averagePrice: found.averagePrice.toString(),
        });
      } else {
        setError('포지션을 찾을 수 없습니다.');
      }
    } catch (err) {
      console.error('Failed to fetch position:', err);
      setError('포지션 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditMode(true);
    setError(null);
  };

  const handleCancel = () => {
    if (position) {
      setEditedData({
        shares: position.shares.toString(),
        averagePrice: position.averagePrice.toString(),
      });
    }
    setEditMode(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!position) return;

    try {
      setSaving(true);
      setError(null);

      // TODO: 포지션 업데이트 API 호출
      // 현재는 시뮬레이션
      console.log('Updating position:', {
        positionId,
        shares: parseFloat(editedData.shares),
        averagePrice: parseFloat(editedData.averagePrice),
      });

      // 임시: 로컬 상태 업데이트
      setPosition({
        ...position,
        shares: parseFloat(editedData.shares),
        averagePrice: parseFloat(editedData.averagePrice),
        totalInvested: parseFloat(editedData.shares) * parseFloat(editedData.averagePrice),
      });

      setEditMode(false);
    } catch (err) {
      console.error('Failed to update position:', err);
      setError('포지션 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말로 이 포지션을 삭제하시겠습니까?')) {
      return;
    }

    try {
      // TODO: 포지션 삭제 API 호출
      console.log('Deleting position:', positionId);
      router.push('/');
    } catch (err) {
      console.error('Failed to delete position:', err);
      setError('포지션 삭제에 실패했습니다.');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!position) {
    return (
      <>
        <Header />
        <div className="container mx-auto py-6 px-4">
          <Alert variant="destructive">
            <AlertDescription>
              {error || '포지션을 찾을 수 없습니다.'}
            </AlertDescription>
          </Alert>
          <Button onClick={() => router.push('/')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            돌아가기
          </Button>
        </div>
      </>
    );
  }

  const profitLoss = position.totalValue - position.totalInvested;
  const isProfit = profitLoss >= 0;

  return (
    <>
      <Header />
      <div className="container mx-auto py-6 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              돌아가기
            </Button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold">{position.name}</h1>
                <p className="text-muted-foreground mt-1">
                  {position.symbol} · {position.market} · {position.exchange}
                </p>
              </div>
              <div className="flex gap-2">
                {editMode ? (
                  <>
                    <Button onClick={handleCancel} variant="outline" size="sm">
                      <X className="h-4 w-4 mr-2" />
                      취소
                    </Button>
                    <Button onClick={handleSave} size="sm" disabled={saving}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      저장
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={handleEdit} variant="outline" size="sm">
                      <Edit2 className="h-4 w-4 mr-2" />
                      수정
                    </Button>
                    <Button onClick={handleDelete} variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>현재가</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(position.currentPrice, position.currency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>평가액</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(position.totalValue, position.currency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>손익</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold flex items-center ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                  {isProfit ? <TrendingUp className="h-5 w-5 mr-2" /> : <TrendingDown className="h-5 w-5 mr-2" />}
                  {formatCurrency(Math.abs(profitLoss), position.currency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>수익률</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(position.returnRate)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Details */}
          <Tabs defaultValue="info" className="space-y-4">
            <TabsList>
              <TabsTrigger value="info">기본 정보</TabsTrigger>
              <TabsTrigger value="transactions">거래 내역</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle>보유 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="shares">보유 수량</Label>
                      {editMode ? (
                        <Input
                          id="shares"
                          type="number"
                          step="0.001"
                          value={editedData.shares}
                          onChange={(e) => setEditedData({ ...editedData, shares: e.target.value })}
                        />
                      ) : (
                        <div className="text-xl font-semibold">{position.shares} 주</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="averagePrice">평균 매수가</Label>
                      {editMode ? (
                        <Input
                          id="averagePrice"
                          type="number"
                          step="0.01"
                          value={editedData.averagePrice}
                          onChange={(e) => setEditedData({ ...editedData, averagePrice: e.target.value })}
                        />
                      ) : (
                        <div className="text-xl font-semibold">
                          {formatCurrency(position.averagePrice, position.currency)}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>총 투자금</Label>
                      <div className="text-xl font-semibold">
                        {formatCurrency(position.totalInvested, position.currency)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>첫 매수일</Label>
                      <div className="text-xl font-semibold">
                        {formatDate(position.firstPurchaseDate, 'yyyy-MM-dd')}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">시장</span>
                      <Badge>{position.market}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">자산 유형</span>
                      <Badge variant="outline">{position.assetType}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">섹터</span>
                      <span className="font-medium">{position.sector || '미분류'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">거래 횟수</span>
                      <span className="font-medium">{position.transactionCount || 0}회</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <CardTitle>거래 내역</CardTitle>
                  <CardDescription>이 종목의 모든 매수/매도 기록</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center text-muted-foreground py-8">
                    거래 내역 기능은 준비 중입니다.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

