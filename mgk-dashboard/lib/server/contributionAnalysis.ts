import type {
  ContributionBreakdownEntry,
  ContributionBreakdownResponse,
  Position,
  StockComparisonPeriod,
} from '@/types';
import { assertCurrency, getUsdKrwRate, type SupportedCurrency } from '@/lib/currency';
import { formatPercent } from '@/lib/utils/formatters';

const PERIOD_LABEL: Record<StockComparisonPeriod, string> = {
  '1m': '최근 1개월',
  '3m': '최근 3개월',
  '6m': '최근 6개월',
  '1y': '최근 1년',
};

function toNumber(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return num;
}

function rankContribution(entries: ContributionBreakdownEntry[]): ContributionBreakdownEntry[] {
  if (entries.length === 0) {
    return entries;
  }

  const sorted = [...entries].sort((a, b) => Math.abs(b.contributionValue) - Math.abs(a.contributionValue));
  const threshold = sorted[Math.min(4, sorted.length - 1)].contributionValue ?? 0;

  const topContributors = new Set<string>();
  const laggards = new Set<string>();

  sorted.forEach((entry, index) => {
    if (index < 5 && entry.contributionValue > 0) {
      topContributors.add(entry.symbol);
    }
  });

  const laggardCandidates = sorted.filter((entry) => entry.contributionValue < 0).slice(0, 3);
  laggardCandidates.forEach((entry) => laggards.add(entry.symbol));

  return entries.map((entry) => ({
    ...entry,
    isTopContributor: topContributors.has(entry.symbol),
    isLagging: laggards.has(entry.symbol),
    tag: topContributors.has(entry.symbol)
      ? 'core'
      : laggards.has(entry.symbol)
      ? 'reducing'
      : entry.weightPct >= 5
      ? 'supporting'
      : 'watch',
  }));
}

function calculateContributionEntries(params: {
  positions: Position[];
  totalValue: number;
  totalInvested: number;
  baseCurrency: SupportedCurrency;
}): ContributionBreakdownEntry[] {
  const { positions, totalValue, totalInvested, baseCurrency } = params;

  if (!positions.length || totalValue <= 0) {
    return [];
  }

  return positions.map((position) => {
    const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
    const investmentValue = toNumber(position.totalInvested);
    const currentValue = toNumber(position.totalValue);
    const weightPct = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    const returnPct = position.returnRate ?? (investmentValue > 0 ? ((currentValue / investmentValue) - 1) * 100 : 0);
    const contributionValue = currentValue - investmentValue;
    const contributionPct = totalValue > 0 ? (contributionValue / totalValue) * 100 : 0;
    return {
      symbol: position.symbol,
      name: position.name ?? position.symbol,
      market: position.market,
      currency,
      weightPct,
      returnPct,
      contributionPct,
      contributionValue,
      investmentValue,
      currentValue,
      averagePrice: position.averagePrice ?? 0,
      currentPrice: position.currentPrice ?? 0,
      transactions: position.transactionCount ?? 0,
      isTopContributor: false,
      isLagging: false,
    };
  });
}

export async function getContributionBreakdown(options: {
  positions: Position[];
  period?: StockComparisonPeriod;
  baseCurrency?: SupportedCurrency;
}): Promise<ContributionBreakdownResponse> {
  const { positions, period = '3m', baseCurrency = 'KRW' } = options;

  const { rate } = await getUsdKrwRate();
  const totalValue = positions.reduce((sum, position) => sum + toNumber(position.totalValue), 0);
  const totalInvested = positions.reduce((sum, position) => sum + toNumber(position.totalInvested), 0);

  const entries = calculateContributionEntries({
    positions,
    totalValue,
    totalInvested,
    baseCurrency,
  });

  const rankedEntries = rankContribution(entries);
  const totalContributionValue = rankedEntries.reduce((sum, entry) => sum + entry.contributionValue, 0);
  const totalContributionPct = totalValue > 0 ? (totalContributionValue / totalValue) * 100 : 0;

  return {
    success: true,
    period,
    baseCurrency,
    entries: rankedEntries,
    totals: {
      totalContributionValue,
      totalContributionPct,
      totalInvested,
      totalValue,
    },
    generatedAt: new Date().toISOString(),
    meta: {
      periodLabel: PERIOD_LABEL[period],
      fxRate: rate,
      positionCount: positions.length,
      summary: `상위 기여도가 포트폴리오에 ${formatPercent(totalContributionPct)} 영향을 미쳤습니다.`,
    },
  };
}

