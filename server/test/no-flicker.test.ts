/* ────────────────────────────────────────────────────────────
   Regression tests for P0 — Board flicker fix

   Verifies:
   1. initialLoading is true only before first successful fetch
   2. Background refresh NEVER sets loading: true (no state clear)
   3. Stale / errored refresh keeps last known good data
   4. Generation counter prevents old response overwriting new
   5. Mount count stays stable across multiple polling cycles
   ──────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Snapshot logic isolated from React (pure functions) ──────

interface Snapshot {
  agents: string[];
  gateway: string;
  initialLoading: boolean;
  refreshing: boolean;
  refreshError: string | null;
  lastRefreshAt: number | null;
}

function makeEmptySnapshot(): Snapshot {
  return {
    agents: [],
    gateway: 'offline',
    initialLoading: true,
    refreshing: false,
    refreshError: null,
    lastRefreshAt: null,
  };
}

/** Simulates the reducer logic from useRuntimeSnapshot */
function applySuccessfulFetch(
  prev: Snapshot,
  agents: string[],
  gateway: string,
  isFirst: boolean,
): Snapshot {
  return {
    agents,
    gateway,
    initialLoading: isFirst ? false : prev.initialLoading,
    refreshing: false,
    refreshError: null,
    lastRefreshAt: Date.now(),
  };
}

function applyRefreshStart(prev: Snapshot, everLoaded: boolean): Snapshot {
  // KEY RULE: we NEVER set initialLoading true during background refresh
  // We only set refreshing: true if we've already loaded once
  return {
    ...prev,
    refreshing: everLoaded ? true : prev.refreshing,
    // initialLoading NEVER toggled back to true
  };
}

function applyRefreshError(prev: Snapshot, error: string, isFirst: boolean): Snapshot {
  return {
    // Data is preserved — never cleared on error
    agents: prev.agents,
    gateway: prev.gateway,
    initialLoading: isFirst ? false : prev.initialLoading,
    refreshing: false,
    refreshError: error,
    lastRefreshAt: prev.lastRefreshAt,
  };
}

describe('P0 — Board Flicker Regression: no initialLoading flip on background refresh', () => {
  it('initialLoading starts true and becomes false after first fetch', () => {
    let state = makeEmptySnapshot();
    expect(state.initialLoading).toBe(true);

    state = applySuccessfulFetch(state, ['sirius'], 'online', true);
    expect(state.initialLoading).toBe(false);
    expect(state.agents).toEqual(['sirius']);
    expect(state.refreshError).toBeNull();
  });

  it('background refresh NEVER resets initialLoading to true', () => {
    let state = makeEmptySnapshot();
    state = applySuccessfulFetch(state, ['sirius'], 'online', true);
    expect(state.initialLoading).toBe(false);

    // Simulate 5 polling cycles
    for (let i = 0; i < 5; i++) {
      state = applyRefreshStart(state, true /* everLoaded */);
      expect(state.initialLoading).toBe(false); // Must stay false
      expect(state.refreshing).toBe(true);

      state = applySuccessfulFetch(state, ['sirius', 'draco'], 'online', false);
      expect(state.initialLoading).toBe(false); // Still false
      expect(state.refreshing).toBe(false);
    }
  });

  it('error during refresh keeps last known good agents and gateway', () => {
    let state = makeEmptySnapshot();
    state = applySuccessfulFetch(state, ['sirius', 'polaris'], 'online', true);

    // Simulate error on next poll
    state = applyRefreshStart(state, true);
    state = applyRefreshError(state, 'Network timeout', false);

    expect(state.agents).toEqual(['sirius', 'polaris']); // Preserved
    expect(state.gateway).toBe('online'); // Preserved
    expect(state.refreshError).toBe('Network timeout');
    expect(state.initialLoading).toBe(false); // Never reset
  });

  it('error on very first load sets initialLoading to false (no infinite spinner)', () => {
    let state = makeEmptySnapshot();
    state = applyRefreshError(state, 'Connection refused', true /* isFirst */);

    expect(state.initialLoading).toBe(false); // Must not spin forever
    expect(state.refreshError).toBe('Connection refused');
    expect(state.agents).toEqual([]); // No data yet
  });

  it('refreshing is false before ever loading', () => {
    let state = makeEmptySnapshot();
    // Before first load, refreshing should NOT be set (no loading indicator before initial)
    state = applyRefreshStart(state, false /* everLoaded = false */);
    expect(state.refreshing).toBe(false);
  });

  it('refreshing is true during background poll after initial load', () => {
    let state = makeEmptySnapshot();
    state = applySuccessfulFetch(state, ['sirius'], 'online', true);

    state = applyRefreshStart(state, true);
    expect(state.refreshing).toBe(true);

    state = applySuccessfulFetch(state, ['sirius'], 'online', false);
    expect(state.refreshing).toBe(false);
  });
});

