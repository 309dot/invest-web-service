export function deriveDefaultPortfolioId(
  userId?: string | null,
  fallback: string = 'main'
): string {
  if (!userId) {
    return fallback;
  }

  return `${userId}_default`;
}


