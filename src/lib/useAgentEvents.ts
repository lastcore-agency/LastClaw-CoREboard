/* ────────────────────────────────────────────────────────────
   useAgentEvents — SSE hook for Visual Office speech bubbles
   Connects to /api/runtime/events for real-time agent events
   ──────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { NormalizedEvent } from './events';
import { sanitizeEventText, shouldShowBubble, getEventTTL } from './events';

export interface AgentBubble {
  agentId: string;
  text: string;
  type: string;
  timestamp: number;
  expiresAt: number;
}

const MAX_BUBBLE_LENGTH = 120;
const BUBBLE_QUEUE_SIZE = 3;

export function useAgentEvents(isMock: boolean) {
  const [bubbles, setBubbles] = useState<Map<string, AgentBubble>>(new Map());
  const [events, setEvents] = useState<NormalizedEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clean up expired bubbles
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setBubbles((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [agentId, bubble] of next) {
          if (now > bubble.expiresAt) {
            next.delete(agentId);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Process incoming event
  const processEvent = useCallback((event: NormalizedEvent) => {
    if (!shouldShowBubble(event.type)) return;
    if (!event.agentId) return;

    const text = sanitizeEventText(event.text || '', MAX_BUBBLE_LENGTH);
    if (!text) return;

    const now = Date.now();
    const ttl = getEventTTL(event.type as any);

    // Clear existing timer for this agent
    const existing = timersRef.current.get(event.agentId);
    if (existing) clearTimeout(existing);

    setBubbles((prev) => {
      const next = new Map(prev);
      next.set(event.agentId, {
        agentId: event.agentId,
        text,
        type: event.type,
        timestamp: now,
        expiresAt: now + ttl,
      });
      return next;
    });

    // Set expiry timer
    const timer = setTimeout(() => {
      setBubbles((prev) => {
        const next = new Map(prev);
        const b = next.get(event.agentId);
        if (b && b.timestamp === now) {
          next.delete(event.agentId);
        }
        return next;
      });
      timersRef.current.delete(event.agentId);
    }, ttl);
    timersRef.current.set(event.agentId, timer);
  }, []);

  // Connect to SSE endpoint
  useEffect(() => {
    if (isMock) return; // Don't connect in mock mode

    const baseUrl = import.meta.env.VITE_OPENCLAW_API_BASE || '/api/runtime';
    const es = new EventSource(`${baseUrl}/events`);
    eventSourceRef.current = es;

    es.onmessage = (msg) => {
      try {
        const event: NormalizedEvent = JSON.parse(msg.data);
        if (event.type === 'stream.connected') return;
        setEvents((prev) => [...prev.slice(-50), event]); // Keep last 50
        processEvent(event);
      } catch { /* ignore malformed events */ }
    };

    es.onerror = () => {
      // Will auto-reconnect
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      // Clear all timers
      for (const timer of timersRef.current.values()) clearTimeout(timer);
      timersRef.current.clear();
    };
  }, [isMock, processEvent]);

  // Manual injection for testing
  const injectEvent = useCallback(async (event: Partial<NormalizedEvent>) => {
    try {
      const baseUrl = import.meta.env.VITE_OPENCLAW_API_BASE || '/api/runtime';
      const resp = await fetch(`${baseUrl}/events/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      return resp.ok;
    } catch { return false; }
  }, []);

  return { bubbles, events, injectEvent };
}
