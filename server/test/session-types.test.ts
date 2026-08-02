import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  classifySessionSource,
  classifySessionGroup,
  deriveSessionTitle,
  getAgentName,
  getCanonicalAgentId,
  getRuntimeAgentId,
  formatRelativeTime,
  formatTime,
  getSourceBadge,
  getTimelineTypeDisplay,
  CANONICAL_AGENTS,
} from '../../src/components/chat/session-types.js';
import {
  loadSessionData,
  saveSessionData,
  saveSessionMeta,
  getSessionMeta,
  removeSessionMeta,
  clearSessionData,
} from '../../src/components/chat/session-storage.js';

// ── Session Source Classification ───────────────────────────
describe('classifySessionSource', () => {
  it('returns lastclaw-native for native session keys', () => {
    expect(classifySessionSource('agent:main:lastclaw:abc123')).toBe('lastclaw-native');
  });

  it('returns discord for discord session keys', () => {
    expect(classifySessionSource('agent:main:discord:123')).toBe('discord');
  });

  it('returns telegram for telegram session keys', () => {
    expect(classifySessionSource('agent:main:telegram:456')).toBe('telegram');
  });

  it('returns cron for cron session keys', () => {
    expect(classifySessionSource('agent:main:cron:daily')).toBe('cron');
  });

  it('returns handoff for handoff session keys', () => {
    expect(classifySessionSource('agent:draco:handoff:xyz')).toBe('handoff');
  });

  it('returns main-direct for main sessions', () => {
    expect(classifySessionSource('agent:main:main:abc')).toBe('main-direct');
  });

  it('returns main-direct when agent:main: prefix present', () => {
    expect(classifySessionSource('agent:main:something')).toBe('main-direct');
  });

  it('returns other for unrecognized keys', () => {
    expect(classifySessionSource('unknown:session:key')).toBe('other');
  });

  it('returns other for empty string', () => {
    expect(classifySessionSource('')).toBe('other');
  });
});

// ── Session Group Classification ────────────────────────────
describe('classifySessionGroup', () => {
  it('returns native for lastclaw-native', () => {
    expect(classifySessionGroup('lastclaw-native')).toBe('native');
  });

  it('returns native for main-direct', () => {
    expect(classifySessionGroup('main-direct')).toBe('native');
  });

  it('returns automation for cron', () => {
    expect(classifySessionGroup('cron')).toBe('automation');
  });

  it('returns external for discord', () => {
    expect(classifySessionGroup('discord')).toBe('external');
  });

  it('returns external for telegram', () => {
    expect(classifySessionGroup('telegram')).toBe('external');
  });

  it('returns external for handoff', () => {
    expect(classifySessionGroup('handoff')).toBe('external');
  });

  it('returns external for other', () => {
    expect(classifySessionGroup('other')).toBe('external');
  });
});

// ── Session Title Derivation ────────────────────────────────
describe('deriveSessionTitle', () => {
  it('returns metadata title when available', () => {
    expect(deriveSessionTitle('any', { title: 'My Title' } as any)).toBe('My Title');
  });

  it('derives title from session key with agent name', () => {
    const title = deriveSessionTitle('agent:main:lastclaw:abc123');
    expect(title).toContain('Sirius');
  });

  it('derives title from session key with draco', () => {
    const title = deriveSessionTitle('agent:draco:discord:xyz');
    expect(title).toContain('Draco');
  });

  it('returns short hash for long session IDs', () => {
    const title = deriveSessionTitle('agent:main:something:verylongidentifier');
    expect(title).toContain('verylong');
  });

  it('returns full key for short keys', () => {
    const title = deriveSessionTitle('abc');
    expect(title).toBe('abc');
  });

  it('returns Untitled Session for empty key', () => {
    expect(deriveSessionTitle('')).toBe('Untitled Session');
  });

  it('returns first 32 chars for unrecognizable long keys', () => {
    const longKey = 'x'.repeat(50);
    const title = deriveSessionTitle(longKey);
    expect(title.length).toBeLessThanOrEqual(32);
  });
});

// ── Agent Name Resolution ───────────────────────────────────
describe('getAgentName', () => {
  it('returns name for canonical ID', () => {
    expect(getAgentName('sirius')).toBe('Sirius');
  });

  it('returns name for runtime ID', () => {
    expect(getAgentName('main')).toBe('Sirius');
  });

  it('returns original ID for unknown', () => {
    expect(getAgentName('unknown')).toBe('unknown');
  });

  it('resolves all 6 canonical agents', () => {
    expect(getAgentName('sirius')).toBe('Sirius');
    expect(getAgentName('draco')).toBe('Draco');
    expect(getAgentName('polaris')).toBe('Polaris');
    expect(getAgentName('antares')).toBe('Antares');
    expect(getAgentName('altair')).toBe('Altair');
    expect(getAgentName('capella')).toBe('Capella');
  });
});

