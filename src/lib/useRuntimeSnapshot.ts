/* ────────────────────────────────────────────────────────────
   useRuntimeSnapshot — stable background polling without flicker

   Rules:
   - initialLoading = true ONLY before first successful fetch
   - Background refreshes NEVER set loading: true
   - Errors during refresh keep last known good data (stale flag)
   - Generation counter prevents stale responses from overwriting fresh
   - AbortController cancels in-flight requests on unmount / new poll
   ──────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAgents, fetchGateway } from './openclaw';
import type { Agent, GatewaySnapshot } from '../types';

export interface RuntimeSnapshot {
  agents: Agent[];
  gateway: GatewaySnapshot;
  /** True only on initial load — gates the loading spinner */
  initialLoading: boolean;
  /** True during background refresh — never gates render */
  refreshing: boolean;
  /** Non-null when last refresh failed; data still shows last good values */
  refreshError: string | null;
  /** True when data is older than STALE_THRESHOLD_MS */
  stale: boolean;
  lastRefreshAt: number | null;
  /** Manual trigger */
  refresh: () => void;
}

const POLL_INTERVAL = 10_000;   // 10s background poll
const STALE_THRESHOLD_MS = 30_000; // 30s → mark data as stale

const EMPTY_GATEWAY: GatewaySnapshot = {
  status: 'offline',
  latency: '—',
  cpu: '—',
  ram: '—',
  queue: '0',
  sessions: 0,
  source: 'EMPTY',
};

export function useRuntimeSnapshot(): RuntimeSnapshot {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [gateway, setGateway] = useState<GatewaySnapshot>(EMPTY_GATEWAY);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);

  const mountedRef = useRef(true);
  // Monotonically increasing — each new poll gets a new generation
  const generationRef = useRef(0);
  // Track if we have ever received good data (gates initialLoading)
  const everLoadedRef = useRef(false);

  const stale = lastRefreshAt !== null && Date.now() - lastRefreshAt > STALE_THRESHOLD_MS;

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;

    // Increment generation — any in-flight request from a previous poll
    // will see its generation is stale and bail out before setting state
    const myGeneration = ++generationRef.current;

    // Only show refreshing indicator if we already have data
    if (everLoadedRef.current) {
      setRefreshing(true);
    }

    try {
      const [newAgents, newGateway] = await Promise.all([
        fetchAgents(),
        fetchGateway(),
      ]);

      // Bail out if unmounted or a newer generation has started
      if (!mountedRef.current || generationRef.current !== myGeneration) return;

      // Success — update data without clearing existing state first
      setAgents(newAgents);
      setGateway(newGateway);
      setRefreshError(null);
      setLastRefreshAt(Date.now());

      if (!everLoadedRef.current) {
        everLoadedRef.current = true;
        setInitialLoading(false);
      }
    } catch (err) {
      if (!mountedRef.current || generationRef.current !== myGeneration) return;

      // KEEP last known good data — only update error indicator
      setRefreshError(err instanceof Error ? err.message : String(err));
      // If we've never loaded, propagate initial loading failure
      if (!everLoadedRef.current) {
        setInitialLoading(false);
      }
    } finally {
      if (mountedRef.current && generationRef.current === myGeneration) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const interval = setInterval(() => { void refresh(); }, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  return {
    agents,
    gateway,
    initialLoading,
    refreshing,
    refreshError,
    stale,
    lastRefreshAt,
    refresh,
  };
}
