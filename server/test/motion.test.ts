import { describe, it, expect } from 'vitest';
import { deriveMotionState, getDirectionFromDelta, getAnimatedIdleAsset, getStaticAsset } from '../../src/lib/motion.js';
import type { Agent, CharacterDirection } from '../../src/types.js';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'draco',
    displayName: 'Draco',
    role: 'engineer',
    status: 'online',
    character: {
      id: 'draco',
      name: 'Draco',
      sprite: 'draco',
      palette: { primary: '#fff', accent: '#000', bg: '#888' },
      direction: 'front' as CharacterDirection,
      animated: '/characters/draco/idle-front.webp',
      static: '/characters/draco/static-front.webp',
    },
    location: 'test',
    currentTask: '',
    lastActive: Date.now(),
    uptime: 100,
    tasksCompleted: 5,
    messagesProcessed: 10,
    ...overrides,
  };
}

describe('getDirectionFromDelta', () => {
  it('returns front for zero delta (below threshold)', () => {
    expect(getDirectionFromDelta(0, 0)).toBe('front');
  });

  it('returns right for positive x', () => {
    expect(getDirectionFromDelta(10, 0)).toBe('right');
  });

  it('returns left for negative x', () => {
    expect(getDirectionFromDelta(-10, 0)).toBe('left');
  });

  it('returns front for positive y', () => {
    expect(getDirectionFromDelta(0, 10)).toBe('front');
  });

  it('returns back for negative y', () => {
    expect(getDirectionFromDelta(0, -10)).toBe('back');
  });

  it('picks dominant axis', () => {
    expect(getDirectionFromDelta(5, 3)).toBe('right');
    expect(getDirectionFromDelta(3, 5)).toBe('front');
  });
});

describe('deriveMotionState', () => {
  it('returns offline for offline agents', () => {
    const agent = makeAgent({ status: 'offline' });
    expect(deriveMotionState(agent, true)).toBe('offline');
    expect(deriveMotionState(agent, false)).toBe('offline');
  });

  it('returns unknown for error agents', () => {
    const agent = makeAgent({ status: 'error' });
    expect(deriveMotionState(agent, true)).toBe('unknown');
  });

  it('returns atDesk for unknown agents in live mode (not offline)', () => {
    const agent = makeAgent({ status: 'unknown' });
    expect(deriveMotionState(agent, false)).toBe('atDesk');
    expect(deriveMotionState(agent, true)).toBe('atDesk');
  });

  it('returns atDesk for working agents (mock)', () => {
    const agent = makeAgent({ status: 'working' });
    expect(deriveMotionState(agent, true)).toBe('atDesk');
  });

  it('returns atDesk for online agents (live mode)', () => {
    const agent = makeAgent({ status: 'online' });
    expect(deriveMotionState(agent, false)).toBe('atDesk');
  });

  it('returns idle for online agents (mock)', () => {
    const agent = makeAgent({ status: 'online' });
    expect(deriveMotionState(agent, true)).toBe('idle');
  });
});

describe('getAnimatedIdleAsset', () => {
  it('returns a .webp path with agent id', () => {
    const agent = makeAgent();
    const asset = getAnimatedIdleAsset(agent, 'front');
    expect(asset).toBe('/characters/draco/idle-front.webp');
  });

  it('defaults to front direction', () => {
    const agent = makeAgent();
    const asset = getAnimatedIdleAsset(agent);
    expect(asset).toContain('idle-front.webp');
  });
});

describe('getStaticAsset', () => {
  it('returns a static .webp path', () => {
    const agent = makeAgent();
    const asset = getStaticAsset(agent, 'front');
    expect(asset).toBe('/characters/draco/static-front.webp');
  });

  it('defaults to front direction', () => {
    const agent = makeAgent();
    const asset = getStaticAsset(agent);
    expect(asset).toContain('static-front.webp');
  });
});

// ── REGRESSION: LIVE mode produces no demo activity ─────────
describe('LIVE mode: no synthetic/demo activity (isMock=false)', () => {
  it('LIVE: online agent → idle or atDesk (ambient only, never fake walking)', () => {
    const agent = makeAgent({ status: 'online' });
    const state = deriveMotionState(agent, false);
    expect(state).not.toBe('walking');
    expect(['idle', 'atDesk']).toContain(state);
  });

  it('LIVE: working agent → atDesk (active desk state, not demo walking)', () => {
    const agent = makeAgent({ status: 'working' });
    const state = deriveMotionState(agent, false);
    expect(state).toBe('atDesk'); // LIVE: working shows at-desk, not walking
    expect(state).not.toBe('walking');
  });

  it('LIVE: waiting agent → atDesk (shows presence, not walking)', () => {
    const agent = makeAgent({ status: 'waiting' });
    // LIVE: waiting maps to atDesk ambient — never fake walking
    expect(deriveMotionState(agent, false)).not.toBe('walking');
  });

  it('LIVE: unknown agent → never offline without proof, never walking', () => {
    const agent = makeAgent({ status: 'unknown' });
    const state = deriveMotionState(agent, false);
    expect(state).not.toBe('offline');
    expect(state).not.toBe('walking');
  });

  it('LIVE: offline agent → offline only (never upgraded to idle)', () => {
    const agent = makeAgent({ status: 'offline' });
    expect(deriveMotionState(agent, false)).toBe('offline');
  });

  it('LIVE: error agent → error variant (not silently idle)', () => {
    const agent = makeAgent({ status: 'error' });
    const state = deriveMotionState(agent, false);
    expect(['error', 'unknown']).toContain(state);
    expect(state).not.toBe('idle');
  });

  it('LIVE: walking state never produced by deriveMotionState regardless of status', () => {
    const statuses: Array<Agent['status']> = ['online', 'working', 'busy', 'waiting', 'offline', 'unknown', 'error'];
    for (const status of statuses) {
      const agent = makeAgent({ status });
      expect(deriveMotionState(agent, false)).not.toBe('walking');
    }
  });
});
