import axios from 'axios';

import type { Sector } from '@/types';
import { normalizeSector } from '@/lib/utils/sectors';

interface CachedSectorWeights {
  weights: Record<Sector, number>;
  timestamp: number;
}

const HOLDINGS_CACHE = new Map<string, CachedSectorWeights>();
const HOLDINGS_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

const YAHOO_QUOTE_SUMMARY_ENDPOINT = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary';

function normalizeEtfIdentifier(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const compact = value
    .trim()
    .toUpperCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^0-9A-Z\.]/g, '');

  return compact.length > 0 ? compact : null;
}

function buildYahooSymbolCandidates(identifier: string): string[] {
  const normalized = identifier.replace(/[^0-9A-Z]/g, '');
  const candidates = new Set<string>();

  candidates.add(identifier);

  const isNumeric = /^[0-9]+$/.test(normalized);
  if (isNumeric) {
    candidates.add(`${normalized}.KS`);
    candidates.add(`${normalized}.KQ`);
  } else if (!identifier.includes('.')) {
    candidates.add(`${identifier}.US`);
  }

  return Array.from(candidates);
}

function normalizeWeights(entries: any[]): Record<Sector, number> | null {
  const aggregated: Record<Sector, number> = {} as Record<Sector, number>;
  let total = 0;

  entries.forEach((entry) => {
    const rawSector = entry?.sector ?? entry?.sectorName ?? entry?.label;
    if (typeof rawSector !== 'string' || rawSector.trim().length === 0) {
      return;
    }

    const sector = normalizeSector(rawSector) as Sector;
    const rawWeight = entry?.weight ?? entry?.percentage ?? entry?.value;
    let weight = typeof rawWeight === 'number' ? rawWeight : Number(String(rawWeight).replace(/[^0-9.\-]/g, ''));

    if (!Number.isFinite(weight) || weight <= 0) {
      return;
    }

    if (weight > 1) {
      weight = weight / 100;
    }

    aggregated[sector] = (aggregated[sector] ?? 0) + weight;
    total += weight;
  });

  if (total <= 0) {
    return null;
  }

  const normalized: Record<Sector, number> = {} as Record<Sector, number>;
  Object.entries(aggregated).forEach(([sector, weight]) => {
    normalized[sector as Sector] = weight / total;
  });

  const sum = Object.values(normalized).reduce((acc, value) => acc + value, 0);
  if (sum < 0.999) {
    normalized.other = (normalized.other ?? 0) + (1 - sum);
  }

  return normalized;
}

async function fetchYahooSectorWeightings(symbol: string): Promise<Record<Sector, number> | null> {
  const candidates = buildYahooSymbolCandidates(symbol);

  for (const candidate of candidates) {
    try {
      const response = await axios.get(`${YAHOO_QUOTE_SUMMARY_ENDPOINT}/${candidate}`, {
        params: {
          modules: 'topHoldings',
          region: 'US',
          lang: 'en-US',
        },
        timeout: 10000,
      });

      const weightings =
        response.data?.quoteSummary?.result?.[0]?.topHoldings?.sectorWeightings;

      if (Array.isArray(weightings) && weightings.length > 0) {
        const normalized = normalizeWeights(weightings);
        if (normalized) {
          return normalized;
        }
      }
    } catch (error) {
      console.warn('[etfHoldings] Yahoo sector weight fetch failed', {
        candidate,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      });
    }
  }

  return null;
}

export async function loadEtfHoldingsSectorWeights(
  symbol?: string | null
): Promise<Record<Sector, number> | null> {
  const identifier = normalizeEtfIdentifier(symbol);
  if (!identifier) {
    return null;
  }

  const cached = HOLDINGS_CACHE.get(identifier);
  if (cached && Date.now() - cached.timestamp < HOLDINGS_CACHE_TTL) {
    return cached.weights;
  }

  const weights = await fetchYahooSectorWeightings(identifier);
  if (!weights) {
    return null;
  }

  HOLDINGS_CACHE.set(identifier, { weights, timestamp: Date.now() });
  return weights;
}


