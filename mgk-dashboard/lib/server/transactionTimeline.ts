import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, format, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

import { fetchTransactionsServer } from './transactionQueries';
import { convertWithRate, getUsdKrwRate } from '@/lib/currency';
import type {
  TransactionTimelineEntry,
  TransactionTimelineGranularity,
  TransactionTimelineResponse,
  TransactionTimelineSymbolSummary,
  Transaction,
} from '@/types';

type TimelineOptions = {
  granularity?: TransactionTimelineGranularity;
  months?: number;
  limit?: number;
  purchaseMethod?: 'auto' | 'manual';
  type?: 'buy' | 'sell' | 'dividend';
  symbol?: string;
  startDate?: string;
  endDate?: string;
};

type TimelineAccumulator = {
  key: string;
  start: Date;
  end: Date;
  buyCount: number;
  sellCount: number;
  autoCount: number;
  manualCount: number;
  totalsByCurrency: Record<
    'USD' | 'KRW',
    {
      buyAmount: number;
      sellAmount: number;
    }
  >;
  totalBuyBase: number;
  totalSellBase: number;
  symbolMap: Map<
    string,
    {
      count: number;
      buyAmountBase: number;
      sellAmountBase: number;
    }
  >;
};

function resolveTransactionCurrency(transaction: Transaction): 'USD' | 'KRW' {
  const raw = transaction.currency;
  if (typeof raw === 'string') {
    const upper = raw.toUpperCase();
    if (upper === 'KRW' || upper === 'USD') {
      return upper;
    }
  }

  const symbol = transaction.symbol?.trim() ?? '';
  if (/^[0-9]{4,6}$/.test(symbol)) {
    return 'KRW';
  }

  return 'USD';
}

function buildLabel(start: Date, end: Date, granularity: TransactionTimelineGranularity): string {
  if (granularity === 'week') {
    const startLabel = format(start, 'yyyy년 M월 d일', { locale: ko });
    const endLabel = format(end, start.getMonth() === end.getMonth() ? 'M월 d일' : 'yyyy년 M월 d일', {
      locale: ko,
    });
    return `${startLabel} ~ ${endLabel}`;
  }

  return format(start, 'yyyy년 M월', { locale: ko });
}

