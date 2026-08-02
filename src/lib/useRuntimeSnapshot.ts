/* ────────────────────────────────────────────────────────────
   useRuntimeSnapshot — periodically polls agents + health
   ──────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAgents, fetchGateway } from './openclaw';
import type { Agent, GatewaySnapshot } from '../types';

interface RuntimeSnapshot {
  agents: Agent[];
  gateway: GatewaySnapshot;
  loading: boolean;
  lastRefreshAt: number | null;
  error: string | null;
}

const POLL_INTERVAL = 10_000; // 10s

export function useRuntimeSnapshot(isMock: boolean) {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>({
    agents: [],
    gateway: { status: 'offline', latency: '0ms', cpu: '0%', ram: '0MB', queue: '0', sessions: 0, source: 'MOCK' },
    loading: true,
    lastRefreshAt: null,
    error: null,
  });
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      setSnapshot((prev) => ({ ...prev, loading: true, error: null }));
      const [agents, gateway] = await Promise.all([fetchAgents(), fetchGateway()]);
      if (!mountedRef.current) return;
      setSnapshot({
        agents,
        gateway,
        loading: false,
        lastRefreshAt: Date.now(),
        error: null,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setSnapshot((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  // Initial fetch + periodic polling
  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  return { ...snapshot, refresh };
}
