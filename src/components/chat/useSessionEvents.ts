/* ────────────────────────────────────────────────────────────
   useSessionEvents — SSE hook for Native Session workroom
   Connects to /api/runtime/events for real-time Gateway events
   with deduplication, ordering, session filtering
   ──────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { NormalizedEvent } from './session-types';

interface UseSessionEventsOptions {
  /** Filter events to this session key (if applicable) */
  sessionKey?: string;
  /** Max events to keep in buffer */
  maxEvents?: number;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
}

interface UseSessionEventsResult {
  /** All received events (unfiltered) */
  events: NormalizedEvent[];
  /** Events filtered to the selected session */
  sessionEvents: NormalizedEvent[];
  /** Connection state */
  connected: boolean;
  /** Reconnect count */
  reconnectCount: number;
  /** Manually disconnect */
  disconnect: () => void;
}

const MAX_EVENTS_DEFAULT = 200;
const RECONNECT_BASE_DELAY = 2000;
const RECONNECT_MAX_DELAY = 30000;

export function useSessionEvents(options: UseSessionEventsOptions = {}): UseSessionEventsResult {
  const {
    sessionKey,
    maxEvents = MAX_EVENTS_DEFAULT,
    autoReconnect = true,
  } = options;

  const [events, setEvents] = useState<NormalizedEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const forcedDisconnectRef = useRef(false);

  // Clean up seen IDs when they get too large
  const trimSeenIds = useCallback(() => {
    if (seenIdsRef.current.size > 1000) {
      const arr = Array.from(seenIdsRef.current);
      seenIdsRef.current = new Set(arr.slice(-500));
    }
  }, []);

  const disconnect = useCallback(() => {
    forcedDisconnectRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || forcedDisconnectRef.current) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const baseUrl = import.meta.env.VITE_OPENCLAW_API_BASE || '/api/runtime';
    const es = new EventSource(`${baseUrl}/events`);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      setReconnectCount(0);
    };

    es.onmessage = (msg) => {
      if (!mountedRef.current) return;
      try {
        const event: NormalizedEvent = JSON.parse(msg.data);
        if (event.type === 'stream.connected') return;

        // Deduplicate
        if (seenIdsRef.current.has(event.id)) return;
        seenIdsRef.current.add(event.id);
        trimSeenIds();

        setEvents(prev => {
          const next = [...prev, event];
          return next.length > maxEvents ? next.slice(-maxEvents) : next;
        });
      } catch {
        // Malformed event — ignore
      }
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      if (autoReconnect && !forcedDisconnectRef.current) {
        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(1.5, reconnectCount),
          RECONNECT_MAX_DELAY,
        ) + Math.random() * 1000;

        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current && !forcedDisconnectRef.current) {
            setReconnectCount(c => c + 1);
            connect();
          }
        }, delay);
      }
    };
  }, [maxEvents, autoReconnect, reconnectCount, trimSeenIds]);

  // Initial connection
  useEffect(() => {
    mountedRef.current = true;
    forcedDisconnectRef.current = false;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter events by session key
  const sessionEvents = sessionKey
    ? events.filter(e =>
        e.sessionId === sessionKey ||
        e.sessionId?.includes(sessionKey) ||
        sessionKey.includes(e.sessionId || '')
      )
    : events;

  return {
    events,
    sessionEvents,
    connected,
    reconnectCount,
    disconnect,
  };
}
