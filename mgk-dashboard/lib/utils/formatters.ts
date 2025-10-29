import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number,
  currency: 'USD' | 'KRW' = 'USD'
): string {
  const locale = currency === 'KRW' ? 'ko-KR' : 'en-US';
  const currencyCode = currency;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: currency === 'KRW' ? 0 : 2,
    maximumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
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
  if (shares < 1) {
    return shares.toFixed(4);
  }
  if (shares < 10) {
    return shares.toFixed(2);
  }
  return formatNumber(shares, 2);
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
