"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { CorrelationMatrixResponse, StockComparisonPeriod } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const PERIOD_OPTIONS: Array<{ id: StockComparisonPeriod; label: string }> = [
  { id: '1m', label: '1개월' },
  { id: '3m', label: '3개월' },
  { id: '6m', label: '6개월' },
  { id: '1y', label: '1년' },
];

type HeatmapMode = 'signed' | 'absolute';

interface CorrelationHeatmapProps {
  portfolioId: string;
}

function toColor(value: number | null, mode: HeatmapMode): string {
  if (value === null || Number.isNaN(value)) {
    return 'var(--background)';
  }
  const bounded = Math.max(-1, Math.min(1, value));
  const magnitude = Math.abs(bounded);
  const saturation = 70;
  const lightness = 96 - magnitude * 45;

  if (mode === 'absolute') {
    const hue = 210;
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  const hue = bounded >= 0 ? 145 : 0;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function formatCorrelation(value: number | null, mode: HeatmapMode): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  const display = mode === 'absolute' ? Math.abs(value) : value;
  return display.toFixed(2);
}

type CorrelationLevel =
  | 'strong-positive'
  | 'moderate-positive'
  | 'mild-positive'
  | 'neutral'
  | 'mild-negative'
  | 'moderate-negative'
  | 'strong-negative'
  | 'insufficient';

function getCorrelationLevel(value: number | null): CorrelationLevel {
  if (value === null || Number.isNaN(value)) {
    return 'insufficient';
  }
  if (value >= 0.75) {
    return 'strong-positive';
  }
  if (value >= 0.5) {
    return 'moderate-positive';
  }
  if (value >= 0.15) {
    return 'mild-positive';
  }
  if (value <= -0.75) {
    return 'strong-negative';
  }
  if (value <= -0.5) {
    return 'moderate-negative';
  }
  if (value <= -0.15) {
    return 'mild-negative';
  }
  return 'neutral';
}

const LEVEL_BADGE: Record<
  CorrelationLevel,
  { label: string; className: string }
> = {
  'strong-positive': { label: '매우 높은 정(+)상관', className: 'border-emerald-500 text-emerald-600' },
  'moderate-positive': { label: '높은 정(+)상관', className: 'border-emerald-400 text-emerald-500' },
  'mild-positive': { label: '완만한 정(+)상관', className: 'border-emerald-300 text-emerald-500' },
  neutral: { label: '중립', className: 'border-muted-foreground text-muted-foreground' },
  'mild-negative': { label: '완만한 역(-)상관', className: 'border-rose-300 text-rose-500' },
  'moderate-negative': { label: '높은 역(-)상관', className: 'border-rose-400 text-rose-500' },
  'strong-negative': { label: '매우 높은 역(-)상관', className: 'border-rose-500 text-rose-600' },
  insufficient: { label: '데이터 부족', className: 'border-muted-foreground/40 text-muted-foreground' },
};

const LEVEL_INSIGHT: Record<
  CorrelationLevel,
  { title: string; description: string }
> = {
  'strong-positive': {
    title: '거의 동일하게 움직입니다',
    description: '두 자산이 같은 방향으로 크게 움직입니다. 비중을 동시에 늘리면 분산 효과가 낮아집니다.',
  },
  'moderate-positive': {
    title: '높은 동조화',
    description: '대부분의 구간에서 같은 방향으로 움직입니다. 리밸런싱 시 한쪽 비중을 줄여 중복 위험을 관리하세요.',
  },
  'mild-positive': {
    title: '부분적으로 동조',
    description: '유사한 흐름이지만 예외 구간이 존재합니다. 특정 섹터/지역의 공통 요인을 점검하세요.',
  },
  neutral: {
    title: '중립 관계',
    description: '움직임이 크게 연관되지 않습니다. 분산 투자 측면에서는 이상적인 조합입니다.',
  },
  'mild-negative': {
    title: '완만한 헤지 효과',
    description: '주요 구간에서 반대 방향으로 움직입니다. 변동성 완화를 위해 비중을 조정해보세요.',
  },
  'moderate-negative': {
    title: '강한 헤지 후보',
    description: '상당히 반대로 움직입니다. 시장 하락기에 방어적인 조합으로 사용할 수 있습니다.',
  },
  'strong-negative': {
    title: '거의 반대 움직임',
    description: '한쪽이 상승할 때 다른 쪽은 하락합니다. 포트폴리오 변동성 완화에 매우 유용하지만 리밸런싱 시 주의하세요.',
  },
  insufficient: {
    title: '데이터 부족',
    description: '유효한 표본이 부족하여 상관관계를 판단할 수 없습니다. 기간을 늘려 다시 확인하세요.',
  },
};

export function CorrelationHeatmap({ portfolioId }: CorrelationHeatmapProps) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<StockComparisonPeriod>('3m');
  const [includeBenchmarks, setIncludeBenchmarks] = useState(false);
  const [data, setData] = useState<CorrelationMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<HeatmapMode>('signed');
  const [threshold, setThreshold] = useState<number>(0.6);
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string; value: number | null } | null>(null);
  const [selectedPair, setSelectedPair] = useState<{ row: string; col: string; value: number | null } | null>(null);

  const fetchCorrelation = useCallback(async () => {
    if (!user) {
      return;
    }
    const params = new URLSearchParams({
      portfolioId,
      userId: user.uid,
      period,
    });
    if (includeBenchmarks) {
      params.set('includeBenchmarks', 'true');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/portfolio/correlation?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`요청 실패 (status: ${response.status}) ${text}`);
      }
      const payload = (await response.json()) as CorrelationMatrixResponse;
      setData(payload);
    } catch (err) {
      console.error('[CorrelationHeatmap] 데이터 로딩 실패', err);
      setError(err instanceof Error ? err.message : '상관관계 데이터를 불러오지 못했습니다.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [includeBenchmarks, period, portfolioId, user]);

  useEffect(() => {
    fetchCorrelation();
  }, [fetchCorrelation]);

  const symbols = data?.symbols ?? [];
  const matrix = data?.matrix ?? [];
  const hasMatrix = symbols.length > 0 && matrix.length === symbols.length;
  const generatedAt = data?.generatedAt ?? null;
  const baseCurrency = data?.baseCurrency ?? 'KRW';
  const meta = data?.meta;
  const dateCount = meta?.dateCount ?? (matrix[0]?.length ?? 0);
  const coverageRatio = meta?.coverageRatio ?? null;
  const totalSeries = meta?.totalSeries ?? symbols.length;

  useEffect(() => {
    setHoveredCell(null);
    setSelectedPair(null);
  }, [period, includeBenchmarks, portfolioId, generatedAt]);

  const symbolMap = useMemo(() => {
    const map = new Map<string, CorrelationMatrixResponse['symbols'][number]>();
    symbols.forEach((item) => map.set(item.symbol, item));
    return map;
  }, [symbols]);

  const activeCell = selectedPair ?? hoveredCell;

  const activeDetail = useMemo(() => {
    if (!activeCell) {
      return null;
    }
    const row = symbolMap.get(activeCell.row);
    const col = symbolMap.get(activeCell.col);
    if (!row || !col || row.symbol === col.symbol) {
      return null;
    }
    const level = getCorrelationLevel(activeCell.value);
    return {
      row,
      col,
      value: activeCell.value,
      level,
      badge: LEVEL_BADGE[level],
      insight: LEVEL_INSIGHT[level],
    };
  }, [activeCell, symbolMap]);

  const handleCellClick = useCallback(
    (rowSymbol: string, colSymbol: string, value: number | null) => {
      if (rowSymbol === colSymbol) {
        return;
      }
      const [a, b] = rowSymbol < colSymbol ? [rowSymbol, colSymbol] : [colSymbol, rowSymbol];
      setSelectedPair((prev) => {
        if (prev && prev.row === a && prev.col === b) {
          return null;
        }
        return { row: a, col: b, value };
      });
    },
    []
  );

  const correlationSummary = useMemo(() => {
    if (!hasMatrix) {
      return null;
    }
    const positives: Array<{ pair: string; value: number }> = [];
    const negatives: Array<{ pair: string; value: number }> = [];
    for (let i = 0; i < symbols.length; i += 1) {
      for (let j = i + 1; j < symbols.length; j += 1) {
        const value = matrix[i][j];
        if (value === null || Number.isNaN(value)) {
          continue;
        }
        const pair = `${symbols[i].symbol}/${symbols[j].symbol}`;
        if (value >= 0.5) {
          positives.push({ pair, value });
        } else if (value <= -0.3) {
          negatives.push({ pair, value });
        }
      }
    }
    positives.sort((a, b) => b.value - a.value);
    negatives.sort((a, b) => a.value - b.value);
    return {
      positives: positives.slice(0, 3),
      negatives: negatives.slice(0, 3),
    };
  }, [hasMatrix, matrix, symbols]);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">상관관계 히트맵</CardTitle>
            <CardDescription>
              종목 간 동조화 정도를 색상으로 확인하고, 분산 투자 기회를 탐색하세요.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={period === option.id ? 'default' : 'outline'}
                onClick={() => setPeriod(option.id)}
              >
                {option.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant={includeBenchmarks ? 'default' : 'outline'}
              onClick={() => setIncludeBenchmarks((prev) => !prev)}
            >
              {includeBenchmarks ? '벤치마크 포함' : '벤치마크 제외'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && hasMatrix ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/10 bg-background/70 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground/70">표시</span>
              <Button
                size="sm"
                variant={displayMode === 'signed' ? 'default' : 'outline'}
                onClick={() => setDisplayMode('signed')}
              >
                정(±) 방향
              </Button>
              <Button
                size="sm"
                variant={displayMode === 'absolute' ? 'default' : 'outline'}
                onClick={() => setDisplayMode('absolute')}
              >
                절대값
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground/70">강도 기준</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(threshold * 100)}
                onChange={(event) => setThreshold(Number(event.target.value) / 100)}
                className="h-1 w-28"
                style={{ accentColor: 'hsl(var(--primary))' }}
              />
              <span className="font-semibold text-foreground">{Math.round(threshold * 100)}%</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground/70">기준 통화</span>
              <Badge variant="secondary" className="text-[11px]">
                {baseCurrency}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground/70">표본 {dateCount}일</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground/70">분석 종목 {totalSeries}개</span>
            </div>

            {coverageRatio !== null ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground/70">유효 데이터</span>
                <Badge variant="outline" className="text-[11px]">
                  {(coverageRatio * 100).toFixed(0)}%
                </Badge>
              </div>
            ) : null}

            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-xs font-semibold text-primary"
              onClick={() => {
                setSelectedPair(null);
                setHoveredCell(null);
              }}
            >
              선택 초기화
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !hasMatrix ? (
          <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            상관관계를 계산할 수 있는 데이터가 부족합니다. 기간을 늘리거나 보유 종목을 확인해주세요.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `160px repeat(${symbols.length}, minmax(96px, 1fr))`,
                }}
              >
                <div className="sticky left-0 z-20 bg-background p-2 text-xs font-semibold uppercase text-muted-foreground">
                  종목
                </div>
                {symbols.map((symbol) => (
                  <div
                    key={`header-${symbol.symbol}`}
                    className={cn(
                      'p-2 text-center text-xs font-semibold transition-colors',
                      symbol.isBenchmark ? 'uppercase tracking-wide' : '',
                      activeCell &&
                        (activeCell.row === symbol.symbol || activeCell.col === symbol.symbol)
                        ? 'bg-primary/10 text-primary shadow-inner'
                        : 'text-muted-foreground'
                    )}
                  >
                    {symbol.symbol}
                    {symbol.isBenchmark ? (
                      <Badge variant="outline" className="ml-1 text-[10px] uppercase">
                        Bench
                      </Badge>
                    ) : null}
                  </div>
                ))}

                {symbols.map((rowSymbol, rowIndex) => (
                  <div key={`row-${rowSymbol.symbol}`} className="contents">
                    <div
                      className={cn(
                        'sticky left-0 z-10 bg-background p-2 text-xs font-semibold transition-colors',
                        activeCell &&
                          (activeCell.row === rowSymbol.symbol || activeCell.col === rowSymbol.symbol)
                          ? 'bg-primary/10 text-primary shadow-inner'
                          : 'text-muted-foreground'
                      )}
                    >
                      {rowSymbol.symbol}{' '}
                      <span className="text-muted-foreground/70">{rowSymbol.name}</span>
                    </div>
                    {symbols.map((colSymbol, colIndex) => {
                      const value = matrix[rowIndex][colIndex];
                      const isDiagonal = rowIndex === colIndex;
                      const [a, b] =
                        rowSymbol.symbol < colSymbol.symbol
                          ? [rowSymbol.symbol, colSymbol.symbol]
                          : [colSymbol.symbol, rowSymbol.symbol];
                      const isSelected =
                        selectedPair !== null && selectedPair.row === a && selectedPair.col === b;
                      const isThreshold =
                        !isDiagonal && value !== null && Math.abs(value) >= threshold;
                      const isHovered =
                        hoveredCell !== null &&
                        (hoveredCell.row === rowSymbol.symbol || hoveredCell.col === colSymbol.symbol);
                      const toneClass =
                        value === null
                          ? 'text-muted-foreground'
                          : displayMode === 'signed'
                          ? value >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-600'
                          : 'text-slate-700';
                      return (
                        <div
                          key={`cell-${rowSymbol.symbol}-${colSymbol.symbol}`}
                          role="button"
                          tabIndex={isDiagonal ? -1 : 0}
                          aria-pressed={isSelected}
                          onMouseEnter={() =>
                            setHoveredCell({ row: rowSymbol.symbol, col: colSymbol.symbol, value })
                          }
                          onMouseLeave={() =>
                            setHoveredCell((prev) =>
                              prev &&
                              prev.row === rowSymbol.symbol &&
                              prev.col === colSymbol.symbol
                                ? null
                                : prev
                            )
                          }
                          onClick={() => handleCellClick(rowSymbol.symbol, colSymbol.symbol, value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleCellClick(rowSymbol.symbol, colSymbol.symbol, value);
                            }
                          }}
                          className={cn(
                            'relative flex h-16 items-center justify-center border border-primary/10 text-xs font-semibold transition-all',
                            isDiagonal ? 'bg-muted/60 text-muted-foreground' : 'cursor-pointer hover:scale-[1.02]',
                            !isDiagonal && isThreshold && !isSelected ? 'ring-1 ring-inset ring-primary/40' : '',
                            !isDiagonal && isHovered && !isSelected ? 'ring-1 ring-inset ring-primary/25' : '',
                            isSelected ? 'ring-2 ring-primary shadow-md ring-offset-1 ring-offset-background' : ''
                          )}
                          style={{
                            backgroundColor: isDiagonal ? 'hsl(var(--muted))' : toColor(value, displayMode),
                          }}
                        >
                          <span className={toneClass}>{formatCorrelation(value, displayMode)}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground/70">범례</span>
                <div
                  className="h-2 w-36 rounded-full shadow-inner"
                  style={{
                    background:
                      displayMode === 'absolute'
                        ? 'linear-gradient(90deg, hsl(210 25% 92%) 0%, hsl(210 65% 70%) 100%)'
                        : 'linear-gradient(90deg, hsl(0 70% 70%) 0%, hsl(210 10% 95%) 50%, hsl(145 70% 60%) 100%)',
                  }}
                />
              </div>
              {displayMode === 'signed' ? (
                <>
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-[hsl(145,70%,60%)]" />
                    양의 상관
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-[hsl(0,70%,60%)]" />
                    음의 상관
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full bg-[hsl(210,65%,65%)]" />
                  절대값이 높을수록 짙어집니다
                </span>
              )}
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3" />
                상관관계는 과거 데이터 기반이며 미래 수익을 보장하지 않습니다.
              </span>
              {generatedAt ? (
                <span className="ml-auto text-[11px]">
                  업데이트: {new Date(generatedAt).toLocaleString()}
                </span>
              ) : null}
            </div>

            {correlationSummary ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="text-sm font-semibold text-emerald-700">
                    높은 양의 상관관계 (동일한 움직임)
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {correlationSummary.positives.length === 0 ? (
                      <li>특별히 높은 양의 상관관계가 감지되지 않았습니다.</li>
                    ) : (
                      correlationSummary.positives.map((item) => {
                        const level = getCorrelationLevel(item.value);
                        const badge = LEVEL_BADGE[level];
                        return (
                          <li key={`pos-${item.pair}`} className="flex items-center justify-between gap-2">
                            <span>{item.pair}</span>
                            <span className="flex items-center gap-2">
                              <Badge variant="outline" className={cn('text-[10px]', badge.className)}>
                                {badge.label}
                              </Badge>
                              <span className="font-semibold text-emerald-600">
                                {formatCorrelation(item.value, 'signed')}
                              </span>
                            </span>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
                  <p className="text-sm font-semibold text-destructive">
                    음의 상관관계 (분산 효과)
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {correlationSummary.negatives.length === 0 ? (
                      <li>뚜렷한 음의 상관관계 조합이 없습니다.</li>
                    ) : (
                      correlationSummary.negatives.map((item) => {
                        const level = getCorrelationLevel(item.value);
                        const badge = LEVEL_BADGE[level];
                        return (
                          <li key={`neg-${item.pair}`} className="flex items-center justify-between gap-2">
                            <span>{item.pair}</span>
                            <span className="flex items-center gap-2">
                              <Badge variant="outline" className={cn('text-[10px]', badge.className)}>
                                {badge.label}
                              </Badge>
                              <span className="font-semibold text-rose-600">
                                {formatCorrelation(item.value, 'signed')}
                              </span>
                            </span>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </div>
            ) : null}

            <div className="rounded-md border border-primary/10 bg-background/80 p-4">
              {activeDetail ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {activeDetail.row.symbol} ↔ {activeDetail.col.symbol}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activeDetail.row.name} · {activeDetail.col.name}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('text-[11px] font-semibold', activeDetail.badge.className)}
                    >
                      {activeDetail.badge.label}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-semibold text-foreground">
                      상관계수 {formatCorrelation(activeDetail.value, 'signed')}
                    </span>
                    <span className="rounded-sm bg-muted px-2 py-1">
                      절대값 {formatCorrelation(activeDetail.value, 'absolute')}
                    </span>
                    <span className="rounded-sm bg-muted px-2 py-1">기준 통화 {baseCurrency}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">{activeDetail.insight.title}</p>
                    <p>{activeDetail.insight.description}</p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  셀을 클릭하면 선택한 종목 조합의 상관관계 인사이트가 표시됩니다.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

