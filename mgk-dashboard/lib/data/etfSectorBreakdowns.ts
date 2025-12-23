import type { Sector } from '@/types';
import { normalizeSector } from '@/lib/utils/sectors';

interface EtfSectorDefinition {
  symbol: string;
  aliases?: string[];
  weights: Partial<Record<Sector | string, number>>;
  updatedAt?: string;
  source?: string;
}

interface EtfSectorIndexEntry {
  definition: EtfSectorDefinition;
  weights: Record<Sector, number>;
}

const ETF_SECTOR_DEFINITIONS: EtfSectorDefinition[] = [
  {
    symbol: 'QQQ',
    aliases: ['INVESCO QQQ TRUST'],
    updatedAt: '2024-09-30',
    source: 'Invesco QQQ Fact Sheet (2024-09)',
    weights: {
      'information-technology': 0.61,
      'communication-services': 0.21,
      'consumer-discretionary': 0.15,
      'health-care': 0.03,
    },
  },
  {
    symbol: 'SPY',
    aliases: ['SPDR S&P 500 ETF TRUST'],
    updatedAt: '2024-12-31',
    source: 'StateStreet SPY Fact Sheet (2024-12)',
    weights: {
      'information-technology': 0.28,
      'financials': 0.12,
      'health-care': 0.13,
      'consumer-discretionary': 0.11,
      'communication-services': 0.08,
      'industrials': 0.08,
      'consumer-staples': 0.07,
      energy: 0.04,
      materials: 0.03,
      'real-estate': 0.03,
      utilities: 0.03,
    },
  },
  {
    symbol: 'VOO',
    aliases: ['VANGUARD S&P 500 ETF'],
    updatedAt: '2024-12-31',
    source: 'Vanguard VOO Portfolio Composition (2024-12)',
    weights: {
      'information-technology': 0.29,
      'financials': 0.12,
      'health-care': 0.13,
      'consumer-discretionary': 0.10,
      'communication-services': 0.08,
      'industrials': 0.09,
      'consumer-staples': 0.07,
      energy: 0.04,
      materials: 0.03,
      utilities: 0.03,
      'real-estate': 0.02,
    },
  },
  {
    symbol: 'VTI',
    aliases: ['VANGUARD TOTAL STOCK MARKET ETF'],
    updatedAt: '2024-12-31',
    source: 'Vanguard VTI Portfolio Composition (2024-12)',
    weights: {
      'information-technology': 0.27,
      'financials': 0.13,
      'health-care': 0.13,
      'consumer-discretionary': 0.10,
      'communication-services': 0.08,
      'industrials': 0.13,
      'consumer-staples': 0.06,
      energy: 0.04,
      materials: 0.03,
      utilities: 0.03,
      'real-estate': 0.03,
    },
  },
  {
    symbol: 'MGK',
    aliases: ['VANGUARD MEGA CAP GROWTH ETF'],
    updatedAt: '2024-12-31',
    source: 'Vanguard MGK Portfolio Composition (2024-12)',
    weights: {
      'information-technology': 0.49,
      'consumer-discretionary': 0.23,
      'communication-services': 0.11,
      'health-care': 0.09,
      'financials': 0.05,
      'industrials': 0.03,
    },
  },
  {
    symbol: 'ARKK',
    aliases: ['ARK INNOVATION ETF'],
    updatedAt: '2024-12-31',
    source: 'ARK Invest Holdings (2024-12)',
    weights: {
      'information-technology': 0.40,
      'health-care': 0.31,
      'communication-services': 0.07,
      'consumer-discretionary': 0.08,
      'financials': 0.05,
      'industrials': 0.09,
    },
  },
  {
    symbol: 'XLK',
    aliases: ['TECHNOLOGY SELECT SECTOR SPDR FUND'],
    weights: {
      'information-technology': 1,
    },
  },
  {
    symbol: 'XLF',
    aliases: ['FINANCIAL SELECT SECTOR SPDR FUND'],
    weights: {
      financials: 1,
    },
  },
  {
    symbol: 'XLV',
    aliases: ['HEALTH CARE SELECT SECTOR SPDR FUND'],
    weights: {
      'health-care': 1,
    },
  },
  {
    symbol: 'XLY',
    aliases: ['CONSUMER DISCRETIONARY SELECT SECTOR SPDR FUND'],
    weights: {
      'consumer-discretionary': 1,
    },
  },
  {
    symbol: 'XLP',
    aliases: ['CONSUMER STAPLES SELECT SECTOR SPDR FUND'],
    weights: {
      'consumer-staples': 1,
    },
  },
  {
    symbol: 'XLE',
    aliases: ['ENERGY SELECT SECTOR SPDR FUND'],
    weights: {
      energy: 1,
    },
  },
  {
    symbol: 'XLI',
    aliases: ['INDUSTRIAL SELECT SECTOR SPDR FUND'],
    weights: {
      'industrials': 1,
    },
  },
  {
    symbol: 'XLC',
    aliases: ['COMMUNICATION SERVICES SELECT SECTOR SPDR FUND'],
    weights: {
      'communication-services': 1,
    },
  },
  {
    symbol: 'XLU',
    aliases: ['UTILITIES SELECT SECTOR SPDR FUND'],
    weights: {
      utilities: 1,
    },
  },
  {
    symbol: 'VNQ',
    aliases: ['VANGUARD REAL ESTATE ETF'],
    weights: {
      'real-estate': 0.96,
      'financials': 0.04,
    },
  },
  {
    symbol: 'IEF',
    aliases: ['ISHARES 7-10 YEAR TREASURY BOND ETF'],
    weights: {
      other: 1,
    },
  },
  {
    symbol: 'LQD',
    aliases: ['ISHARES INVESTMENT GRADE CORPORATE BOND ETF'],
    weights: {
      other: 1,
    },
  },
  {
    symbol: '069500',
    aliases: ['KODEX200', 'KODEX 200'],
    updatedAt: '2024-12-31',
    source: 'KRX Index Sector Weights (KOSPI200, 2024-12)',
    weights: {
      'information-technology': 0.33,
      'financials': 0.18,
      'industrials': 0.14,
      'consumer-discretionary': 0.12,
      'materials': 0.08,
      'communication-services': 0.05,
      'health-care': 0.05,
      'consumer-staples': 0.03,
      energy: 0.01,
      utilities: 0.01,
      'real-estate': 0.00,
    },
  },
];

