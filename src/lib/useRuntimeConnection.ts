/* ────────────────────────────────────────────────────────────
   useRuntimeConnection — tracks Gateway connection state via SSE
   ──────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef } from 'react';
import type { ConnectionState } from '../types';

interface ConnectionInfo {
  state: ConnectionState;
  lastEventAt: number | null;
  reconnectCount: number;
}

export function useRuntimeConnection(isMock: boolean) {
  const [info, setInfo] = useState<ConnectionInfo>({
    state: isMock ? 'connected' : 'offline',
    lastEventAt: null,
    reconnectCount: 0,
  });
  const esRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);

  useEffect(() => {
    if (isMock) {
      setInfo({ state: 'connected', lastEventAt: Date.now(), reconnectCount: 0 });
      return;
    }

    const baseUrl = import.meta.env.VITE_OPENCLAW_API_BASE || '/api/runtime';
    const es = new EventSource(`${baseUrl}/events`);
    esRef.current = es;

    es.onopen = () => {
      reconnectCountRef.current = 0;
      setInfo((prev) => ({
        state: 'connected',
        lastEventAt: Date.now(),
        reconnectCount: 0,
      }));
    };

    es.onmessage = () => {
      setInfo((prev) => ({
        ...prev,
        lastEventAt: Date.now(),
        state: 'connected',
      }));
    };

    es.onerror = () => {
      es.close();
      reconnectCountRef.current++;
      setInfo((prev) => ({
        state: reconnectCountRef.current > 3 ? 'reconnecting' : 'degraded',
        lastEventAt: prev.lastEventAt,
        reconnectCount: reconnectCountRef.current,
      }));

      // Auto-reconnect with backoff
      const delay = Math.min(3000 * reconnectCountRef.current, 30_000);
      setTimeout(() => {
        if (esRef.current === es) {
          esRef.current = null;
          setInfo((prev) => ({ ...prev, state: 'reconnecting' }));
        }
      }, delay);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [isMock]);

  return info;
}
