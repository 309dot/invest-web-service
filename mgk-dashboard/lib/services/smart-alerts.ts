import type { SmartAlert, SmartAlertMeta, SmartAlertSeverity, SmartAlertSource } from '@/types';

export type SmartAlertDraft = {
  id?: string;
  severity: SmartAlertSeverity;
  title: string;
  description: string;
  symbol?: string;
  tags?: string[];
  recommendedAction?: string;
  data?: Record<string, unknown>;
  source?: SmartAlertSource;
  weight?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  expiresAt?: string | Date | null;
  ttlMinutes?: number;
  acknowledgable?: boolean;
  acknowledgedAt?: string | Date | null;
  groupKey?: string;
  dedupeKey?: string;
};

export interface SmartAlertFactoryOptions {
  now?: Date;
  recencyHalfLifeMinutes?: number;
}

export interface BuildSmartAlertsOptions extends SmartAlertFactoryOptions {
  dedupe?: boolean;
  dedupeKeyFn?: (alert: SmartAlert) => string;
  limit?: number;
  filter?: (alert: SmartAlert) => boolean;
  sortDirection?: 'asc' | 'desc';
}

const DEFAULT_SEVERITY_WEIGHT: Record<SmartAlertSeverity, number> = {
  emergency: 120,
  important: 80,
  info: 40,
};

const TAG_PRIORITY: Record<string, number> = {
  'auto-invest': 18,
  'execution-error': 16,
  'insufficient-balance': 14,
  rebalancing: 10,
  concentration: 10,
  risk: 8,
  performance: 4,
  ai: 6,
};

const DEFAULT_RECENCY_HALF_LIFE_MINUTES = 360; // 6 hours
const RECENCY_WEIGHT = 28;

