"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import type { SmartAlert, SmartAlertResponse } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

type SeverityKey = SmartAlert['severity'];

const SEVERITY_META: Record<
  SeverityKey,
  { label: string; icon: React.ComponentType<{ className?: string }>; badge: string }
> = {
  emergency: { label: '긴급', icon: AlertTriangle, badge: 'bg-red-500 hover:bg-red-500 text-white' },
  important: {
    label: '중요',
    icon: AlertCircle,
    badge: 'bg-amber-500 hover:bg-amber-500 text-white',
  },
  info: { label: '정보', icon: Info, badge: 'bg-slate-500 hover:bg-slate-500 text-white' },
};

interface SmartAlertsPanelProps {
  portfolioId: string;
}

function groupAlerts(alerts: SmartAlert[]): Record<SeverityKey, SmartAlert[]> {
  return alerts.reduce<Record<SeverityKey, SmartAlert[]>>(
    (acc, alert) => {
      acc[alert.severity].push(alert);
      return acc;
    },
    { emergency: [], important: [], info: [] }
  );
}

export function SmartAlertsPanel({ portfolioId }: SmartAlertsPanelProps) {
  const { user } = useAuth();
  const [data, setData] = useState<SmartAlertResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/portfolio/alerts?portfolioId=${portfolioId}&userId=${user.uid}`,
        { cache: 'no-store' }
      );
      if (!response.ok) {
        throw new Error(`알림 요청이 실패했습니다. (status: ${response.status})`);
      }
      const payload = (await response.json()) as SmartAlertResponse;
      setData(payload);
      setLastRefreshed(new Date().toISOString());
    } catch (err) {
      console.error('[SmartAlertsPanel] 알림 로딩 실패', err);
      setError(err instanceof Error ? err.message : '알림 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [portfolioId, user]);

  useEffect(() => {
    if (user?.uid) {
      fetchAlerts();
    }
  }, [user, fetchAlerts]);

  const grouped = useMemo(() => {
    if (!data?.alerts?.length) {
      return { emergency: [], important: [], info: [] } as Record<SeverityKey, SmartAlert[]>;
    }
    return groupAlerts(data.alerts);
  }, [data]);

  const hasAlerts = data?.alerts?.length && !loading;

  if (!user) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="h-5 w-5 text-primary" />
              스마트 알림
            </CardTitle>
            <CardDescription>
              포트폴리오의 위험 신호와 주요 이벤트를 자동으로 모니터링합니다.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {lastRefreshed ? <span>업데이트: {new Date(lastRefreshed).toLocaleString()}</span> : null}
            <Button size="sm" variant="outline" onClick={fetchAlerts} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              새로고침
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : hasAlerts ? (
          <div className="space-y-4">
            {(Object.keys(SEVERITY_META) as SeverityKey[]).map((severity) => {
              const severityAlerts = grouped[severity];
              if (!severityAlerts?.length) {
                return null;
              }
              const MetaIcon = SEVERITY_META[severity].icon;
              return (
                <section key={severity} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className={`${SEVERITY_META[severity].badge}`}>
                      {SEVERITY_META[severity].label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {severityAlerts.length}건의 알림
                    </span>
                  </div>
                  <div className="space-y-3">
                    {severityAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="rounded-md border border-primary/10 bg-background/70 p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <MetaIcon className="h-4 w-4 text-primary" />
                              <h3 className="text-sm font-semibold">{alert.title}</h3>
                              {alert.symbol ? (
                                <Badge variant="secondary" className="uppercase">
                                  {alert.symbol}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground">{alert.description}</p>
                          </div>
                          {alert.recommendedAction ? (
                            <div className="rounded-md border border-dashed border-primary/20 bg-primary/10 p-3 text-xs text-primary md:w-72">
                              <p className="font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                권장 조치
                              </p>
                              <p className="mt-1 leading-relaxed text-primary/80">
                                {alert.recommendedAction}
                              </p>
                            </div>
                          ) : null}
                        </div>
                        {alert.tags?.length ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {alert.tags.map((tag) => (
                              <Badge key={`${alert.id}-${tag}`} variant="outline" className="uppercase">
                                #{tag}
                              </Badge>
                            ))}
                            <span className="ml-auto text-[11px]">
                              {new Date(alert.createdAt).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-3 flex justify-end text-[11px] text-muted-foreground">
                            {new Date(alert.createdAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            현재 표시할 알림이 없습니다. 포트폴리오 변동이 발생하면 자동으로 알려드립니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