export async function getTransactionTimeline(
  userId: string,
  portfolioId: string,
  options: TimelineOptions = {}
): Promise<TransactionTimelineResponse> {
  const granularity: TransactionTimelineGranularity = options.granularity ?? 'week';
  const months = Math.max(1, options.months ?? 6);
  const limit = Math.max(1, options.limit ?? (granularity === 'week' ? 12 : 18));

  const { rate, source } = await getUsdKrwRate();

  const startDateISO =
    options.startDate && options.startDate.length >= 8
      ? options.startDate
      : format(subMonths(new Date(), months), 'yyyy-MM-dd');
  const endDateISO = options.endDate && options.endDate.length >= 8 ? options.endDate : undefined;

  const transactions = await fetchTransactionsServer(userId, portfolioId, {
    startDate: startDateISO,
    endDate: endDateISO,
    purchaseMethod: options.purchaseMethod,
    type: options.type,
    symbol: options.symbol,
  });

  const groups = new Map<string, TimelineAccumulator>();

  transactions.forEach((transaction) => {
    const dateRaw = transaction.displayDate ?? transaction.date;
    if (!dateRaw) {
      return;
    }

    const date = parseISO(dateRaw);
    if (Number.isNaN(date.getTime())) {
      return;
    }

    const start =
      granularity === 'week'
        ? startOfWeek(date, { weekStartsOn: 1 })
        : startOfMonth(date);
    const end =
      granularity === 'week'
        ? endOfWeek(date, { weekStartsOn: 1 })
        : endOfMonth(date);

    const key = `${granularity}-${format(start, 'yyyy-MM-dd')}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        start,
        end,
        buyCount: 0,
        sellCount: 0,
        autoCount: 0,
        manualCount: 0,
        totalsByCurrency: {
          USD: { buyAmount: 0, sellAmount: 0 },
          KRW: { buyAmount: 0, sellAmount: 0 },
        },
        totalBuyBase: 0,
        totalSellBase: 0,
        symbolMap: new Map(),
      });
    }

    const accumulator = groups.get(key)!;
    const currency = resolveTransactionCurrency(transaction);
    const amount =
      typeof transaction.totalAmount === 'number'
        ? transaction.totalAmount
        : typeof transaction.amount === 'number'
        ? transaction.amount
        : 0;
    const amountBase =
      currency === 'USD' ? amount : convertWithRate(amount, 'KRW', 'USD', rate);

    if (transaction.type === 'buy') {
      accumulator.buyCount += 1;
      accumulator.totalsByCurrency[currency].buyAmount += amount;
      accumulator.totalBuyBase += amountBase;
    } else if (transaction.type === 'sell') {
      accumulator.sellCount += 1;
      accumulator.totalsByCurrency[currency].sellAmount += amount;
      accumulator.totalSellBase += amountBase;
    }

    if (transaction.purchaseMethod === 'auto') {
      accumulator.autoCount += 1;
    } else if (transaction.purchaseMethod === 'manual') {
      accumulator.manualCount += 1;
    }

    if (transaction.symbol) {
      if (!accumulator.symbolMap.has(transaction.symbol)) {
        accumulator.symbolMap.set(transaction.symbol, {
          count: 0,
          buyAmountBase: 0,
          sellAmountBase: 0,
        });
      }
      const symbolStats = accumulator.symbolMap.get(transaction.symbol)!;
      symbolStats.count += 1;
      if (transaction.type === 'buy') {
        symbolStats.buyAmountBase += amountBase;
      } else if (transaction.type === 'sell') {
        symbolStats.sellAmountBase += amountBase;
      }
    }
  });

  const entries: TransactionTimelineEntry[] = Array.from(groups.values())
    .sort((a, b) => b.start.getTime() - a.start.getTime())
    .slice(0, limit)
    .map((group) => {
      const totalsByCurrency = {
        USD: {
          buyAmount: group.totalsByCurrency.USD.buyAmount,
          sellAmount: group.totalsByCurrency.USD.sellAmount,
          netAmount: group.totalsByCurrency.USD.sellAmount - group.totalsByCurrency.USD.buyAmount,
        },
        KRW: {
          buyAmount: group.totalsByCurrency.KRW.buyAmount,
          sellAmount: group.totalsByCurrency.KRW.sellAmount,
          netAmount: group.totalsByCurrency.KRW.sellAmount - group.totalsByCurrency.KRW.buyAmount,
        },
      };

      const topSymbols: TransactionTimelineSymbolSummary[] = Array.from(group.symbolMap.entries())
        .map(([symbol, stats]) => ({
          symbol,
          count: stats.count,
          buyAmountBase: stats.buyAmountBase,
          sellAmountBase: stats.sellAmountBase,
        }))
        .sort((a, b) => b.count - a.count || b.buyAmountBase + b.sellAmountBase - (a.buyAmountBase + a.sellAmountBase))
        .slice(0, 3);

      return {
        id: group.key,
        label: buildLabel(group.start, group.end, granularity),
        granularity,
        periodStart: format(group.start, 'yyyy-MM-dd'),
        periodEnd: format(group.end, 'yyyy-MM-dd'),
        totalTransactions: group.buyCount + group.sellCount,
        buyCount: group.buyCount,
        sellCount: group.sellCount,
        autoCount: group.autoCount,
        manualCount: group.manualCount,
        totalsByCurrency,
        netAmountBase: group.totalSellBase - group.totalBuyBase,
        topSymbols,
      };
    });

  return {
    entries,
    granularity,
    baseCurrency: 'USD',
    generatedAt: new Date().toISOString(),
    exchangeRate: {
      base: 'USD',
      quote: 'KRW',
      rate,
      source,
    },
  };
}