function toIsoString(value: string | Date | null | undefined, fallback?: Date): string | undefined {
  if (value === null || value === undefined) {
    return fallback ? fallback.toISOString() : undefined;
  }
  if (typeof value === 'string') {
    return new Date(value).toISOString();
  }
  return value.toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function generateAlertId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && 'randomUUID' in globalThis.crypto) {
    try {
      return globalThis.crypto.randomUUID();
    } catch (error) {
      // ignore and fallback
    }
  }
  return `alert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeTitleForKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
}

function buildDedupeKey(draft: SmartAlertDraft): string {
  if (draft.dedupeKey) {
    return draft.dedupeKey;
  }
  const titleKey = sanitizeTitleForKey(draft.title);
  const symbolKey = draft.symbol ? draft.symbol.toUpperCase() : 'portfolio';
  return `${draft.severity}:${symbolKey}:${titleKey}`;
}

function computeTagBoost(tags: string[] | undefined): number {
  if (!tags || !tags.length) {
    return 0;
  }
  return tags.reduce((sum, tag) => sum + (TAG_PRIORITY[tag] ?? 0), 0);
}

function computeRecencyBoost(createdAt: string, now: Date, halfLifeMinutes: number): number {
  const createdDate = new Date(createdAt);
  const elapsedMinutes = Math.max(0, (now.getTime() - createdDate.getTime()) / 60000);
  const halfLife = Math.max(1, halfLifeMinutes);
  const decay = Math.exp(-elapsedMinutes / halfLife);
  return decay * RECENCY_WEIGHT;
}

function normalizeTags(tags?: string[]): string[] | undefined {
  if (!tags || !tags.length) {
    return undefined;
  }
  const normalized = Array.from(
    new Set(
      tags
        .map((tag) => String(tag ?? '').trim())
        .filter((tag) => tag.length > 0)
    )
  );
  return normalized.length ? normalized : undefined;
}

export const SMART_ALERT_SEVERITY_WEIGHT = DEFAULT_SEVERITY_WEIGHT;

export function createSmartAlert(
  draft: SmartAlertDraft,
  options: SmartAlertFactoryOptions = {}
): SmartAlert {
  const now = options.now ?? new Date();
  const createdAt = toIsoString(draft.createdAt, now) ?? now.toISOString();
  const updatedAt = toIsoString(draft.updatedAt) ?? createdAt;
  let expiresAt: string | null | undefined;
  if (draft.expiresAt === null) {
    expiresAt = null;
  } else if (draft.expiresAt !== undefined) {
    expiresAt = toIsoString(draft.expiresAt) ?? null;
  } else if (draft.ttlMinutes && draft.ttlMinutes > 0) {
    expiresAt = addMinutes(createdAt, draft.ttlMinutes);
  }

  const tags = normalizeTags(draft.tags);
  const baseWeight = DEFAULT_SEVERITY_WEIGHT[draft.severity] ?? 20;
  const tagBoost = computeTagBoost(tags);
  const recencyBoost = computeRecencyBoost(
    createdAt,
    now,
    options.recencyHalfLifeMinutes ?? DEFAULT_RECENCY_HALF_LIFE_MINUTES
  );
  const manualWeight = draft.weight ?? 0;
  const priorityScore = Math.round((baseWeight + tagBoost + recencyBoost + manualWeight) * 100) / 100;

  return {
    id: draft.id ?? generateAlertId(),
    severity: draft.severity,
    title: draft.title.trim(),
    description: draft.description.trim(),
    symbol: draft.symbol,
    tags,
    recommendedAction: draft.recommendedAction,
    data: draft.data,
    source: draft.source ?? 'system',
    priorityScore,
    createdAt,
    updatedAt,
    expiresAt,
    acknowledgable: draft.acknowledgable ?? false,
    acknowledgedAt: draft.acknowledgedAt ? toIsoString(draft.acknowledgedAt) ?? null : undefined,
    groupKey: draft.groupKey ?? (draft.symbol ? `${draft.severity}:${draft.symbol}` : undefined),
    dedupeKey: buildDedupeKey(draft),
  };
}

export function dedupeSmartAlerts(
  alerts: SmartAlert[],
  keyFn?: (alert: SmartAlert) => string
): SmartAlert[] {
  if (!alerts.length) {
    return [];
  }
  const map = new Map<string, SmartAlert>();
  const resolveKey =
    keyFn ??
    ((alert: SmartAlert) => alert.dedupeKey ?? `${alert.severity}:${alert.symbol ?? ''}:${alert.title}`);

  alerts.forEach((alert) => {
    const key = resolveKey(alert);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, alert);
      return;
    }
    if (alert.priorityScore > existing.priorityScore) {
      map.set(key, alert);
      return;
    }
    if (alert.priorityScore === existing.priorityScore) {
      const existingDate = new Date(existing.createdAt).getTime();
      const alertDate = new Date(alert.createdAt).getTime();
      if (alertDate > existingDate) {
        map.set(key, alert);
      }
    }
  });

  return Array.from(map.values());
}

export function orderSmartAlerts(
  alerts: SmartAlert[],
  direction: 'asc' | 'desc' = 'desc'
): SmartAlert[] {
  const factor = direction === 'asc' ? 1 : -1;
  const severityRank: Record<SmartAlertSeverity, number> = {
    emergency: 0,
    important: 1,
    info: 2,
  };
  return [...alerts].sort((a, b) => {
    const scoreDiff = factor * (a.priorityScore - b.priorityScore);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    const severityDiff = factor * (severityRank[a.severity] - severityRank[b.severity]);
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return factor * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  });
}

export function buildSmartAlerts(
  drafts: SmartAlertDraft[],
  options: BuildSmartAlertsOptions = {}
): SmartAlert[] {
  if (!drafts.length) {
    return [];
  }
  const alerts = drafts.map((draft) => createSmartAlert(draft, options));
  const filtered = options.filter ? alerts.filter(options.filter) : alerts;
  const deduped = options.dedupe === false ? filtered : dedupeSmartAlerts(filtered, options.dedupeKeyFn);
  const ordered = orderSmartAlerts(deduped, options.sortDirection ?? 'desc');
  if (options.limit && options.limit > 0) {
    return ordered.slice(0, options.limit);
  }
  return ordered;
}

export function mergeSmartAlertLists(
  existing: SmartAlert[],
  incoming: SmartAlert[],
  options: { dedupeKeyFn?: (alert: SmartAlert) => string } = {}
): SmartAlert[] {
  const merged = [...existing, ...incoming];
  return orderSmartAlerts(dedupeSmartAlerts(merged, options.dedupeKeyFn));
}

export function summarizeSmartAlerts(alerts: SmartAlert[]): SmartAlertMeta {
  const counts: SmartAlertMeta['counts'] = {
    emergency: 0,
    important: 0,
    info: 0,
  };
  const sources: Record<SmartAlertSource, number> = {
    system: 0,
    portfolio: 0,
    automation: 0,
    ai: 0,
    rebalancing: 0,
    performance: 0,
    manual: 0,
  };

  alerts.forEach((alert) => {
    counts[alert.severity] += 1;
    const sourceKey = alert.source ?? 'system';
    sources[sourceKey] = (sources[sourceKey] ?? 0) + 1;
  });

  const severityRank: Record<SmartAlertSeverity, number> = {
    emergency: 0,
    important: 1,
    info: 2,
  };

  const highestSeverity =
    alerts.length === 0
      ? null
      : alerts.reduce<SmartAlertSeverity>((acc, alert) => {
          if (severityRank[alert.severity] < severityRank[acc]) {
            return alert.severity;
          }
          return acc;
        }, alerts[0].severity);

  return {
    counts,
    highestSeverity,
    sources,
  };
}


