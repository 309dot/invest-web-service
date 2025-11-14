import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatShares } from '@/lib/utils/formatters';
import type { DisplayCurrency } from '@/lib/contexts/CurrencyContext';
import type { TransactionStats } from '@/types';

type TransactionSummaryCardsProps = {
  stats: TransactionStats;
  displayCurrency: DisplayCurrency;
  formatAmount: (amount: number, sourceCurrency: 'USD' | 'KRW') => string;
};

const CURRENCY_LABEL: Record<'USD' | 'KRW', string> = {
  USD: 'USD 기준',
  KRW: 'KRW 기준',
};

const EXCHANGE_SOURCE_LABEL: Record<'live' | 'cache' | 'fallback', string> = {
  live: '실시간',
  cache: '캐시',
  fallback: '백업',
};

export function TransactionSummaryCards({
  stats,
  displayCurrency,
  formatAmount,
}: TransactionSummaryCardsProps) {
  if (!stats) {
    return null;
  }

  const resolveTargetCurrency = (): 'USD' | 'KRW' => {
    if (displayCurrency === 'USD' || displayCurrency === 'KRW') {
      return displayCurrency;
    }

    const base = stats.combined.baseCurrency;
    if ((base === 'USD' || base === 'KRW') && stats.byCurrency[base]) {
      const baseTotals =
        stats.byCurrency[base].totalBuyAmount + stats.byCurrency[base].totalSellAmount;
      if (baseTotals > 0) {
        return base;
      }
    }

    const usdTotals = stats.byCurrency.USD.totalBuyAmount + stats.byCurrency.USD.totalSellAmount;
    const krwTotals = stats.byCurrency.KRW.totalBuyAmount + stats.byCurrency.KRW.totalSellAmount;
    return krwTotals > usdTotals ? 'KRW' : 'USD';
  };

  const targetCurrency = resolveTargetCurrency();
  const convertedTotals = stats.converted[targetCurrency];
  const totalBuyShares = stats.byCurrency.USD.totalBuys + stats.byCurrency.KRW.totalBuys;
  const totalSellShares = stats.byCurrency.USD.totalSells + stats.byCurrency.KRW.totalSells;

  const averageBuyPrice =
    totalBuyShares > 0 ? convertedTotals.totalBuyAmount / totalBuyShares : 0;
  const averageSellPrice =
    totalSellShares > 0 ? convertedTotals.totalSellAmount / totalSellShares : 0;

  const netFlow = convertedTotals.totalSellAmount - convertedTotals.totalBuyAmount;
  const netDisplayValue = formatAmount(Math.abs(netFlow), targetCurrency);
  const netValue =
    netFlow === 0 ? formatAmount(0, targetCurrency) : `${netFlow >= 0 ? '+' : '-'}${netDisplayValue}`;

  const summaryItems = [
    {
      key: 'buy',
      title: '총 매수 금액',
      value: formatAmount(convertedTotals.totalBuyAmount, targetCurrency),
      tone: 'positive' as const,
      description:
        totalBuyShares > 0
          ? `${formatShares(totalBuyShares)}주 · 평균 ${formatAmount(averageBuyPrice, targetCurrency)}`
          : '매수 거래가 없습니다.',
    },
    {
      key: 'sell',
      title: '총 매도 금액',
      value: formatAmount(convertedTotals.totalSellAmount, targetCurrency),
      tone: 'negative' as const,
      description:
        totalSellShares > 0
          ? `${formatShares(totalSellShares)}주 · 평균 ${formatAmount(averageSellPrice, targetCurrency)}`
          : '매도 거래가 없습니다.',
    },
    {
      key: 'net',
      title: '순매수',
      value: netValue,
      tone: netFlow >= 0 ? 'positive' : 'negative',
      description:
        netFlow === 0
          ? '매수와 매도가 동일합니다.'
          : netFlow > 0
          ? `순매도: 매도 금액이 매수를 ${netDisplayValue} 초과했습니다.`
          : `순매수: 매수 금액이 매도를 ${netDisplayValue} 초과했습니다.`,
    },
  ];

  return (
    <Card className="border-muted/60 bg-background/80 shadow-sm">
      <CardContent className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">거래 요약</p>
            <p className="text-xs text-muted-foreground/80">
              표시 통화에 따라 금액이 환산되어 표시됩니다.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-medium uppercase tracking-wide">
            {displayCurrency === 'original'
              ? CURRENCY_LABEL[targetCurrency]
              : CURRENCY_LABEL[displayCurrency]}
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {summaryItems.map((item) => (
            <div
              key={item.key}
              className={cn(
                'rounded-lg border border-muted/70 bg-muted/40 p-4 transition hover:border-primary/40 hover:bg-background/90',
                item.tone === 'positive'
                  ? 'shadow-[0_1px_0_rgba(16,185,129,0.08)]'
                  : item.tone === 'negative'
                  ? 'shadow-[0_1px_0_rgba(248,113,113,0.1)]'
                  : undefined
              )}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.title}
              </p>
              <p
                className={cn(
                  'mt-2 text-2xl font-semibold md:text-3xl',
                  item.key === 'sell'
                    ? 'text-red-500 dark:text-red-400'
                    : item.key === 'net'
                    ? netFlow >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-500 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                )}
              >
                {item.value}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>

        {stats.exchangeRate && (
          <p className="text-xs text-muted-foreground/80">
            기준 환율: 1 {stats.exchangeRate.base} = {stats.exchangeRate.rate.toFixed(2)}{' '}
            {stats.exchangeRate.quote} ({EXCHANGE_SOURCE_LABEL[stats.exchangeRate.source]} 기준)
          </p>
        )}
      </CardContent>
    </Card>
  );
}


