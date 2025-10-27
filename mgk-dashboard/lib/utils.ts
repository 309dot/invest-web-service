import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
