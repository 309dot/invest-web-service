"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPercent } from '@/lib/utils/formatters';

type SellAlert = {
  id: string;
  symbol: string;
  portfolioId: string;
  positionId: string;
  currentReturnRate: number;
  targetReturnRate: number;
  sellRatio: number;
  sharesToSell: number;
  createdAt?: { seconds: number; nanoseconds: number };
};

interface SellAlertBannerProps {
  userId: string;
  portfolioId: string;
}

export function SellAlertBanner({ userId, portfolioId }: SellAlertBannerProps) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<SellAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!userId) {
      setAlerts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const search = new URLSearchParams({
        userId,
        portfolioId,
      });
      const response = await fetch(`/api/alerts/sell?${search.toString()}`);
      if (!response.ok) {
        throw new Error('매도 알림을 불러오지 못했습니다.');
      }

      const data = await response.json();
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    } catch (err) {
      console.error('Sell alert fetch error:', err);
      setError(err instanceof Error ? err.message : '알림을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [userId, portfolioId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleDismiss = useCallback(
    async (alertId: string) => {
      try {
        setDismissing(true);
        await fetch('/api/alerts/sell', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            alertId,
            action: 'dismiss',
          }),
        });
        setAlerts((prev) => prev.filter((item) => item.id !== alertId));
      } catch (err) {
        console.error('Sell alert dismiss error:', err);
      } finally {
        setDismissing(false);
      }
    },
    [userId]
  );

  if (loading && alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <Loader2 className="h-4 w-4 animate-spin" />
        최근 매도 알림을 불러오는 중입니다...
      </div>
    );
  }

  if (!alerts.length) {
    return error ? (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {error}
      </div>
    ) : null;
  }

  const alert = alerts[0];

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {alert.symbol} 매도 타이밍 도달
            </p>
            <p className="text-xs text-amber-800">
              목표 수익률 {formatPercent(alert.targetReturnRate)} · 현재 수익률{' '}
              {formatPercent(alert.currentReturnRate)} · 권장 매도 비중 {alert.sellRatio.toFixed(0)}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-400 text-xs text-amber-800">
            {alert.sharesToSell.toFixed(2)}주 제안
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDismiss(alert.id)}
            disabled={dismissing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-amber-800">
        <Button
          variant="link"
          className="px-0 text-xs text-amber-900"
          onClick={() => router.push(`/portfolio/position/${alert.positionId}?portfolioId=${portfolioId}`)}
        >
          자세히 보기
        </Button>
        <span>·</span>
        <Button
          variant="link"
          className="px-0 text-xs text-amber-900"
          onClick={fetchAlerts}
          disabled={loading}
        >
          새로고침
        </Button>
      </div>
    </div>
  );
}


