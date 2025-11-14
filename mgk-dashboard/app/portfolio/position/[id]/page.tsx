"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
import { Loader2, ArrowLeft, Edit2, Save, X, TrendingUp, TrendingDown, Calendar, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import { formatPercent, formatDate, formatInputDate } from '@/lib/utils/formatters';
import type { AutoInvestFrequency, AutoInvestSchedule, Position, Transaction } from '@/types';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { deriveDefaultPortfolioId } from '@/lib/utils/portfolio';
import { AutoInvestScheduleDialog } from '@/components/AutoInvestScheduleDialog';
import { ReapplyScheduleDialog } from '@/components/ReapplyScheduleDialog';
import { TransactionTable } from '@/components/TransactionTable';
import type { PersonalizedNews } from '@/lib/services/news-analysis';

export default function PositionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const positionId = params.id as string;
  const portfolioIdParam = searchParams?.get('portfolioId') || null;

const FREQUENCY_LABELS: Record<AutoInvestFrequency, string> = {
  daily: '매일',
  weekly: '매주',
  biweekly: '격주',
  monthly: '매월',
  quarterly: '분기',
};

const IMPACT_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
};

const SENTIMENT_STYLE: Record<'positive' | 'negative' | 'neutral', string> = {
  positive: 'bg-emerald-600 hover:bg-emerald-600',
  negative: 'bg-red-500 hover:bg-red-500',
  neutral: 'bg-slate-500 hover:bg-slate-500',
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
  const [portfolioIdState, setPortfolioIdState] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    frequency: 'monthly' as AutoInvestFrequency,
    amount: '',
    effectiveFrom: formatInputDate(),
    pricePerShare: '',
    note: '',
  });
  const [sellAlertForm, setSellAlertForm] = useState({
    enabled: false,
    targetReturnRate: '',
    sellRatio: '100',
    triggerOnce: true,
  });
  const [sellAlertSaving, setSellAlertSaving] = useState(false);
  const [sellAlertError, setSellAlertError] = useState<string | null>(null);
  const [sellAlertSuccess, setSellAlertSuccess] = useState<string | null>(null);
  const [symbolNews, setSymbolNews] = useState<PersonalizedNews[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  
  // 거래 내역 관련 상태
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  
  // 다이얼로그 상태
  const [editScheduleDialogOpen, setEditScheduleDialogOpen] = useState(false);
  const [reapplyScheduleDialogOpen, setReapplyScheduleDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<AutoInvestSchedule | null>(null);

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

  const fetchAutoInvestSchedules = useCallback(
    async (uid: string, activePortfolioId: string, posId: string) => {
      try {
        setScheduleLoading(true);
        setScheduleError(null);
        const response = await fetch(
          `/api/positions/${posId}/auto-invest?userId=${uid}&portfolioId=${activePortfolioId}`
        );
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
    },
    []
  );

  const fetchTransactions = useCallback(
    async (uid: string, activePortfolioId: string, posId: string) => {
      try {
        setTransactionsLoading(true);
        setTransactionsError(null);
        const response = await fetch(
          `/api/positions/${posId}/transactions?userId=${uid}&portfolioId=${activePortfolioId}`
        );
        if (response.ok) {
          const data = await response.json();
          setTransactions(data.transactions || []);
        } else {
          const errorData = await response.json().catch(() => null);
          setTransactionsError(errorData?.error || '거래 내역을 불러오지 못했습니다.');
        }
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
        setTransactionsError('거래 내역 조회 중 오류가 발생했습니다.');
      } finally {
        setTransactionsLoading(false);
      }
    },
    []
  );

  const fetchSymbolNews = useCallback(
    async (uid: string, activePortfolioId: string, symbol: string) => {
      try {
        setNewsLoading(true);
        setNewsError(null);
        const response = await fetch(
          `/api/news/personalized?userId=${uid}&portfolioId=${activePortfolioId}`
        );

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(errorBody?.error || '관련 뉴스를 불러오지 못했습니다.');
        }

        const data = await response.json();
        const items: PersonalizedNews[] = Array.isArray(data.news) ? data.news : [];
        const filtered = items.filter(
          (item) =>
            Array.isArray(item.affectedPositions) &&
            item.affectedPositions.some((affected) => affected.symbol === symbol)
        );

        setSymbolNews(filtered.slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch symbol news:', err);
        setNewsError(err instanceof Error ? err.message : '관련 뉴스를 불러오지 못했습니다.');
        setSymbolNews([]);
      } finally {
        setNewsLoading(false);
      }
    },
    []
  );

  const fetchPosition = useCallback(
    async (uid: string, initialPortfolioId: string) => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/positions/${positionId}?userId=${uid}&portfolioId=${initialPortfolioId}`
        );

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          setError(errorBody?.error || '포지션을 찾을 수 없습니다.');
          setPosition(null);
          setAutoInvestSchedules([]);
          return;
        }

        const data = await response.json();
        const found = data.position as Position;
        const resolvedPortfolioId = found?.portfolioId || initialPortfolioId;

        if (!found) {
          setError('포지션을 찾을 수 없습니다.');
          setPosition(null);
          setAutoInvestSchedules([]);
          return;
        }

        setError(null);
        setPosition(found);
        setEditedData({
          shares: found.shares.toString(),
          averagePrice: found.averagePrice.toString(),
        });
        setSellAlertForm({
          enabled: found.sellAlert?.enabled ?? false,
          targetReturnRate:
            found.sellAlert?.targetReturnRate !== undefined
              ? found.sellAlert.targetReturnRate.toString()
              : '',
          sellRatio:
            found.sellAlert?.sellRatio !== undefined
              ? found.sellAlert.sellRatio.toString()
              : '100',
          triggerOnce: found.sellAlert?.triggerOnce ?? true,
        });
        setSellAlertError(null);
        setSellAlertSuccess(null);
        setPortfolioIdState(resolvedPortfolioId);

        if (found.purchaseMethod === 'auto') {
          await fetchAutoInvestSchedules(uid, resolvedPortfolioId, found.id!);
        } else {
          setAutoInvestSchedules([]);
        }
        
        // 거래 내역 조회
        await fetchTransactions(uid, resolvedPortfolioId, found.id!);
      } catch (err) {
        console.error('Failed to fetch position:', err);
        setError('포지션 조회에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [positionId, fetchAutoInvestSchedules]
  );

  useEffect(() => {
    if (user && positionId) {
      const activePortfolioId = portfolioIdParam || deriveDefaultPortfolioId(user.uid);
      fetchPosition(user.uid, activePortfolioId);
    }
  }, [user, positionId, portfolioIdParam, fetchPosition, fetchTransactions]);

  useEffect(() => {
    if (!user || !position) {
      setSymbolNews([]);
      return;
    }

    const symbol = position.symbol;
    if (!symbol) {
      setSymbolNews([]);
      return;
    }

    const activePortfolioId =
      portfolioIdState || position.portfolioId || deriveDefaultPortfolioId(user.uid);
    fetchSymbolNews(user.uid, activePortfolioId, symbol);
  }, [user, position, portfolioIdState, fetchSymbolNews]);

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

  const handleSellAlertSave = async () => {
    if (!position) {
      setSellAlertError('포지션 정보를 불러오지 못했습니다.');
      return;
    }

    if (!user) {
      setSellAlertError('로그인이 필요합니다.');
      return;
    }

    const targetReturnRate = parseFloat(sellAlertForm.targetReturnRate);
    const sellRatio = parseFloat(sellAlertForm.sellRatio);

    if (sellAlertForm.enabled) {
      if (Number.isNaN(targetReturnRate) || targetReturnRate <= 0) {
        setSellAlertError('목표 수익률(%)을 0보다 크게 입력해주세요.');
        return;
      }
    }

    if (!Number.isNaN(sellRatio) && (sellRatio < 0 || sellRatio > 100)) {
      setSellAlertError('매도 비율은 0~100 범위여야 합니다.');
      return;
    }

    try {
      setSellAlertSaving(true);
      setSellAlertError(null);
      setSellAlertSuccess(null);

      const activePortfolioId =
        portfolioIdState || position.portfolioId || deriveDefaultPortfolioId(user.uid);

      const accountEmail = user.email ?? '';

      const response = await fetch(
        `/api/positions/${position.id}/sell-alert?userId=${user.uid}&portfolioId=${activePortfolioId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: sellAlertForm.enabled,
            targetReturnRate: Number.isNaN(targetReturnRate) ? undefined : targetReturnRate,
            sellRatio: Number.isNaN(sellRatio) ? undefined : sellRatio,
            triggerOnce: sellAlertForm.triggerOnce,
            accountEmail: accountEmail || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || '매도 알림 설정 저장에 실패했습니다.');
      }

      const data = await response.json();

      setPosition((prev) => (prev ? { ...prev, sellAlert: data.sellAlert } : prev));
      setSellAlertForm((prev) => ({
        ...prev,
        enabled: data.sellAlert.enabled,
        targetReturnRate: data.sellAlert.targetReturnRate?.toString() ?? '',
        sellRatio: data.sellAlert.sellRatio?.toString() ?? '100',
        triggerOnce: data.sellAlert.triggerOnce ?? true,
      }));
      setSellAlertSuccess('매도 알림 설정을 저장했습니다.');
    } catch (err) {
      console.error('Sell alert save failed:', err);
      setSellAlertError(err instanceof Error ? err.message : '매도 알림 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSellAlertSaving(false);
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

      const activePortfolioId =
        portfolioIdState || position.portfolioId || deriveDefaultPortfolioId(user.uid);
      const response = await fetch(
        `/api/positions/${position.id}/auto-invest?userId=${user.uid}&portfolioId=${activePortfolioId}`,
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
      if (!data.success) {
        throw new Error(data.message || '자동 투자 스케줄 저장에 실패했습니다.');
      }

      setAutoInvestSchedules(data.schedules || []);
      setScheduleSuccess(data.message || '자동 투자 스케줄이 업데이트되었습니다.');
      setScheduleForm((prev) => ({
        ...prev,
        note: '',
        amount: amountValue.toString(),
        pricePerShare: priceValue.toString(),
      }));

      await fetchPosition(user.uid, activePortfolioId);
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

  const handleEditSchedule = (schedule: AutoInvestSchedule) => {
    setSelectedSchedule(schedule);
    setEditScheduleDialogOpen(true);
  };

  const handleScheduleSave = async (data: {
    scheduleId: string;
    frequency?: AutoInvestFrequency;
    amount?: number;
    effectiveFrom?: string;
    note?: string;
    regenerateTransactions: boolean;
  }) => {
    if (!position || !user) return;

    const activePortfolioId = portfolioIdState || position.portfolioId || deriveDefaultPortfolioId(user.uid);
    
    const response = await fetch(
      `/api/positions/${position.id}/auto-invest?userId=${user.uid}&portfolioId=${activePortfolioId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || '스케줄 수정에 실패했습니다.');
    }

    const result = await response.json();
    setAutoInvestSchedules(result.schedules || []);
    setScheduleSuccess('스케줄이 수정되었습니다.');
    await fetchPosition(user.uid, activePortfolioId);
  };

  const handleDeleteSchedule = async (scheduleId: string, deleteTransactions: boolean = false) => {
    if (!position || !user) {
      setScheduleError('로그인 정보 또는 포지션 정보를 확인해주세요.');
      return;
    }

    if (!confirm(`정말로 이 스케줄을 삭제하시겠습니까?${deleteTransactions ? ' (관련 거래도 함께 삭제됩니다)' : ''}`)) {
      return;
    }

    try {
      setScheduleError(null);
      setScheduleSuccess(null);

      const activePortfolioId = portfolioIdState || position.portfolioId || deriveDefaultPortfolioId(user.uid);
      const response = await fetch(
        `/api/positions/${position.id}/auto-invest?userId=${user.uid}&portfolioId=${activePortfolioId}&scheduleId=${scheduleId}&deleteTransactions=${deleteTransactions}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || '스케줄 삭제에 실패했습니다.');
      }

      const data = await response.json();
      setAutoInvestSchedules(data.schedules || []);
      setScheduleSuccess(`스케줄이 삭제되었습니다. (거래 삭제: ${data.deletedTransactions}건)`);
      await fetchPosition(user.uid, activePortfolioId);
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      setScheduleError(err instanceof Error ? err.message : '스케줄 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleReapplySchedule = (schedule: AutoInvestSchedule) => {
    setSelectedSchedule(schedule);
    setReapplyScheduleDialogOpen(true);
  };

  const handleReapplyConfirm = async (data: {
    scheduleId: string;
    effectiveFrom: string;
    pricePerShare?: number;
  }) => {
    if (!position || !user) return;

    const activePortfolioId = portfolioIdState || position.portfolioId || deriveDefaultPortfolioId(user.uid);
    
    const response = await fetch(
      `/api/positions/${position.id}/auto-invest/reapply?userId=${user.uid}&portfolioId=${activePortfolioId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || '스케줄 재적용에 실패했습니다.');
    }

    const result = await response.json();
    setScheduleSuccess(`스케줄이 재적용되었습니다. (거래 생성: ${result.created}건)`);
    await fetchAutoInvestSchedules(user.uid, activePortfolioId, position.id!);
    await fetchPosition(user.uid, activePortfolioId);
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

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>매도 타이밍 알림</CardTitle>
                  <CardDescription>
                    목표 수익률과 매도 비율을 설정하면 조건 충족 시 이메일로 알림을 보냅니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-semibold">알림 활성화</Label>
                      <p className="text-xs text-muted-foreground">조건 만족 시 알림을 받을지 여부를 설정합니다.</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={sellAlertForm.enabled}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        setSellAlertForm((prev) => ({ ...prev, enabled }));
                        setSellAlertError(null);
                        setSellAlertSuccess(null);
                      }}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sellAlertTarget">목표 수익률 (%)</Label>
                      <Input
                        id="sellAlertTarget"
                        type="number"
                        step="0.1"
                        placeholder="예: 15"
                        value={sellAlertForm.targetReturnRate}
                        disabled={!sellAlertForm.enabled}
                        onChange={(event) => {
                          setSellAlertForm((prev) => ({
                            ...prev,
                            targetReturnRate: event.target.value,
                          }));
                          setSellAlertSuccess(null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sellAlertRatio">매도 비율 (%)</Label>
                      <Input
                        id="sellAlertRatio"
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        placeholder="예: 50"
                        value={sellAlertForm.sellRatio}
                        disabled={!sellAlertForm.enabled}
                        onChange={(event) => {
                          setSellAlertForm((prev) => ({
                            ...prev,
                            sellRatio: event.target.value,
                          }));
                          setSellAlertSuccess(null);
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="sellAlertTriggerOnce"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={sellAlertForm.triggerOnce}
                      disabled={!sellAlertForm.enabled}
                      onChange={(event) => {
                        setSellAlertForm((prev) => ({
                          ...prev,
                          triggerOnce: event.target.checked,
                        }));
                        setSellAlertSuccess(null);
                      }}
                    />
                    <Label htmlFor="sellAlertTriggerOnce" className="text-sm font-normal">
                      한 번만 알림 (재충족 시 재알림 없음)
                    </Label>
                  </div>

                  <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    알림은 계정 이메일(
                    {user?.email ? user.email : '등록된 이메일 없음'}
                    )로 자동 발송됩니다. 이메일은 설정에서 변경해주세요.
                  </div>

                  {sellAlertError && (
                    <Alert variant="destructive">
                      <AlertDescription>{sellAlertError}</AlertDescription>
                    </Alert>
                  )}

                  {sellAlertSuccess && (
                    <Alert>
                      <AlertDescription>{sellAlertSuccess}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {position?.sellAlert?.lastTriggeredAt
                        ? `마지막 알림: ${formatDate(position.sellAlert.lastTriggeredAt, 'yyyy-MM-dd HH:mm')}`
                        : '아직 발송된 알림이 없습니다.'}
                    </p>
                    <Button
                      size="sm"
                      onClick={handleSellAlertSave}
                      disabled={sellAlertSaving}
                    >
                      {sellAlertSaving ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> 저장 중...
                        </span>
                      ) : (
                        '설정 저장'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>보유 종목 뉴스</CardTitle>
                  <CardDescription>해당 종목과 직접 연결된 최신 뉴스만 골라 보여드립니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  {newsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>관련 뉴스를 불러오는 중입니다...</span>
                    </div>
                  ) : newsError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{newsError}</AlertDescription>
                    </Alert>
                  ) : symbolNews.length === 0 ? (
                    <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                      아직 이 종목과 직접적으로 연관된 뉴스가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {symbolNews.map((item) => {
                        const targetImpact = item.affectedPositions?.find(
                          (affected) => affected.symbol === position.symbol
                        );
                        const sentiment: 'positive' | 'negative' | 'neutral' =
                          item.sentiment ?? 'neutral';
                        return (
                          <div
                            key={`${item.url}-${item.publishedAt}`}
                            className="rounded-lg border border-primary/10 bg-primary/5 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold leading-snug">{item.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.source} · {formatDate(item.publishedAt, 'yyyy-MM-dd HH:mm')}
                                </p>
                              </div>
                              <Badge className={SENTIMENT_STYLE[sentiment]}>
                                {sentiment === 'positive' ? '긍정' : sentiment === 'negative' ? '부정' : '중립'}
                              </Badge>
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">
                              {item.summary || item.reason}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <div className="flex flex-wrap items-center gap-2">
                                {typeof item.personalRelevance === 'number' ? (
                                  <span>관련성 {item.personalRelevance.toFixed(0)}%</span>
                                ) : null}
                                {targetImpact ? (
                                  <span>
                                    영향도 {IMPACT_LABEL[targetImpact.estimatedImpact]} ·
                                    포트폴리오 비중 {targetImpact.portfolioWeight.toFixed(1)}%
                                  </span>
                                ) : null}
                              </div>
                              <Button asChild variant="link" className="px-0 text-xs">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                                  원문 보기
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                  {transactionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span className="text-muted-foreground">불러오는 중...</span>
                    </div>
                  ) : transactionsError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{transactionsError}</AlertDescription>
                    </Alert>
                  ) : (
                    <TransactionTable
                      transactions={transactions}
                      currency={position.currency}
                      onEdit={(transaction) => {
                        // TODO: 거래 수정 다이얼로그 구현
                        console.log('Edit transaction:', transaction);
                      }}
                      onDelete={async (transaction) => {
                        if (!confirm('정말로 이 거래를 삭제하시겠습니까?')) return;
                        
                        try {
                          const activePortfolioId = portfolioIdState || position.portfolioId || deriveDefaultPortfolioId(user!.uid);
                          const response = await fetch(
                            `/api/transactions/${transaction.id}?userId=${user!.uid}&portfolioId=${activePortfolioId}`,
                            { method: 'DELETE' }
                          );
                          
                          if (!response.ok) {
                            throw new Error('거래 삭제에 실패했습니다.');
                          }
                          
                          await fetchTransactions(user!.uid, activePortfolioId, position.id!);
                          await fetchPosition(user!.uid, activePortfolioId);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : '거래 삭제 중 오류가 발생했습니다.');
                        }
                      }}
                    />
                  )}
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
                              <TableHead>상태</TableHead>
                              <TableHead>적용 기간</TableHead>
                              <TableHead>투자 금액</TableHead>
                              <TableHead>주기</TableHead>
                              <TableHead>등록일</TableHead>
                              <TableHead>메모</TableHead>
                              <TableHead className="text-right">작업</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {autoInvestSchedules.map((schedule) => {
                              const isActive = !schedule.effectiveTo;
                              return (
                                <TableRow key={schedule.id} className={isActive ? 'bg-blue-50/50' : ''}>
                                  <TableCell>
                                    {isActive ? (
                                      <Badge variant="default">활성</Badge>
                                    ) : (
                                      <Badge variant="secondary">종료</Badge>
                                    )}
                                  </TableCell>
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
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleReapplySchedule(schedule)}
                                        title="재적용"
                                      >
                                        <RefreshCw className="h-3 w-3" />
                                      </Button>
                                      {isActive && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditSchedule(schedule)}
                                          title="수정"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteSchedule(schedule.id!, false)}
                                        title="삭제"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
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

      {/* 다이얼로그 */}
      <AutoInvestScheduleDialog
        open={editScheduleDialogOpen}
        onOpenChange={setEditScheduleDialogOpen}
        schedule={selectedSchedule}
        onSave={handleScheduleSave}
        currency={position.currency}
      />

      <ReapplyScheduleDialog
        open={reapplyScheduleDialogOpen}
        onOpenChange={setReapplyScheduleDialogOpen}
        schedule={selectedSchedule}
        onConfirm={handleReapplyConfirm}
        currency={position.currency}
      />
    </>
  );
}

