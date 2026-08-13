/* ────────────────────────────────────────────────────────────
   RuntimeContext — single shared runtime snapshot + activity store
   All pages (Center, Inspector, Studio, Board, Chat) read from here.
   SSE events update per-agent activity state with timestamp precedence.
   Polling snapshot updates POLL-source states only when no newer SSE exists.
   ──────────────────────────────────────────────────────────── */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useRuntimeSnapshot, type RuntimeSnapshot } from '../lib/useRuntimeSnapshot';
import {
  useAgentActivity,
  type UseAgentActivityResult,
  type RuntimeAgentState,
} from '../lib/useAgentActivity';

// ── Combined context type ────────────────────────────────────

export interface RuntimeContextValue extends RuntimeSnapshot {
  /** Per-agent SSE-driven activity state */
  activity: UseAgentActivityResult;
  /** Convenience: resolve character state for an agent, SSE > poll precedence */
  getAgentRuntimeState: (agentId: string) => RuntimeAgentState;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const isMock = String((import.meta as any).env?.VITE_USE_MOCK || 'false') === 'true';
  const snapshot = useRuntimeSnapshot();
  const activity = useAgentActivity(isMock);

  // After each successful poll: push availability into activity store (POLL source)
  // Timestamp precedence in useAgentActivity ensures SSE states are never overwritten
  useEffect(() => {
    if (snapshot.initialLoading) return;
    const pollTs = snapshot.lastRefreshAt ?? Date.now();

    for (const agent of snapshot.agents) {
      const runtimeId = (agent as any).runtimeAgentId || agent.id;
      // Use agent.status (already normalized from availability by openclaw.ts)
      activity.updateFromPoll(runtimeId, agent.status?.toUpperCase() ?? 'UNKNOWN', pollTs);
      // Also update by canonical id so both IDs resolve correctly
      if (runtimeId !== agent.id) {
        activity.updateFromPoll(agent.id, agent.status?.toUpperCase() ?? 'UNKNOWN', pollTs);
      }
    }
  // Only re-run when lastRefreshAt changes (new poll completed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.lastRefreshAt]);

  const getAgentRuntimeState = (agentId: string): RuntimeAgentState => {
    return activity.getAgentActivity(agentId).state;
  };

  const value: RuntimeContextValue = {
    ...snapshot,
    activity,
    getAgentRuntimeState,
  };

  return (
    <RuntimeContext.Provider value={value}>
      {children}
    </RuntimeContext.Provider>
  );
}

/** Hook to access the shared runtime snapshot + activity. Must be used inside RuntimeProvider. */
export function useRuntime(): RuntimeContextValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error('useRuntime must be used within RuntimeProvider');
  return ctx;
}
