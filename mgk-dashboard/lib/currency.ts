import { getExchangeRate } from '@/lib/apis/exchangerate';
import type { SupportedCurrency } from '@/types';

type FxCacheEntry = {
  rate: number;
  timestamp: number;
};

const FX_CACHE_KEY = 'USD-KRW';
const FX_CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes
const DEFAULT_FALLBACK_RATE = 1428.91;

const fxCache = new Map<string, FxCacheEntry>();

function isSupportedCurrency(value: string | null | undefined): value is SupportedCurrency {
  return value === 'USD' || value === 'KRW';
}

export function assertCurrency(value: string | null | undefined, fallback: SupportedCurrency = 'USD'): SupportedCurrency {
  if (isSupportedCurrency(value)) {
    return value;
  }
  return fallback;
}

export async function getUsdKrwRate(options: { forceRefresh?: boolean } = {}): Promise<{
  rate: number;
  source: 'cache' | 'live' | 'fallback';
}> {
  const cached = fxCache.get(FX_CACHE_KEY);

  if (!options.forceRefresh && cached && Date.now() - cached.timestamp < FX_CACHE_TTL_MS) {
    return { rate: cached.rate, source: 'cache' };
  }

  try {
    const result = await getExchangeRate('USD', 'KRW');
    if (typeof result?.rate === 'number' && Number.isFinite(result.rate) && result.rate > 0) {
      fxCache.set(FX_CACHE_KEY, {
        rate: result.rate,
        timestamp: Date.now(),
      });
      return { rate: result.rate, source: 'live' };
    }
  } catch (error) {
    console.error('[currency] 실시간 환율 조회 실패, 폴백 사용', error);
  }

  const fallbackRate = cached?.rate ?? DEFAULT_FALLBACK_RATE;
  if (!cached) {
    fxCache.set(FX_CACHE_KEY, {
      rate: fallbackRate,
      timestamp: Date.now(),
    });
  }

  return { rate: fallbackRate, source: 'fallback' };
}

export function convertWithRate(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
  rate: number
): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }

  if (from === to) {
    return amount;
  }

  if (!Number.isFinite(rate) || rate <= 0) {
    return amount;
  }

  if (from === 'USD' && to === 'KRW') {
    return amount * rate;
  }

  if (from === 'KRW' && to === 'USD') {
    return amount / rate;
  }

  return amount;
}

export function convertAmountsWithRate(
  amount: number,
  from: SupportedCurrency,
  targets: SupportedCurrency[],
  rate: number
): Record<SupportedCurrency, number> {
  const result: Record<SupportedCurrency, number> = {
    USD: 0,
    KRW: 0,
  };

  targets.forEach((target) => {
    result[target] = convertWithRate(amount, from, target, rate);
  });

  return result;
}

export function summarizeByCurrency<T extends { amount: number; currency: SupportedCurrency }>(
  items: T[]
): Record<SupportedCurrency, number> {
  return items.reduce(
    (acc, item) => {
      if (item.currency === 'USD') {
        acc.USD += item.amount;
      } else if (item.currency === 'KRW') {
        acc.KRW += item.amount;
      }
      return acc;
    },
    { USD: 0, KRW: 0 } as Record<SupportedCurrency, number>
  );
}

export function clearCurrencyCache() {
  fxCache.clear();
}

