/* ────────────────────────────────────────────────────────────
   Session Storage — versioned localStorage persistence
   Stores only harmless frontend preferences
   ──────────────────────────────────────────────────────────── */

import type { SessionMetadata, SessionSource } from './session-types.js';

const STORAGE_VERSION = 1;
const STORAGE_KEY = 'lastclaw:sessions:v1';

/** What we persist to localStorage */
interface StoredSessionMeta {
  title: string;
  objective: string;
  primaryAgentId: string;
  participatingAgentIds: string[];
  source: SessionSource;
}

interface StoredData {
  version: number;
  selectedSessionKey: string;
  searchFilter: string;
  collapsedSections: string[];
  mobileTab: 'sessions' | 'workroom' | 'context';
  sessionMeta: Record<string, StoredSessionMeta>;
}

/** Secrets / dangerous patterns we must never store */
const BLOCKED_PATTERNS = [
  /token/i, /secret/i, /password/i, /credential/i,
  /private.?key/i, /api.?key/i, /auth.?header/i,
  /bearer/i, /\.pem$/i, /\.key$/i,
];

function isSafeValue(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  if (value.length > 2000) return false;
  return !BLOCKED_PATTERNS.some(p => p.test(value));
}

function isSafeMetadata(meta: StoredSessionMeta): boolean {
  if (!isSafeValue(meta.title)) return false;
  if (!isSafeValue(meta.objective)) return false;
  if (!isSafeValue(meta.primaryAgentId)) return false;
  if (meta.participatingAgentIds.some(id => !isSafeValue(id))) return false;
  return true;
}

/** Load persisted session data safely */
export function loadSessionData(): Partial<StoredData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};

    // Version migration
    if (parsed.version !== STORAGE_VERSION) {
      // Migrate from old version or discard
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }

    // Validate stored session metadata
    if (parsed.sessionMeta && typeof parsed.sessionMeta === 'object') {
      for (const [key, meta] of Object.entries(parsed.sessionMeta)) {
        if (!isSafeMetadata(meta as StoredSessionMeta)) {
          delete parsed.sessionMeta[key];
        }
      }
    }

    return {
      selectedSessionKey: typeof parsed.selectedSessionKey === 'string' ? parsed.selectedSessionKey : '',
      searchFilter: typeof parsed.searchFilter === 'string' ? parsed.searchFilter : '',
      collapsedSections: Array.isArray(parsed.collapsedSections) ? parsed.collapsedSections : [],
      mobileTab: ['sessions', 'workroom', 'context'].includes(parsed.mobileTab)
        ? parsed.mobileTab : 'sessions',
      sessionMeta: parsed.sessionMeta || {},
    };
  } catch {
    // Corrupted data — discard
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

/** Save session data to localStorage */
export function saveSessionData(data: Partial<StoredData>): void {
  try {
    const existing = loadSessionData();
    const merged: StoredData = {
      version: STORAGE_VERSION,
      selectedSessionKey: data.selectedSessionKey ?? existing.selectedSessionKey ?? '',
      searchFilter: data.searchFilter ?? existing.searchFilter ?? '',
      collapsedSections: data.collapsedSections ?? existing.collapsedSections ?? [],
      mobileTab: data.mobileTab ?? existing.mobileTab ?? 'sessions',
      sessionMeta: { ...(existing.sessionMeta || {}), ...(data.sessionMeta || {}) },
    };

    // Filter out dangerous values before saving
    for (const [key, meta] of Object.entries(merged.sessionMeta)) {
      if (!isSafeMetadata(meta)) {
        delete merged.sessionMeta[key];
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

/** Save selected session key */
export function saveSelectedSession(key: string): void {
  saveSessionData({ selectedSessionKey: key });
}

/** Save search/filter */
export function saveSearchFilter(filter: string): void {
  saveSessionData({ searchFilter: filter });
}

/** Save collapsed sections */
export function saveCollapsedSections(sections: string[]): void {
  saveSessionData({ collapsedSections: sections });
}

/** Save mobile tab */
export function saveMobileTab(tab: 'sessions' | 'workroom' | 'context'): void {
  saveSessionData({ mobileTab: tab });
}

/** Save session metadata (title, objective, agents) */
export function saveSessionMeta(sessionKey: string, meta: SessionMetadata): void {
  if (!isSafeMetadata(meta)) return;
  const data = loadSessionData();
  const sessionMeta = data.sessionMeta || {};
  sessionMeta[sessionKey] = {
    title: meta.title,
    objective: meta.objective,
    primaryAgentId: meta.primaryAgentId,
    participatingAgentIds: meta.participatingAgentIds,
    source: meta.source,
  };
  saveSessionData({ sessionMeta });
}

/** Get metadata for a specific session */
export function getSessionMeta(sessionKey: string): SessionMetadata | null {
  const data = loadSessionData();
  const meta = data.sessionMeta?.[sessionKey];
  if (!meta) return null;
  return {
    title: meta.title,
    objective: meta.objective,
    primaryAgentId: meta.primaryAgentId,
    participatingAgentIds: meta.participatingAgentIds,
    source: meta.source,
  };
}

/** Remove metadata for a session (direct write to avoid double-read merge conflict) */
export function removeSessionMeta(sessionKey: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.sessionMeta && typeof parsed.sessionMeta === 'object' && parsed.sessionMeta[sessionKey]) {
      delete parsed.sessionMeta[sessionKey];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {
    // Silently fail
  }
}

/** Clear all persisted session data */
export function clearSessionData(): void {
  localStorage.removeItem(STORAGE_KEY);
}
