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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ArrowLeft, Edit2, Save, X, TrendingUp, TrendingDown, DollarSign, Calendar, Trash2 } from 'lucide-react';
import { formatPercent, formatDate, formatInputDate } from '@/lib/utils/formatters';
import type { AutoInvestFrequency, AutoInvestSchedule, Position } from '@/types';
import { useCurrency } from '@/lib/contexts/CurrencyContext';

export default function PositionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const positionId = params.id as string;

const FREQUENCY_LABELS: Record<AutoInvestFrequency, string> = {
  daily: '매일',
  weekly: '매주',
  biweekly: '격주',
  monthly: '매월',
  quarterly: '분기',
};

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

  const [autoInvestSchedules, setAutoInvestSchedules] = useState<AutoInvestSchedule[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    frequency: 'monthly' as AutoInvestFrequency,
    amount: '',
    effectiveFrom: formatInputDate(),
    pricePerShare: '',
    note: '',
  });

  const formatScheduleDate = (value: unknown): string => {
    if (!value) return '-';
    if (typeof value === 'string') {
      return formatDate(value, 'yyyy-MM-dd');
    }
    if (typeof (value as any)?.toDate === 'function') {
      return formatDate((value as any).toDate(), 'yyyy-MM-dd');
    }
    if ((value as any)?.seconds) {
      return formatDate(new Date((value as any).seconds * 1000), 'yyyy-MM-dd');
    }
    return '-';
  };

  const { formatAmount } = useCurrency();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && positionId) {
      fetchPosition(user.uid);
    }
  }, [user, positionId]);

  useEffect(() => {
    if (position?.purchaseMethod === 'auto') {
      setScheduleForm((prev) => ({
        ...prev,
        frequency: position.autoInvestConfig?.frequency || prev.frequency,
        amount:
          position.autoInvestConfig?.amount !== undefined
            ? position.autoInvestConfig.amount.toString()
            : prev.amount,
        pricePerShare:
          position.currentPrice !== undefined && position.currentPrice !== null
            ? position.currentPrice.toString()
            : prev.pricePerShare,
        effectiveFrom: formatInputDate(),
      }));
    }
  }, [position]);

  const fetchPosition = async (uid: string) => {
    try {
      setLoading(true);
      const derivedPortfolioId = positionId?.includes('_') ? positionId.split('_')[0] : 'main';
      const response = await fetch(`/api/positions?portfolioId=${derivedPortfolioId}&userId=${uid}`);
      const data = await response.json();
      
      const found = data.positions?.find((p: Position) => p.id === positionId);
      if (found) {
        setPosition(found);
        setEditedData({
          shares: found.shares.toString(),
          averagePrice: found.averagePrice.toString(),
        });

        if (found.purchaseMethod === 'auto') {
          await fetchAutoInvestSchedules(uid, found.id!);
        } else {
          setAutoInvestSchedules([]);
        }
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

  const fetchAutoInvestSchedules = async (uid: string, posId: string) => {
    try {
      setScheduleLoading(true);
      setScheduleError(null);
      const response = await fetch(`/api/positions/${posId}/auto-invest?userId=${uid}`);
      if (response.ok) {
        const data = await response.json();
        setAutoInvestSchedules(data.schedules || []);
      } else {
        const errorData = await response.json().catch(() => null);
        setScheduleError(errorData?.error || '자동 투자 스케줄을 불러오지 못했습니다.');
      }
    } catch (err) {
      console.error('Failed to fetch auto invest schedules:', err);
      setScheduleError('자동 투자 스케줄 조회 중 오류가 발생했습니다.');
    } finally {
      setScheduleLoading(false);
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

  const handleScheduleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!position || !user) {
      setScheduleError('로그인 정보 또는 포지션 정보를 확인해주세요.');
      return;
    }

    const amountValue = parseFloat(scheduleForm.amount);
    const fallbackPrice = position.currentPrice || position.averagePrice || 0;
    const priceValue = scheduleForm.pricePerShare
      ? parseFloat(scheduleForm.pricePerShare)
      : fallbackPrice;

    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setScheduleError('유효한 투자 금액을 입력해주세요.');
      return;
    }

    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setScheduleError('유효한 기준 단가를 입력해주세요.');
      return;
    }

    if (!scheduleForm.effectiveFrom) {
      setScheduleError('적용 시작일을 선택해주세요.');
      return;
    }

    try {
      setScheduleSaving(true);
      setScheduleError(null);
      setScheduleSuccess(null);

      const response = await fetch(
        `/api/positions/${position.id}/auto-invest?userId=${user.uid}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frequency: scheduleForm.frequency,
            amount: amountValue,
            effectiveFrom: scheduleForm.effectiveFrom,
        pricePerShare: priceValue,
            note: scheduleForm.note || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || '자동 투자 스케줄 저장에 실패했습니다.');
      }

      const data = await response.json();
      setAutoInvestSchedules(data.schedules || []);
      setScheduleSuccess('자동 투자 스케줄이 업데이트되었습니다.');
      setScheduleForm((prev) => ({
        ...prev,
        note: '',
        amount: amountValue.toString(),
        pricePerShare: priceValue.toString(),
      }));

      await fetchPosition(user.uid);
    } catch (err) {
      console.error('Failed to save schedule:', err);
      setScheduleError(err instanceof Error ? err.message : '자동 투자 스케줄 저장 중 오류가 발생했습니다.');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleScheduleReset = () => {
    if (!position) return;

    setScheduleForm({
      frequency: position.autoInvestConfig?.frequency || 'monthly',
      amount:
        position.autoInvestConfig?.amount !== undefined
          ? position.autoInvestConfig.amount.toString()
          : '',
      effectiveFrom: formatInputDate(),
      pricePerShare:
        position.currentPrice !== undefined && position.currentPrice !== null
          ? position.currentPrice.toString()
          : '',
      note: '',
    });
    setScheduleError(null);
    setScheduleSuccess(null);
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
                  {formatAmount(position.currentPrice, position.currency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>평가액</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatAmount(position.totalValue, position.currency)}
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
                  {formatAmount(Math.abs(profitLoss), position.currency)}
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
          {position.purchaseMethod === 'auto' && (
            <TabsTrigger value="autoInvest">자동 투자</TabsTrigger>
          )}
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
                          {formatAmount(position.averagePrice, position.currency)}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>총 투자금</Label>
                      <div className="text-xl font-semibold">
                        {formatAmount(position.totalInvested, position.currency)}
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

            {position.purchaseMethod === 'auto' && (
              <TabsContent value="autoInvest">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>현재 자동 투자 설정</CardTitle>
                      <CardDescription>
                        변경 사항은 기록으로 남으며, 과거 금액을 재적용할 수 있습니다.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">투자 금액</p>
                          <p className="text-xl font-semibold">
                            {formatAmount(position.autoInvestConfig?.amount || 0, position.currency)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">투자 주기</p>
                          <p className="text-xl font-semibold">
                            {FREQUENCY_LABELS[position.autoInvestConfig?.frequency || 'monthly']}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">시작일</p>
                          <p className="text-xl font-semibold">
                            {position.autoInvestConfig?.startDate || '-'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">마지막 변경</p>
                          <p className="text-xl font-semibold">
                            {position.autoInvestConfig?.lastUpdated || '-'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {scheduleError && (
                    <Alert variant="destructive">
                      <AlertDescription>{scheduleError}</AlertDescription>
                    </Alert>
                  )}

                  {scheduleSuccess && (
                    <Alert>
                      <AlertDescription>{scheduleSuccess}</AlertDescription>
                    </Alert>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle>자동 투자 금액 변경</CardTitle>
                      <CardDescription>
                        새 투자 금액과 적용 시작일을 입력하면 해당 시점 이후의 자동 거래 내역이 재생성됩니다.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleScheduleSubmit} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">투자 주기</Label>
                            <Select
                              value={scheduleForm.frequency}
                              onValueChange={(value) =>
                                setScheduleForm((prev) => ({
                                  ...prev,
                                  frequency: value as AutoInvestFrequency,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="주기를 선택하세요" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">매일</SelectItem>
                                <SelectItem value="weekly">매주</SelectItem>
                                <SelectItem value="biweekly">격주</SelectItem>
                                <SelectItem value="monthly">매월</SelectItem>
                                <SelectItem value="quarterly">분기</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">투자 금액 ({position.currency})</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={scheduleForm.amount}
                              onChange={(e) =>
                                setScheduleForm((prev) => ({ ...prev, amount: e.target.value }))
                              }
                              placeholder="예: 10"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">적용 시작일</Label>
                            <Input
                              type="date"
                              value={scheduleForm.effectiveFrom}
                              max={formatInputDate()}
                              onChange={(e) =>
                                setScheduleForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">재생성 기준 단가 ({position.currency})</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={scheduleForm.pricePerShare}
                              onChange={(e) =>
                                setScheduleForm((prev) => ({ ...prev, pricePerShare: e.target.value }))
                              }
                              placeholder={position.currentPrice
                                ? position.currentPrice.toString()
                                : '예: 5.25'}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">메모 (선택)</Label>
                          <Input
                            type="text"
                            value={scheduleForm.note}
                            onChange={(e) =>
                              setScheduleForm((prev) => ({ ...prev, note: e.target.value }))
                            }
                            placeholder="변경 이유를 남겨주세요"
                          />
                        </div>

                        <div className="flex justify-end gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleScheduleReset}
                            disabled={scheduleSaving}
                          >
                            초기화
                          </Button>
                          <Button type="submit" disabled={scheduleSaving}>
                            {scheduleSaving ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 저장 중
                              </>
                            ) : (
                              '스케줄 저장'
                            )}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>자동 투자 변경 이력</CardTitle>
                      <CardDescription>최신 순으로 정렬된 스케줄 히스토리</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {scheduleLoading ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mr-2" /> 불러오는 중입니다...
                        </div>
                      ) : autoInvestSchedules.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                          아직 등록된 자동 투자 스케줄이 없습니다.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>적용 기간</TableHead>
                              <TableHead>투자 금액</TableHead>
                              <TableHead>주기</TableHead>
                              <TableHead>등록일</TableHead>
                              <TableHead>메모</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {autoInvestSchedules.map((schedule) => (
                              <TableRow key={schedule.id}>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span>
                                      {schedule.effectiveFrom}
                                      {schedule.effectiveTo && ` ~ ${schedule.effectiveTo}`}
                                      {!schedule.effectiveTo && ' 이후'}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatAmount(schedule.amount, schedule.currency)}
                                </TableCell>
                                <TableCell>{FREQUENCY_LABELS[schedule.frequency]}</TableCell>
                                <TableCell>
                                  {formatScheduleDate(schedule.createdAt)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {schedule.note || '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </>
  );
}

