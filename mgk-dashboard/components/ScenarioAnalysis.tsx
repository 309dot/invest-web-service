"use client";

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, Loader2 } from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import type {
  ScenarioAnalysisResponse,
  ScenarioConfig,
  ScenarioPreset,
  ScenarioPositionProjection,
} from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  StatCard,
  StatCardContent,
  StatCardDescription,
  StatCardHeader,
  StatCardTitle,
  StatCardValue,
} from '@/components/ui/stat-card';
import { formatAmount, formatPercent } from '@/lib/utils/formatters';

const PRESET_LABELS: Record<ScenarioPreset, string> = {
  bullish: '강세장 (+)',
  bearish: '약세장 (-)',
  volatile: '변동성 확대',
  custom: '사용자 설정',
};

const PRESET_DEFAULTS: Record<ScenarioPreset, Pick<ScenarioConfig, 'marketShiftPct' | 'usdShiftPct'>> = {
  bullish: { marketShiftPct: 5, usdShiftPct: 1.5 },
  bearish: { marketShiftPct: -5, usdShiftPct: -1 },
  volatile: { marketShiftPct: 0, usdShiftPct: 3 },
  custom: { marketShiftPct: 0, usdShiftPct: 0 },
};

function applyPresetDefaults(preset: ScenarioPreset, config: ScenarioConfig): ScenarioConfig {
  if (preset === 'custom') {
    return config;
  }
  const defaults = PRESET_DEFAULTS[preset];
  return {
    ...config,
    marketShiftPct: defaults.marketShiftPct,
    usdShiftPct: defaults.usdShiftPct,
  };
}

