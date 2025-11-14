import { subDays, parseISO, isValid } from 'date-fns';

import { getDocumentsByDateRange } from '@/lib/firestore';
import type { BacktestResponse, BacktestStrategy, DailyPurchase } from '@/types';

function calculateDailyReturns(entries: DailyPurchase[]): Array<{ date: string; return: number }> {
  const returns: Array<{ date: string; return: number }> = [];
  for (let i = 1; i < entries.length; i += 1) {
    const prev = entries[i - 1];
    const current = entries[i];
    const prevValue = prev.totalValue || 0;
    const currentValue = current.totalValue || 0;

    if (prevValue > 0) {
      const dailyReturn = (currentValue - prevValue) / prevValue;
      returns.push({ date: current.date, return: dailyReturn });
    } else {
      returns.push({ date: current.date, return: 0 });
    }
  }
  return returns;
}

function applyStrategyMultiplier(strategy: BacktestStrategy, dailyReturn: number): number {
  switch (strategy) {
    case 'growth':
      return dailyReturn * 1.1 + 0.0002;
    case 'defensive':
      return dailyReturn * 0.75;
    case 'diversified':
      return dailyReturn * 0.9 + 0.0005;
    case 'equal':
      return dailyReturn * 0.95;
    default:
      return dailyReturn;
  }
}

function compoundReturns(returns: Array<{ date: string; return: number }>, strategy: BacktestStrategy) {
  let baselineValue = 1;
  let scenarioValue = 1;
  let peakBaseline = 1;
  let peakScenario = 1;
  let maxDrawdownBaseline = 0;
  let maxDrawdownScenario = 0;

  const baselineSeries: BacktestResponse['series'] = [];
  const baselineReturns: number[] = [];
  const scenarioReturns: number[] = [];

  returns.forEach((entry) => {
    baselineValue *= 1 + entry.return;
    const scenarioReturn = applyStrategyMultiplier(strategy, entry.return);
    scenarioValue *= 1 + scenarioReturn;

    baselineReturns.push(entry.return);
    scenarioReturns.push(scenarioReturn);

    peakBaseline = Math.max(peakBaseline, baselineValue);
    peakScenario = Math.max(peakScenario, scenarioValue);

    const drawdownBaseline = (baselineValue - peakBaseline) / peakBaseline;
    const drawdownScenario = (scenarioValue - peakScenario) / peakScenario;

    maxDrawdownBaseline = Math.min(maxDrawdownBaseline, drawdownBaseline);
    maxDrawdownScenario = Math.min(maxDrawdownScenario, drawdownScenario);

    baselineSeries.push({
      date: entry.date,
      baseline: parseFloat(baselineValue.toFixed(6)),
      scenario: parseFloat(scenarioValue.toFixed(6)),
    });
  });

  return {
    series: baselineSeries,
    baselineValue,
    scenarioValue,
    baselineReturns,
    scenarioReturns,
    maxDrawdownBaseline,
    maxDrawdownScenario,
  };
}

function calculateVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length === 0) {
    return 0;
  }
  const mean = dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / dailyReturns.length;
  const dailyVolatility = Math.sqrt(variance);
  return dailyVolatility * Math.sqrt(252);
}

function calculateAnnualizedReturn(totalReturn: number, days: number): number {
  if (days <= 0) {
    return 0;
  }
  const periods = 252 / days;
  return (Math.pow(1 + totalReturn, periods) - 1) || 0;
}

export async function runBacktest(options: {
  userId: string;
  portfolioId: string;
  periodDays?: number;
  strategy?: BacktestStrategy;
}): Promise<BacktestResponse> {
  const { userId, portfolioId, periodDays = 365, strategy = 'baseline' } = options;

  const endDate = new Date();
  const startDate = subDays(endDate, periodDays);
  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);

  const entries = await getDocumentsByDateRange<DailyPurchase>('dailyPurchases', 'date', start, end);
  const filtered = entries
    .filter((entry) => entry.portfolioId === portfolioId && entry.userId === userId)
    .sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      if (!isValid(dateA) || !isValid(dateB)) {
        return 0;
      }
      return dateA.getTime() - dateB.getTime();
    });

  if (filtered.length < 10) {
    return {
      success: true,
      strategy,
      period: {
        startDate: start,
        endDate: end,
        days: periodDays,
      },
      baseline: {
        totalReturn: 0,
        annualizedReturn: 0,
        volatility: 0,
        maxDrawdown: 0,
      },
      scenario: {
        totalReturn: 0,
        annualizedReturn: 0,
        volatility: 0,
        maxDrawdown: 0,
      },
      series: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const dailyReturns = calculateDailyReturns(filtered);

  const { series, baselineValue, scenarioValue, baselineReturns, scenarioReturns, maxDrawdownBaseline, maxDrawdownScenario } =
    compoundReturns(dailyReturns, strategy);

  const baselineTotalReturn = baselineValue - 1;
  const scenarioTotalReturn = scenarioValue - 1;

  return {
    success: true,
    strategy,
    period: {
      startDate: filtered[0].date,
      endDate: filtered[filtered.length - 1].date,
      days: dailyReturns.length,
    },
    baseline: {
      totalReturn: parseFloat((baselineTotalReturn * 100).toFixed(2)),
      annualizedReturn: parseFloat(
        (calculateAnnualizedReturn(baselineTotalReturn, dailyReturns.length) * 100).toFixed(2)
      ),
      volatility: parseFloat((calculateVolatility(baselineReturns) * 100).toFixed(2)),
      maxDrawdown: parseFloat((maxDrawdownBaseline * 100).toFixed(2)),
    },
    scenario: {
      totalReturn: parseFloat((scenarioTotalReturn * 100).toFixed(2)),
      annualizedReturn: parseFloat(
        (calculateAnnualizedReturn(scenarioTotalReturn, dailyReturns.length) * 100).toFixed(2)
      ),
      volatility: parseFloat((calculateVolatility(scenarioReturns) * 100).toFixed(2)),
      maxDrawdown: parseFloat((maxDrawdownScenario * 100).toFixed(2)),
    },
    series,
    generatedAt: new Date().toISOString(),
  };
}

