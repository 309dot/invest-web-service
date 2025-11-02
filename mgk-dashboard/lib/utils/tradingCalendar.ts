import type { AutoInvestFrequency } from '@/types';

export type SupportedMarket = 'US' | 'KR' | 'GLOBAL' | undefined;

const MARKET_TIMEZONES: Record<'US' | 'KR' | 'GLOBAL', string> = {
  US: 'America/New_York',
  KR: 'Asia/Seoul',
  GLOBAL: 'UTC',
};

function resolveMarket(market?: SupportedMarket): 'US' | 'KR' | 'GLOBAL' {
  if (market === 'US' || market === 'KR') {
    return market;
  }
  if (market === 'GLOBAL') {
    return 'GLOBAL';
  }
  return 'US';
}

export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00Z`);
}

export function getMarketToday(market?: SupportedMarket): Date {
  const resolved = resolveMarket(market);
  const timeZone = MARKET_TIMEZONES[resolved];
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const formatted = formatter.format(new Date());
  return parseISODate(formatted);
}

export function isTradingDay(dateInput: string | Date, market?: SupportedMarket): boolean {
  const resolved = resolveMarket(market);
  const timeZone = MARKET_TIMEZONES[resolved];
  const date = typeof dateInput === 'string' ? parseISODate(dateInput) : new Date(dateInput);

  const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  });

  const weekday = weekdayFormatter.format(date);
  return weekday !== 'Sat' && weekday !== 'Sun';
}

export function adjustToNextTradingDay(
  dateInput: string | Date,
  market?: SupportedMarket
): Date {
  const resolved = resolveMarket(market);
  let date = typeof dateInput === 'string' ? parseISODate(dateInput) : new Date(dateInput.getTime());

  let guard = 0;
  while (!isTradingDay(date, resolved)) {
    date.setUTCDate(date.getUTCDate() + 1);
    guard += 1;
    if (guard > 14) {
      break;
    }
  }

  return parseISODate(formatDate(date));
}

export function isFutureTradingDate(dateInput: string | Date, market?: SupportedMarket): boolean {
  const date = typeof dateInput === 'string' ? parseISODate(dateInput) : new Date(dateInput);
  const today = getMarketToday(market);
  return date > today;
}

export function advanceByFrequency(
  dateInput: string | Date,
  frequency: AutoInvestFrequency
): Date {
  const date = typeof dateInput === 'string' ? parseISODate(dateInput) : new Date(dateInput.getTime());

  switch (frequency) {
    case 'daily':
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case 'weekly':
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case 'biweekly':
      date.setUTCDate(date.getUTCDate() + 14);
      break;
    case 'monthly':
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case 'quarterly':
      date.setUTCMonth(date.getUTCMonth() + 3);
      break;
  }

  return date;
}

export function determineMarketFromContext(
  market?: SupportedMarket,
  currency?: string,
  symbol?: string
): 'US' | 'KR' | 'GLOBAL' {
  if (market === 'US' || market === 'KR' || market === 'GLOBAL') {
    return market;
  }

  if (currency === 'KRW') {
    return 'KR';
  }

  if (typeof symbol === 'string' && /^[0-9]{4,6}$/.test(symbol)) {
    return 'KR';
  }

  return 'US';
}

