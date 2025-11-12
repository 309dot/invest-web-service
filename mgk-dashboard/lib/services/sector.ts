import axios from 'axios';
import type { Position, Sector, Stock } from '@/types';
import { getStocksBySymbols } from '@/lib/services/stock-master';

type SectorSource = 'position' | 'stock-master' | 'yahoo-profile' | 'yahoo-etf' | 'fallback';

export interface SectorWeighting {
  sector: Sector;
  weight: number;
  source: SectorSource;
}

export interface PositionSectorInfo {
  primarySector: Sector;
  source: SectorSource;
  weights: SectorWeighting[];
  rawSector?: string | null;
  symbol: string;
}

const SECTOR_ALIAS_MAP: Record<string, Sector> = {
  communicationservices: 'communication-services',
  communications: 'communication-services',
  telecommunicationservices: 'communication-services',
  telecommunications: 'communication-services',
  telecom: 'communication-services',
  media: 'communication-services',
  advertising: 'communication-services',
  entertainment: 'communication-services',

  consumerdiscretionary: 'consumer-discretionary',
  consumercyclical: 'consumer-discretionary',
  consumerdurables: 'consumer-discretionary',
  consumerservices: 'consumer-discretionary',
  travel: 'consumer-discretionary',
  leisure: 'consumer-discretionary',
  retail: 'consumer-discretionary',

  consumerstaples: 'consumer-staples',
  consumerdefensive: 'consumer-staples',
  consumergoods: 'consumer-staples',
  householdproducts: 'consumer-staples',
  food: 'consumer-staples',
  beverage: 'consumer-staples',
  tobacco: 'consumer-staples',

  energy: 'energy',
  oilgas: 'energy',
  oilgasandconsumablefuels: 'energy',
  renewableenergy: 'energy',

  financials: 'financials',
  financial: 'financials',
  financialservices: 'financials',
  banks: 'financials',
  banking: 'financials',
  insurance: 'financials',
  capitalmarkets: 'financials',

  healthcare: 'health-care',
  health: 'health-care',
  health-care: 'health-care',
  pharmaceuticals: 'health-care',
  biotechnology: 'health-care',
  life-sciences: 'health-care',
  medicaldevices: 'health-care',

  industrials: 'industrials',
  industrial: 'industrials',
  industrialgoods: 'industrials',
  machinery: 'industrials',
  manufacturing: 'industrials',
  engineering: 'industrials',
  transportation: 'industrials',
  capitalgoods: 'industrials',

  informationtechnology: 'information-technology',
  informationtechnologies: 'information-technology',
  technology: 'information-technology',
  tech: 'information-technology',
  software: 'information-technology',
  semiconductors: 'information-technology',
  hardware: 'information-technology',
  itservices: 'information-technology',

  materials: 'materials',
  basicmaterials: 'materials',
  chemicals: 'materials',
  metalsmining: 'materials',
  paperforestproducts: 'materials',

  realestate: 'real-estate',
  realestateinvestmenttrusts: 'real-estate',
  reit: 'real-estate',
  reits: 'real-estate',

  utilities: 'utilities',
  utility: 'utilities',
  power: 'utilities',
  water: 'utilities',
  gas: 'utilities',

  other: 'other',
  miscellaneous: 'other',
  diversified: 'other',
  unknown: 'other',
};

const yahooProfileCache = new Map<string, Sector>();
const yahooEtfCache = new Map<string, SectorWeighting[]>();

function normalizeSymbolKey(symbol: string): string {
  return symbol?.trim().toUpperCase();
}

