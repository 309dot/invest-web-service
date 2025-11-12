import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Sector } from '@/types';

const SHARE_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 6,
  maximumFractionDigits: 6,
});

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number,
  currency: 'USD' | 'KRW' = 'USD'
): string {
  const sign = amount < 0 ? '-' : '';
  const value = Math.abs(amount);

  if (currency === 'KRW') {
    const formatted = new Intl.NumberFormat('ko-KR', {
      maximumFractionDigits: 0,
    }).format(Math.round(value));
    return `${sign}${formatted}원`;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${sign}$${formatted}`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
  if (!Number.isFinite(value)) {
    return '0.00%';
  }

  const absolute = Math.abs(value);
  const multiplier = 10 ** decimals;
  let rounded = Math.round(absolute * multiplier) / multiplier;

  if (rounded === 0 && absolute > 0) {
    rounded = 1 / multiplier;
  }

  const signedValue = value >= 0 ? rounded : -rounded;
  const formatted = signedValue.toFixed(decimals);
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatted}%`;
}

/**
 * Format date to Korean style
 */
export function formatDate(date: string | Date, formatStr: string = 'yyyy년 MM월 dd일'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr, { locale: ko });
}

/**
 * Format relative time (e.g., "2시간 전")
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true, locale: ko });
}

/**
 * Format relative date (alias for formatRelativeTime)
 */
export function formatRelativeDate(date: string | Date): string {
  return formatRelativeTime(date);
}

/**
 * Format number with commas
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format large numbers (K, M, B)
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toFixed(0);
}

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export function formatInputDate(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatInputTime(date: Date = new Date()): string {
  return format(date, 'HH:mm');
}

/**
 * Format datetime
 */
export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Format time only
 */
export function formatTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'HH:mm:ss');
}

/**
 * Format week (YYYY-WW)
 */
export function formatWeek(week: string): string {
  const [year, weekNum] = week.split('-W');
  return `${year}년 ${weekNum}주차`;
}

/**
 * Format price with appropriate decimals
 */
export function formatPrice(price: number): string {
  if (price >= 1000) {
    return formatCurrency(price, 'USD');
  }
  return `$${price.toFixed(2)}`;
}

/**
 * Format exchange rate
 */
export function formatExchangeRate(rate: number): string {
  return `₩${formatNumber(rate, 2)}`;
}

/**
 * Format shares with appropriate decimals
 */
export function formatShares(shares: number): string {
  if (!Number.isFinite(shares)) {
    return '0.000000';
  }
  return SHARE_FORMATTER.format(shares);
}

const SECTOR_LABELS_KO: Record<Sector, string> = {
  'communication-services': '커뮤니케이션 서비스',
  'consumer-discretionary': '경기소비재',
  'consumer-staples': '필수소비재',
  energy: '에너지',
  financials: '금융',
  'health-care': '헬스케어',
  industrials: '산업재',
  'information-technology': '정보기술',
  materials: '소재',
  'real-estate': '부동산',
  utilities: '유틸리티',
  other: '기타',
};

const SECTOR_LABELS_EN: Record<Sector, string> = {
  'communication-services': 'Communication Services',
  'consumer-discretionary': 'Consumer Discretionary',
  'consumer-staples': 'Consumer Staples',
  energy: 'Energy',
  financials: 'Financials',
  'health-care': 'Health Care',
  industrials: 'Industrials',
  'information-technology': 'Information Technology',
  materials: 'Materials',
  'real-estate': 'Real Estate',
  utilities: 'Utilities',
  other: 'Other',
};

export function formatSectorLabel(sector: Sector, locale: 'ko' | 'en' = 'ko'): string {
  const normalized = sector || 'other';
  if (locale === 'en') {
    return SECTOR_LABELS_EN[normalized] ?? SECTOR_LABELS_EN.other;
  }
  return SECTOR_LABELS_KO[normalized] ?? SECTOR_LABELS_KO.other;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format period range
 */
export function formatPeriod(startDate: string, endDate: string): string {
  return `${formatDate(startDate, 'yyyy-MM-dd')} ~ ${formatDate(endDate, 'yyyy-MM-dd')}`;
}