export function ScenarioAnalysis({ portfolioId }: { portfolioId: string }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<ScenarioConfig>({
    preset: 'bullish',
    marketShiftPct: PRESET_DEFAULTS.bullish.marketShiftPct,
    usdShiftPct: PRESET_DEFAULTS.bullish.usdShiftPct,
    additionalContribution: 0,
  });
  const [result, setResult] = useState<ScenarioAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePresetChange = useCallback(
    (value: ScenarioPreset) => {
      setConfig((prev) => applyPresetDefaults(value, { ...prev, preset: value }));
    },
    [setConfig]
  );

  const handleChange = (field: keyof ScenarioConfig, value: number) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const runScenario = useCallback(async () => {
    if (!user?.uid) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/portfolio/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          portfolioId,
          preset: config.preset,
          marketShiftPct: Number(config.marketShiftPct),
          usdShiftPct: Number(config.usdShiftPct),
          additionalContribution: Number(config.additionalContribution),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error || `시나리오 분석 실패 (status: ${response.status})`;
        throw new Error(message);
      }

      const payload = (await response.json()) as ScenarioAnalysisResponse;
      setResult(payload);
    } catch (err) {
      console.error('[ScenarioAnalysis] 실행 실패', err);
      setError(err instanceof Error ? err.message : '시나리오 분석을 실행하지 못했습니다.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [config, portfolioId, user]);

  const topPositions = useMemo(() => {
    if (!result?.result?.positions) {
      return [];
    }
    return result.result.positions.slice(0, 5);
  }, [result]);

  if (!user) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-5 w-5 text-primary" />
              시나리오 분석
            </CardTitle>
            <CardDescription>
              가상의 시장 변화, 환율 변동, 추가 자금 투입을 가정한 포트폴리오 변화를 시뮬레이션합니다.
            </CardDescription>
          </div>
          <Button onClick={runScenario} disabled={loading} size="sm">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            시뮬레이션 실행
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section>
          <h3 className="text-sm font-semibold text-primary mb-3">시나리오 입력</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">프리셋</label>
              <Select value={config.preset} onValueChange={(value) => handlePresetChange(value as ScenarioPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRESET_LABELS) as ScenarioPreset[]).map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {PRESET_LABELS[preset]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">
                시장 변동 (%)
              </label>
              <Input
                type="number"
                value={config.marketShiftPct}
                onChange={(event) => handleChange('marketShiftPct', Number(event.target.value))}
                step="0.5"
              />
              <p className="text-[11px] text-muted-foreground">
                모든 자산 가격에 동일하게 적용되는 가정입니다.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">
                USD 환율 변동 (%)
              </label>
              <Input
                type="number"
                value={config.usdShiftPct}
                onChange={(event) => handleChange('usdShiftPct', Number(event.target.value))}
                step="0.5"
              />
              <p className="text-[11px] text-muted-foreground">
                미국 자산의 평가 금액에만 적용됩니다.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">
                추가 투자/인출 (KRW)
              </label>
              <Input
                type="number"
                value={config.additionalContribution}
                onChange={(event) =>
                  handleChange('additionalContribution', Number(event.target.value))
                }
                step="100000"
              />
              <p className="text-[11px] text-muted-foreground">
                음수 입력으로 출금을 시뮬레이션할 수 있습니다.
              </p>
            </div>
          </div>
        </section>

        {result ? (
          <>
            <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <StatCard variant="neutral">
                <StatCardHeader>
                  <StatCardTitle>현재 평가액</StatCardTitle>
                  <StatCardValue>{formatAmount(result.result.currentTotalValue, 'KRW')}</StatCardValue>
                </StatCardHeader>
                <StatCardContent>
                  <StatCardDescription>
                    현재 포트폴리오 기준 평가액입니다.
                  </StatCardDescription>
                </StatCardContent>
              </StatCard>

              <StatCard variant="neutral">
                <StatCardHeader>
                  <StatCardTitle>시나리오 평가액</StatCardTitle>
                  <StatCardValue>
                    {formatAmount(result.result.projectedTotalValue, 'KRW')}
                  </StatCardValue>
                </StatCardHeader>
                <StatCardContent>
                  <StatCardDescription>
                    추가 자금 {formatAmount(result.result.additionalContribution, 'KRW')} 반영
                  </StatCardDescription>
                </StatCardContent>
              </StatCard>

              <StatCard variant={result.result.projectedProfitLoss >= 0 ? 'buy' : 'sell'}>
                <StatCardHeader>
                  <StatCardTitle>예상 손익</StatCardTitle>
                  <StatCardValue>
                    {formatAmount(result.result.projectedProfitLoss, 'KRW')}
                  </StatCardValue>
                </StatCardHeader>
                <StatCardContent>
                  <StatCardDescription>
                    시장 {result.result.marketShiftPct.toFixed(1)}%, USD{' '}
                    {result.result.usdShiftPct.toFixed(1)}% 변동 기준
                  </StatCardDescription>
                </StatCardContent>
              </StatCard>

              <StatCard variant={result.result.projectedReturnRate >= 0 ? 'buy' : 'sell'}>
                <StatCardHeader>
                  <StatCardTitle>예상 수익률</StatCardTitle>
                  <StatCardValue>{formatPercent(result.result.projectedReturnRate)}</StatCardValue>
                </StatCardHeader>
                <StatCardContent>
                  <StatCardDescription>
                    현재 평가액 대비 예상 변동률입니다.
                  </StatCardDescription>
                </StatCardContent>
              </StatCard>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">종목별 영향 (상위 5개)</h3>
                <Badge variant="outline" className="border-primary/30 text-xs">
                  총 {result.result.positions.length}개 종목 분석
                </Badge>
              </div>
              {topPositions.length === 0 ? (
                <Alert variant="default">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    분석 가능한 포지션이 없습니다. 포트폴리오 데이터를 확인해주세요.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-lg border border-primary/10 bg-background/80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>종목</TableHead>
                        <TableHead className="text-right">현재가</TableHead>
                        <TableHead className="text-right">예상가</TableHead>
                        <TableHead className="text-right">예상 손익</TableHead>
                        <TableHead className="text-right">예상 수익률</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topPositions.map((position: ScenarioPositionProjection) => (
                        <TableRow key={position.symbol}>
                          <TableCell className="font-medium">{position.symbol}</TableCell>
                          <TableCell className="text-right">
                            {formatAmount(position.currentPrice, position.currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(position.projectedPrice, position.currency)}
                          </TableCell>
                          <TableCell
                            className={`text-right ${
                              position.projectedProfitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {formatAmount(position.projectedProfitLoss, 'KRW')}
                          </TableCell>
                          <TableCell
                            className={`text-right ${
                              position.projectedReturnRate >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {formatPercent(position.projectedReturnRate)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