const ETF_SECTOR_INDEX = new Map<string, EtfSectorIndexEntry>();

function normalizeEtfKey(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const compact = value
    .trim()
    .toUpperCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^0-9A-Z]/g, '');

  if (!compact) {
    return null;
  }
  return compact;
}

function normalizeWeights(weights: EtfSectorDefinition['weights']): Record<Sector, number> {
  const normalized: Record<Sector, number> = {} as Record<Sector, number>;
  let total = 0;

  Object.entries(weights ?? {}).forEach(([rawSector, rawWeight]) => {
    const weight = typeof rawWeight === 'number' ? rawWeight : Number(rawWeight);
    if (!Number.isFinite(weight) || weight <= 0) {
      return;
    }

    const sector = normalizeSector(rawSector) as Sector;
    normalized[sector] = (normalized[sector] ?? 0) + weight;
    total += weight;
  });

  if (total <= 0) {
    return {};
  }

  const result: Record<Sector, number> = {} as Record<Sector, number>;
  Object.entries(normalized).forEach(([sector, value]) => {
    result[sector as Sector] = value / total;
  });

  const sum = Object.values(result).reduce((acc, value) => acc + value, 0);
  if (sum < 0.999) {
    result.other = (result.other ?? 0) + (1 - sum);
  }

  return result;
}

ETF_SECTOR_DEFINITIONS.forEach((definition) => {
  const weights = normalizeWeights(definition.weights);
  const key = normalizeEtfKey(definition.symbol);
  if (key) {
    ETF_SECTOR_INDEX.set(key, { definition, weights });
  }

  definition.aliases?.forEach((alias) => {
    const aliasKey = normalizeEtfKey(alias);
    if (aliasKey) {
      ETF_SECTOR_INDEX.set(aliasKey, { definition, weights });
    }
  });
});

/**
 * ETF 섹터 가중치 조회
 * 
 * @param symbol ETF 티커 혹은 식별자
 * @returns 섹터별 가중치(비율) 맵. 데이터가 없으면 null 반환
 */
export function getEtfSectorWeights(symbol?: string | null): Record<Sector, number> | null {
  const key = normalizeEtfKey(symbol);
  if (!key) {
    return null;
  }

  const entry = ETF_SECTOR_INDEX.get(key);
  if (!entry) {
    return null;
  }

  return entry.weights;
}

/**
 * 사전에 정의된 ETF 섹터 분포 목록 반환 (디버깅/관리용)
 */
export function listSupportedEtfSectorSymbols(): string[] {
  return Array.from(new Set(ETF_SECTOR_DEFINITIONS.map((definition) => definition.symbol))).sort();
}

