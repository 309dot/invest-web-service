import type { Sector } from '@/types';

export const GICS_SECTORS: Sector[] = [
  'communication-services',
  'consumer-discretionary',
  'consumer-staples',
  'energy',
  'financials',
  'health-care',
  'industrials',
  'information-technology',
  'materials',
  'real-estate',
  'utilities',
  'other',
];

const SECTOR_NORMALIZATION_MAP: Record<string, Sector> = {
  'communicationservices': 'communication-services',
  'communicationservice': 'communication-services',
  'communications': 'communication-services',
  'telecommunicationservices': 'communication-services',
  'telecommunicationsservices': 'communication-services',
  'telecommunications': 'communication-services',
  'telecom': 'communication-services',
  'consumerdiscretionary': 'consumer-discretionary',
  'consumercyclical': 'consumer-discretionary',
  'consumerdurables': 'consumer-discretionary',
  'discretionary': 'consumer-discretionary',
  'consumerstaples': 'consumer-staples',
  'consumerdefensive': 'consumer-staples',
  'consumergoods': 'consumer-staples',
  'staples': 'consumer-staples',
  'energy': 'energy',
  'financial': 'financials',
  'financials': 'financials',
  'financialservices': 'financials',
  'banks': 'financials',
  'healthcare': 'health-care',
  'healthcareequipment': 'health-care',
  'healthcareproviders': 'health-care',
  'health-care': 'health-care',
  'medical': 'health-care',
  'industrials': 'industrials',
  'industrial': 'industrials',
  'capitalgoods': 'industrials',
  'transportation': 'industrials',
  'machinery': 'industrials',
  'informationtechnology': 'information-technology',
  'technology': 'information-technology',
  'tech': 'information-technology',
  'it': 'information-technology',
  'semiconductors': 'information-technology',
  'software': 'information-technology',
  'materials': 'materials',
  'basicmaterials': 'materials',
  'metalsandmining': 'materials',
  'chemicals': 'materials',
  'realestate': 'real-estate',
  'real-estate': 'real-estate',
  'reit': 'real-estate',
  'reitsspecialty': 'real-estate',
  'utilities': 'utilities',
  'renewableutilities': 'utilities',
  'waterutilities': 'utilities',
  'electricutilities': 'utilities',
};

const SECTOR_DISPLAY_NAMES: Record<Sector, string> = {
  'communication-services': '커뮤니케이션 서비스',
  'consumer-discretionary': '임의소비재',
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

function sanitize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z]/g, '');
}

export function normalizeSector(value?: string | null): Sector {
  if (!value) {
    return 'other';
  }

  const sanitized = sanitize(value);
  return SECTOR_NORMALIZATION_MAP[sanitized] ?? 'other';
}

export function getSectorDisplayName(sector: Sector | 'unknown'): string {
  if (sector === 'unknown') {
    return '미분류';
  }

  return SECTOR_DISPLAY_NAMES[sector] ?? SECTOR_DISPLAY_NAMES.other;
}

export function isGicsSector(value: string): value is Sector {
  return GICS_SECTORS.includes(value as Sector);
}

