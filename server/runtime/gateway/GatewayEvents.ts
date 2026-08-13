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
  role?: 'user' | 'assistant' | 'system' | 'tool';
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
    const payload = asRecord(frame.payload);
    const message = asRecord(payload.message);
    const session = asRecord(payload.session);

    const explicitAgentId = firstString(
      payload.agentId,
      payload.agent,
      payload.runtimeAgentId,
      message.agentId,
      message.agent,
    );

    const sessionId = firstString(
      payload.sessionKey,
      payload.sessionId,
      typeof payload.session === 'string' ? payload.session : undefined,
      payload.key,
      session.key,
      session.sessionKey,
      session.id,
    );

    const agentId = canonicalAgentId(explicitAgentId || agentIdFromSession(sessionId));
    const roleValue = firstString(payload.role, message.role);
    const role = isMessageRole(roleValue) ? roleValue : undefined;
    const text = extractText(
      payload.text,
      payload.content,
      message.text,
      message.content,
      payload.delta,
    );

    return {
      id: firstString(payload.eventId, payload.id) || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: firstString(payload.timestamp, payload.ts) || new Date().toISOString(),
      type: frame.event,
      agentId,
      sessionId,
      text: text.slice(0, 2000),
      role,
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


function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function extractText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value)) {
      const text = value
        .map((item) => {
          if (typeof item === 'string') return item;
          const block = asRecord(item);
          return firstString(block.text, block.content, block.value);
        })
        .filter(Boolean)
        .join('\n')
        .trim();
      if (text) return text;
    }
    const record = asRecord(value);
    const nested = firstString(record.text, record.content, record.value);
    if (nested) return nested;
  }
  return '';
}


function agentIdFromSession(sessionId: string): string {
  const parts = sessionId.split(':');
  return parts[0] === 'agent' ? parts[1] || '' : '';
}

function canonicalAgentId(agentId: string): string {
  // Do NOT map runtime IDs to presentation identities here.
  // 'main' is a valid runtime agent ID — presentation mapping (main→sirius)
  // belongs in the frontend OpenClaw adapter via the installation manifest.
  return agentId;
}

function isMessageRole(value: string): value is 'user' | 'assistant' | 'system' | 'tool' {
  return value === 'user' || value === 'assistant' || value === 'system' || value === 'tool';
}
