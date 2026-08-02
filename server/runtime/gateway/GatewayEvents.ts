/* ────────────────────────────────────────────────────────────
   Gateway event bus — typed subscribe/emit for Gateway→SSE bridge
   ──────────────────────────────────────────────────────────── */

import type { GatewayEvent } from './GatewayProtocol.js';

export type GatewayEventType =
  | 'session.message'
  | 'session.updated'
  | 'sessions.changed'
  | 'presence.diff'
  | 'channel.status'
  | 'agent.model.active'
  | 'tick'
  | 'health'
  | string;

export interface NormalizedEvent {
  id: string;
  timestamp: string;
  type: string;
  agentId: string;
  targetAgentId?: string;
  sessionId?: string;
  text?: string;
  source: 'LIVE' | 'MOCK';
  raw?: unknown;
}

type Listener = (event: NormalizedEvent) => void;

export class GatewayEventBus {
  private listeners = new Map<string, Set<Listener>>();
  private wildcardListeners = new Set<Listener>();
  private buffer: NormalizedEvent[] = [];
  private bufferMax: number;

  constructor(bufferMax = 500) {
    this.bufferMax = bufferMax;
  }

  on(type: string, listener: Listener): () => void {
    if (type === '*') {
      this.wildcardListeners.add(listener);
      return () => { this.wildcardListeners.delete(listener); };
    }
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
    return () => { set!.delete(listener); };
  }

  emit(event: NormalizedEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.bufferMax) {
      this.buffer.splice(0, this.buffer.length - this.bufferMax);
    }

    const typed = this.listeners.get(event.type);
    if (typed) {
      for (const fn of typed) {
        try { fn(event); } catch { /* listener error */ }
      }
    }
    for (const fn of this.wildcardListeners) {
      try { fn(event); } catch { /* listener error */ }
    }
  }

  /** Normalize a raw Gateway frame event into a NormalizedEvent */
  normalize(frame: GatewayEvent): NormalizedEvent {
    const payload = (frame.payload || {}) as Record<string, unknown>;
    const agentId = (payload.agentId as string) || (payload.agent as string) || '';
    const sessionId = (payload.sessionId as string) || (payload.session as string) || '';
    const text = (payload.text as string) || (payload.content as string) || '';

    return {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      type: frame.event,
      agentId,
      sessionId,
      text: typeof text === 'string' ? text.slice(0, 2000) : '',
      source: 'LIVE',
      raw: payload,
    };
  }

  /** Emit a frame, normalizing it first */
  emitFrame(frame: GatewayEvent): void {
    this.emit(this.normalize(frame));
  }

  getRecent(count = 50): NormalizedEvent[] {
    return this.buffer.slice(-count);
  }

  clear(): void {
    this.buffer = [];
  }
}