describe('getCanonicalAgentId', () => {
  it('returns canonical from canonical', () => {
    expect(getCanonicalAgentId('sirius')).toBe('sirius');
  });

  it('returns canonical from runtime', () => {
    expect(getCanonicalAgentId('main')).toBe('sirius');
  });

  it('returns original for unknown', () => {
    expect(getCanonicalAgentId('unknown')).toBe('unknown');
  });
});

describe('getRuntimeAgentId', () => {
  it('returns runtime from canonical', () => {
    expect(getRuntimeAgentId('sirius')).toBe('main');
  });

  it('returns original for unknown', () => {
    expect(getRuntimeAgentId('unknown')).toBe('unknown');
  });
});

// ── Time Formatting ─────────────────────────────────────────
describe('formatRelativeTime', () => {
  it('returns just now for negative diff', () => {
    expect(formatRelativeTime(Date.now() + 1000)).toBe('just now');
  });

  it('returns 0s for very recent positive diff', () => {
    expect(formatRelativeTime(Date.now() - 100)).toBe('0s ago');
  });

  it('returns seconds for <60s', () => {
    expect(formatRelativeTime(Date.now() - 5000)).toBe('5s ago');
  });

  it('returns minutes for <60m', () => {
    expect(formatRelativeTime(Date.now() - 120000)).toBe('2m ago');
  });

  it('returns hours for <24h', () => {
    expect(formatRelativeTime(Date.now() - 7200000)).toBe('2h ago');
  });

  it('returns days for >=24h', () => {
    expect(formatRelativeTime(Date.now() - 172800000)).toBe('2d ago');
  });
});

describe('formatTime', () => {
  it('formats timestamp to HH:MM', () => {
    const ts = new Date('2026-01-15T14:30:00').getTime();
    const result = formatTime(ts);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

// ── Badge Info ──────────────────────────────────────────────
describe('getSourceBadge', () => {
  it('returns Native badge for lastclaw-native', () => {
    const badge = getSourceBadge('lastclaw-native');
    expect(badge.label).toBe('Native');
    expect(badge.color).toBe('#8b5cf6');
  });

  it('returns Direct badge for main-direct', () => {
    const badge = getSourceBadge('main-direct');
    expect(badge.label).toBe('Direct');
    expect(badge.color).toBe('#3b82f6');
  });

  it('returns Discord badge', () => {
    expect(getSourceBadge('discord').label).toBe('Discord');
  });

  it('returns Telegram badge', () => {
    expect(getSourceBadge('telegram').label).toBe('Telegram');
  });

  it('returns Cron badge', () => {
    expect(getSourceBadge('cron').label).toBe('Cron');
  });

  it('returns Handoff badge', () => {
    expect(getSourceBadge('handoff').label).toBe('Handoff');
  });

  it('returns Other badge for unknown', () => {
    expect(getSourceBadge('other').label).toBe('Other');
  });
});

describe('getTimelineTypeDisplay', () => {
  it('returns correct icon and color for user-message', () => {
    const d = getTimelineTypeDisplay('user-message');
    expect(d.icon).toBe('👤');
    expect(d.color).toBe('#3b82f6');
  });

  it('returns correct for agent-response', () => {
    const d = getTimelineTypeDisplay('agent-response');
    expect(d.icon).toBe('🤖');
  });

  it('returns correct for runtime-event', () => {
    const d = getTimelineTypeDisplay('runtime-event');
    expect(d.icon).toBe('⚡');
  });

  it('returns correct for error', () => {
    const d = getTimelineTypeDisplay('error');
    expect(d.icon).toBe('⚠️');
  });
});

// ── Canonical Agents ────────────────────────────────────────
describe('CANONICAL_AGENTS', () => {
  it('has exactly 6 agents', () => {
    expect(CANONICAL_AGENTS.length).toBe(6);
  });

  it('has unique IDs', () => {
    const ids = CANONICAL_AGENTS.map((a: (typeof CANONICAL_AGENTS)[number]) => a.id);
    expect(new Set(ids).size).toBe(6);
  });

  it('has unique runtime IDs', () => {
    const ids = CANONICAL_AGENTS.map((a: (typeof CANONICAL_AGENTS)[number]) => a.runtimeId);
    expect(new Set(ids).size).toBe(6);
  });

  it('each agent has name and role', () => {
    for (const agent of CANONICAL_AGENTS) {
      expect(agent.name).toBeTruthy();
      expect(agent.role).toBeTruthy();
    }
  });
});