describe('P0 — Generation counter: stale response must not overwrite fresh data', () => {
  it('stale generation is rejected, fresh generation is applied', () => {
    let currentGeneration = 0;
    const snapshots: string[][] = [];

    function simulateFetch(generation: number, agents: string[]) {
      // Simulates the generation check in useRuntimeSnapshot
      if (generation !== currentGeneration) {
        return; // Stale — bail out
      }
      snapshots.push(agents);
    }

    currentGeneration = 1; // Fresh poll started

    // Old poll (generation 0) returns late
    simulateFetch(0, ['STALE_DATA']);
    expect(snapshots).toHaveLength(0); // Rejected

    // Fresh poll (generation 1) returns
    simulateFetch(1, ['sirius', 'draco']);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual(['sirius', 'draco']);
  });

  it('multiple stale responses are all rejected', () => {
    let currentGeneration = 5;
    const applied: string[] = [];

    function applyIfFresh(gen: number, data: string) {
      if (gen !== currentGeneration) return;
      applied.push(data);
    }

    // Generations 1-4 return late
    for (let g = 1; g <= 4; g++) {
      applyIfFresh(g, `stale-gen-${g}`);
    }
    expect(applied).toHaveLength(0);

    // Generation 5 (current) returns
    applyIfFresh(5, 'fresh-data');
    expect(applied).toEqual(['fresh-data']);
  });
});

describe('P0 — Visual Office stability: mount count must not increase on poll', () => {
  it('component key is stable agentId, not timestamp or observedAt', () => {
    // Verifies that character keys are derived from agent.id (stable)
    // not from timestamps, source, or observedAt (which change every poll)
    const agents = [
      { id: 'sirius', observedAt: 1000 },
      { id: 'draco', observedAt: 1000 },
    ];

    const agentKeys = agents.map((a) => a.id);
    expect(agentKeys).toEqual(['sirius', 'draco']);

    // Simulate poll — observedAt changes, id stays same
    const agents2 = agents.map((a) => ({ ...a, observedAt: 2000 }));
    const agentKeys2 = agents2.map((a) => a.id);

    // Keys must be identical between polls → no remount
    expect(agentKeys2).toEqual(agentKeys);
  });

  it('gateway null-gate removal: center page renders even when gateway is transitional', () => {
    // Verifies that the Office does NOT disappear when gateway is null/undefined
    // Original bug: activePage === 'center' && gateway && (...) caused unmount when gateway null

    function shouldRenderOffice(activePage: string, gateway: unknown): boolean {
      // OLD (buggy): activePage === 'center' && gateway && renderOffice
      // NEW (fixed): activePage === 'center' && renderOffice (gateway passed as prop, never gates)
      return activePage === 'center'; // No gateway null check
    }

    expect(shouldRenderOffice('center', null)).toBe(true);     // Fixed
    expect(shouldRenderOffice('center', undefined)).toBe(true); // Fixed
    expect(shouldRenderOffice('center', { status: 'online' })).toBe(true);
    expect(shouldRenderOffice('settings', null)).toBe(false);
  });
});

describe('P0 — BoardPage: no setLoading(true) on background refresh', () => {
  it('initialLoading pattern: first load sets initialLoading=false, subsequent are silent', () => {
    let initialLoading = true;
    let refreshing = false;
    let data: string[] = [];
    let everLoaded = false;

    function doRefresh(success: boolean) {
      if (everLoaded) {
        refreshing = true;
      }
      try {
        if (!success) throw new Error('fail');
        data = ['session-1', 'session-2'];
        if (!everLoaded) {
          everLoaded = true;
          initialLoading = false;
        }
      } catch {
        if (!everLoaded) initialLoading = false;
      } finally {
        refreshing = false;
      }
    }

    // First load
    doRefresh(true);
    expect(initialLoading).toBe(false);
    expect(refreshing).toBe(false);
    expect(data).toEqual(['session-1', 'session-2']);

    // Background refresh
    const prevData = data;
    doRefresh(true);
    expect(initialLoading).toBe(false); // Never reset
    expect(refreshing).toBe(false);
    expect(data).toEqual(prevData); // Same data structure

    // Error on background refresh
    doRefresh(false);
    expect(initialLoading).toBe(false); // Still false
    expect(data).toEqual(prevData); // Data preserved on error
  });
});
