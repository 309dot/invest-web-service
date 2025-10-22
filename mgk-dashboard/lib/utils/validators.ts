/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate date string (YYYY-MM-DD)
 */
export function isValidDate(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

/**
 * Validate non-negative number
 */
export function isNonNegativeNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}

/**
 * Validate ticker symbol (1-5 uppercase letters)
 */
export function isValidTickerSymbol(ticker: string): boolean {
  const tickerRegex = /^[A-Z]{1,5}$/;
  return tickerRegex.test(ticker);
}

/**
 * Validate percentage (0-100)
 */
export function isValidPercentage(value: number): boolean {
  return isNonNegativeNumber(value) && value <= 100;
}

/**
 * Validate URL
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate phone number (simple validation)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Validate string length
 */
export function isValidLength(
  str: string,
  min: number,
  max: number
): boolean {
  const length = str.length;
  return length >= min && length <= max;
}

/**
 * Validate required field (not empty)
 */
export function isRequired(value: any): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

/**
 * Validate number range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate decimal places
 */
export function hasValidDecimals(value: number, maxDecimals: number): boolean {
  const decimalPart = value.toString().split('.')[1];
  return !decimalPart || decimalPart.length <= maxDecimals;
}

/**
 * Validate array is not empty
 */
export function isNonEmptyArray<T>(arr: T[]): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Validate object is not empty
 */
export function isNonEmptyObject(obj: object): boolean {
  return obj !== null && typeof obj === 'object' && Object.keys(obj).length > 0;
}

/**
 * Validate future date
 */
export function isFutureDate(dateString: string): boolean {
  if (!isValidDate(dateString)) return false;
  const date = new Date(dateString);
  return date > new Date();
}

/**
 * Validate past date
 */
export function isPastDate(dateString: string): boolean {
  if (!isValidDate(dateString)) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Validate today or past date
 */
export function isTodayOrPastDate(dateString: string): boolean {
  if (!isValidDate(dateString)) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date <= today;
}

/**
 * Sanitize string (remove special characters)
 */
export function sanitizeString(str: string): string {
  return str.replace(/[^\w\s-]/g, '').trim();
}

/**
 * Validate currency code
 */
export function isValidCurrencyCode(code: string): boolean {
  const validCodes = ['USD', 'KRW', 'EUR', 'JPY', 'GBP', 'CNY'];
  return validCodes.includes(code.toUpperCase());
}

/**
 * Validate importance level
 */
export function isValidImportance(level: string): level is 'High' | 'Medium' | 'Low' {
  return ['High', 'Medium', 'Low'].includes(level);
}

/**
 * Validate category
 */
export function isValidCategory(category: string): category is 'tech' | 'economy' | 'market' {
  return ['tech', 'economy', 'market'].includes(category);
}