function sanitizeSectorKey(value: string): string {
  return value
    .toString()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

export function normalizeSectorValue(input?: string | null): Sector {
  if (!input) {
    return 'other';
  }
  const sanitized = sanitizeSectorKey(input);
  if (!sanitized) {
    return 'other';
  }
  return SECTOR_ALIAS_MAP[sanitized] ?? 'other';
}

function buildYahooSymbolCandidates(symbol: string, market?: Position['market']): string[] {
  const normalized = normalizeSymbolKey(symbol);
  if (normalized.includes('.')) {
    return [normalized];
  }

  if (market === 'KR') {
    return [`${normalized}.KS`, `${normalized}.KQ`];
  }

  return [normalized];
}

async function fetchYahooSectorProfile(
  symbol: string,
  market?: Position['market']
): Promise<Sector | null> {
  const cacheKey = `${normalizeSymbolKey(symbol)}:${market ?? 'global'}`;
  if (yahooProfileCache.has(cacheKey)) {
    return yahooProfileCache.get(cacheKey)!;
  }

  const candidates = buildYahooSymbolCandidates(symbol, market);

  for (const candidate of candidates) {
    try {
      const response = await axios.get(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${candidate}`,
        {
          params: { modules: 'assetProfile' },
          timeout: 12000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SectorResolver/1.0)',
            Accept: 'application/json,text/plain,*/*',
          },
        }
      );

      const profile = response.data?.quoteSummary?.result?.[0]?.assetProfile;
      if (profile?.sector) {
        const normalized = normalizeSectorValue(profile.sector);
        yahooProfileCache.set(cacheKey, normalized);
        return normalized;
      }
    } catch (error) {
      // Swallow and try next candidate
      continue;
    }
  }

  yahooProfileCache.set(cacheKey, 'other');
  return null;
}

async function fetchYahooEtfSectorWeights(
  symbol: string,
  market?: Position['market']
): Promise<SectorWeighting[]> {
  const cacheKey = `${normalizeSymbolKey(symbol)}:${market ?? 'global'}`;
  if (yahooEtfCache.has(cacheKey)) {
    return yahooEtfCache.get(cacheKey)!;
  }

  const candidates = buildYahooSymbolCandidates(symbol, market);

  for (const candidate of candidates) {
    try {
      const response = await axios.get(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${candidate}`,
        {
          params: { modules: 'topHoldings' },
          timeout: 12000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SectorResolver/1.0)',
            Accept: 'application/json,text/plain,*/*',
          },
        }
      );

      const sectorWeightings = response.data?.quoteSummary?.result?.[0]?.topHoldings?.sectorWeightings;
      if (!Array.isArray(sectorWeightings)) {
        continue;
      }

      const aggregated = new Map<Sector, number>();

      sectorWeightings.forEach((entry: Record<string, number>) => {
        const [rawKey, rawValue] = Object.entries(entry)[0] ?? [];
        if (!rawKey || typeof rawValue !== 'number' || Number.isNaN(rawValue)) {
          return;
        }

        const normalizedSector = normalizeSectorValue(rawKey);
        const numericValue = rawValue > 1 ? rawValue / 100 : rawValue;
        if (numericValue <= 0) {
          return;
        }

        aggregated.set(normalizedSector, (aggregated.get(normalizedSector) ?? 0) + numericValue);
      });

      if (aggregated.size === 0) {
        continue;
      }

      const total = Array.from(aggregated.values()).reduce((sum, value) => sum + value, 0);
      if (total <= 0) {
        continue;
      }

      const weights = Array.from(aggregated.entries()).map(([sector, value]) => ({
        sector,
        weight: value / total,
        source: 'yahoo-etf' as SectorSource,
      }));

      yahooEtfCache.set(cacheKey, weights);
      return weights;
    } catch (error) {
      continue;
    }
  }

  yahooEtfCache.set(cacheKey, []);
  return [];
}

export async function resolveSectorAllocations(
  positions: Position[]
): Promise<Map<string, PositionSectorInfo>> {
  const resolution = new Map<string, PositionSectorInfo>();

  if (positions.length === 0) {
    return resolution;
  }

  const symbolGroups = new Map<string, Position[]>();
  positions.forEach((position) => {
    const key = normalizeSymbolKey(position.symbol);
    const group = symbolGroups.get(key) ?? [];
    group.push(position);
    symbolGroups.set(key, group);
  });

  const uniqueSymbols = Array.from(symbolGroups.keys());
  const stockRecords: Stock[] = await getStocksBySymbols(uniqueSymbols);
  const stockMap = new Map<string, Stock>();
  stockRecords.forEach((stock) => {
    stockMap.set(normalizeSymbolKey(stock.symbol), stock);
  });

  for (const [symbolKey, group] of symbolGroups.entries()) {
    const exemplar = group[0];
    const stock = stockMap.get(symbolKey);
    const assetType = exemplar?.assetType || stock?.assetType || 'stock';
    const market = exemplar?.market ?? stock?.market;

    const positionSectors = group
      .map((position) => normalizeSectorValue(position.sector))
      .filter((sector) => sector !== 'other');

    let primarySector: Sector = positionSectors[0] ?? 'other';
    let source: SectorSource = positionSectors.length > 0 ? 'position' : 'fallback';
    let weights: SectorWeighting[] = [];

    if (primarySector === 'other' && stock?.sector) {
      const normalized = normalizeSectorValue(stock.sector);
      if (normalized !== 'other') {
        primarySector = normalized;
        source = 'stock-master';
      }
    }

    if (assetType === 'etf') {
      const etfWeights = await fetchYahooEtfSectorWeights(symbolKey, market);
      if (etfWeights.length > 0) {
        weights = etfWeights;
        const dominant = weights.reduce((acc, entry) => (entry.weight > acc.weight ? entry : acc), weights[0]);
        if (dominant && dominant.weight > 0) {
          primarySector = dominant.sector;
          source = (dominant.source ?? 'yahoo-etf') as SectorSource;
        }
      }
    }

    if (weights.length === 0) {
      if (primarySector === 'other') {
        const yahooSector = await fetchYahooSectorProfile(symbolKey, market);
        if (yahooSector && yahooSector !== 'other') {
          primarySector = yahooSector;
          source = 'yahoo-profile';
        }
      }

      weights = [
        {
          sector: primarySector,
          weight: 1,
          source,
        },
      ];
    } else {
      const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
      if (total > 0 && Math.abs(total - 1) > 1e-3) {
        weights = weights.map((entry) => ({
          ...entry,
          weight: entry.weight / total,
        }));
      }
    }

    resolution.set(symbolKey, {
      primarySector,
      source,
      weights,
      rawSector: stock?.sector ?? exemplar?.sector ?? null,
      symbol: exemplar?.symbol ?? symbolKey,
    });
  }

  return resolution;
}

export function getResolvedSectorInfo(
  symbol: string,
  resolution: Map<string, PositionSectorInfo>
): PositionSectorInfo | undefined {
  return resolution.get(normalizeSymbolKey(symbol));
}

