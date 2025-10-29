import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Debounce function - delays execution until after wait milliseconds
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Build period range for date queries
 */
export function buildPeriodRange(periodDays: number) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - periodDays + 1)

  const toDateString = (date: Date) => date.toISOString().split('T')[0]

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
    periodLabel: `${toDateString(start)}_${toDateString(end)}`,
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
