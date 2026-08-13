/* ────────────────────────────────────────────────────────────
   useAgentActivity — per-agent runtime activity state store

   Responsibilities:
   - Listen to SSE events from /api/runtime/events
   - Normalize each event into a RuntimeAgentActivity
   - Store activity state PER AGENT (never clobber unrelated agents)
   - Use timestamp precedence: newer event wins over older polling snapshot
   - Polling refresh CANNOT overwrite a newer SSE activity state
   - Provide agentState(agentId) for VisualOffice character rendering
   - Generate speech bubble text from real event content only
   - Disconnect without agent-specific proof → UNKNOWN, NOT OFFLINE

   RuntimeAgentState values:
   UNKNOWN     = no information
   OFFLINE     = runtime explicitly reported offline
   IDLE        = online, no active run
   LISTENING   = inbound user message received by this agent
   THINKING    = run started, inference in progress
   WORKING     = tool execution or active run
   USING_TOOL  = specific tool call in flight
   RESPONDING  = assistant message streaming/returned
   WAITING     = waiting for external resource
   ERROR       = run or tool failure
   ──────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Runtime agent states ─────────────────────────────────────

export type RuntimeAgentState =
  | 'UNKNOWN'
  | 'OFFLINE'
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'WORKING'
  | 'USING_TOOL'
  | 'RESPONDING'
  | 'WAITING'
  | 'ERROR';

export interface RuntimeAgentActivity {
  agentId: string;
  state: RuntimeAgentState;
  /** Unix ms timestamp of the event that set this state */
  eventTimestamp: number;
  /** Source of this state: 'SSE' (real-time) or 'POLL' (polling snapshot) */
  source: 'SSE' | 'POLL';
  /** Optional: bubble text from real event */
  bubbleText?: string;
  /** Optional: tool name if USING_TOOL */
  toolName?: string;
  /** Optional: session key */
  sessionKey?: string;
}

// ── Event → state mapping ────────────────────────────────────
// Based on actual OpenClaw Gateway event types from GatewayEvents.ts:
//   session.message, session.updated, sessions.changed,
//   presence.diff, channel.status, agent.model.active, tick, health

/**
 * Map a normalized Gateway event to a RuntimeAgentState.
 * Returns null if event does not imply a state change.
 */
export function mapEventToState(event: {
  type: string;
  role?: string;
  text?: string;
}): RuntimeAgentState | null {
  const { type, role } = event;

  switch (type) {
    // ── Session message events ───────────────────────────────
    case 'session.message':
      if (role === 'user') return 'LISTENING';
      if (role === 'assistant') return 'RESPONDING';
      if (role === 'tool') return 'USING_TOOL';
      return null; // system messages don't change visible state

    // ── Agent run lifecycle ──────────────────────────────────
    case 'agent.started':
    case 'turn.started':
    case 'task.started':
      return 'THINKING';

    case 'tool.started':
      return 'USING_TOOL';

    case 'tool.finished':
      return 'WORKING'; // back to working after tool completes

    case 'message.started':
      return 'RESPONDING';

    case 'message.finished':
    case 'agent.finished':
    case 'turn.finished':
    case 'task.completed':
      return 'IDLE';

    case 'task.failed':
    case 'agent.error':
      return 'ERROR';

    // ── Presence events (from OpenClaw Gateway presence.diff) ─
    case 'presence.diff':
    case 'agent.status': {
      // presence.diff carries availability in event payload
      // Let upstream caller handle availability field separately
      return null;
    }

    // ── Session lifecycle ────────────────────────────────────
    case 'session.started':
      return 'LISTENING'; // first user message implied
    case 'session.closed':
      return 'IDLE';

    // ── Handoff ──────────────────────────────────────────────
    case 'handoff.created':
      return 'WORKING'; // handing off to another agent

    case 'handoff.accepted':
    case 'handoff.completed':
      return 'IDLE';

    // ── Gateway connection (not agent-specific) ──────────────
    case 'gateway.connected':
    case 'gateway.disconnected':
    case 'stream.connected':
    case 'tick':
    case 'health':
    case 'sessions.changed':
    case 'channel.status':
    case 'agent.model.active':
    case 'session.updated':
      // These events don't map to a specific agent activity state change
      return null;

    default:
      return null;
  }
}

/**
 * Map availability string from Gateway presence/polling to RuntimeAgentState.
 * Used when polling returns agent availability fields.
 * Presence → POLL source, so SSE states with newer timestamps win.
 */
export function mapAvailabilityToRuntimeState(availability: string | undefined): RuntimeAgentState {
  const a = (availability || '').toUpperCase();
  switch (a) {
    case 'WORKING': return 'WORKING';
    case 'BUSY':    return 'WORKING';
    case 'WAITING': return 'WAITING';
    case 'ONLINE':  return 'IDLE';
    case 'OFFLINE': return 'OFFLINE';
    case 'ERROR':   return 'ERROR';
    // UNKNOWN or unrecognized → UNKNOWN (never infer OFFLINE from missing data)
    default:        return 'UNKNOWN';
  }
}

/**
 * Generate bubble text from a real event.
 * Returns undefined if the event doesn't warrant a bubble.
 */
export function deriveBubbleText(event: {
  type: string;
  text?: string;
  role?: string;
}): string | undefined {
  const { type, text, role } = event;

  // Real assistant response text → show it
  if (role === 'assistant' && text && text.trim()) {
    return text.slice(0, 120) + (text.length > 120 ? '…' : '');
  }

  // Real tool name if available
  if (type === 'tool.started' && text) return `Using ${text}…`;
  if (type === 'tool.finished' && text) return `${text} done`;

  // Activity indicators derived from real event semantics
  switch (type) {
    case 'agent.started':
    case 'turn.started':
    case 'task.started':
      return 'Thinking…';
    case 'message.started':
      return text?.trim() ? undefined : 'Responding…'; // text comes separately
    case 'handoff.created':
      return 'Handing off…';
    case 'session.started':
      return undefined; // no bubble for session start
    default:
      return undefined;
  }
}

// ── Activity Store Hook ──────────────────────────────────────

export interface UseAgentActivityResult {
  /** Get current runtime activity for an agent. Falls back to UNKNOWN. */
  getAgentActivity: (agentId: string) => RuntimeAgentActivity;
  /** Update a specific agent's state from polling (POLL source, lower precedence) */
  updateFromPoll: (agentId: string, availability: string, timestamp?: number) => void;
  /** Get all current activities */
  getAllActivities: () => Map<string, RuntimeAgentActivity>;
  /** Bubble text per agent for VisualOffice */
  bubbles: Map<string, { text: string; expiresAt: number }>;
  /** Whether SSE is connected */
  sseConnected: boolean;
}

const BUBBLE_TTL: Record<string, number> = {
  'session.message': 8_000,
  'message.started': 8_000,
  'message.finished': 8_000,
  'task.started': 10_000,
  'task.completed': 6_000,
  'tool.started': 6_000,
  'tool.finished': 4_000,
  'handoff.created': 6_000,
  default: 5_000,
};

const ACTIVITY_TIMEOUT_MS = 30_000; // If no event in 30s, revert to IDLE if previously active

const UNKNOWN_ACTIVITY: RuntimeAgentActivity = {
  agentId: '',
  state: 'UNKNOWN',
  eventTimestamp: 0,
  source: 'POLL',
};

export function useAgentActivity(isMock: boolean): UseAgentActivityResult {
  const [activities, setActivities] = useState<Map<string, RuntimeAgentActivity>>(new Map());
  const [bubbles, setBubbles] = useState<Map<string, { text: string; expiresAt: number }>>(new Map());
  const [sseConnected, setSseConnected] = useState(false);

  const mountedRef = useRef(true);
  const esRef = useRef<EventSource | null>(null);
  const bubbleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Activity update helper ───────────────────────────────────
  const updateActivity = useCallback((
    agentId: string,
    state: RuntimeAgentState,
    eventTimestamp: number,
    source: 'SSE' | 'POLL',
    extra?: Partial<RuntimeAgentActivity>,
  ) => {
    if (!agentId || !mountedRef.current) return;

    setActivities(prev => {
      const existing = prev.get(agentId);

      // Timestamp precedence: newer wins; SSE always beats POLL at same timestamp
      if (existing) {
        if (eventTimestamp < existing.eventTimestamp) return prev; // stale — ignore
        if (eventTimestamp === existing.eventTimestamp && source === 'POLL' && existing.source === 'SSE') return prev;
      }

      const next = new Map(prev);
      next.set(agentId, {
        agentId,
        state,
        eventTimestamp,
        source,
        ...extra,
      });
      return next;
    });
  }, []);

  // ── Bubble helper ────────────────────────────────────────────
  const showBubble = useCallback((agentId: string, text: string, eventType: string) => {
    if (!agentId || !text || !mountedRef.current) return;

    const ttl = BUBBLE_TTL[eventType] ?? BUBBLE_TTL.default;
    const expiresAt = Date.now() + ttl;

    // Clear existing timer for this agent
    const existing = bubbleTimersRef.current.get(agentId);
    if (existing) clearTimeout(existing);

    setBubbles(prev => {
      const next = new Map(prev);
      next.set(agentId, { text, expiresAt });
      return next;
    });

    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      setBubbles(prev => {
        const next = new Map(prev);
        const b = next.get(agentId);
        if (b && b.expiresAt === expiresAt) next.delete(agentId);
        return next;
      });
      bubbleTimersRef.current.delete(agentId);
    }, ttl);

    bubbleTimersRef.current.set(agentId, timer);
  }, []);

  // ── SSE event handler ────────────────────────────────────────
  const handleSSEEvent = useCallback((raw: string) => {
    let event: {
      type: string;
      agentId?: string;
      text?: string;
      role?: string;
      timestamp?: string;
    };
    try {
      event = JSON.parse(raw);
    } catch { return; }

    const { type, agentId, text, role, timestamp } = event;
    const eventTs = timestamp ? new Date(timestamp).getTime() : Date.now();

    // Gateway connection events — not agent-specific
    if (type === 'stream.connected') {
      setSseConnected(true);
      return;
    }
    if (type === 'gateway.disconnected') {
      // Do NOT set agents OFFLINE — disconnect without per-agent proof → UNKNOWN
      setSseConnected(false);
      return;
    }
    if (type === 'gateway.connected') {
      setSseConnected(true);
      return;
    }

    if (!agentId) return; // non-agent events ignored for activity

    const newState = mapEventToState({ type, role, text });
    if (newState !== null) {
      updateActivity(agentId, newState, eventTs, 'SSE', { sessionKey: undefined });
    }

    const bubbleText = deriveBubbleText({ type, text, role });
    if (bubbleText) showBubble(agentId, bubbleText, type);
  }, [updateActivity, showBubble]);

  // ── SSE connection ───────────────────────────────────────────
  useEffect(() => {
    if (isMock) return;

    const baseUrl = (import.meta as any).env?.VITE_OPENCLAW_API_BASE || '/api/runtime';
    const es = new EventSource(`${baseUrl}/events`);
    esRef.current = es;

    es.onmessage = (msg) => {
      if (mountedRef.current) handleSSEEvent(msg.data);
    };

    es.onerror = () => {
      setSseConnected(false);
      // EventSource will auto-reconnect — do NOT set agents OFFLINE
    };

    return () => {
      es.close();
      esRef.current = null;
      setSseConnected(false);
    };
  }, [isMock, handleSSEEvent]);

  // ── Bubble expiry cleanup ────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      const now = Date.now();
      setBubbles(prev => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, b] of next) {
          if (now > b.expiresAt) { next.delete(id); changed = true; }
        }
        return changed ? next : prev;
      });
    }, 1_000);
    return () => clearInterval(interval);
  }, []);

  // ── Unmount cleanup ──────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const t of bubbleTimersRef.current.values()) clearTimeout(t);
      bubbleTimersRef.current.clear();
    };
  }, []);

  // ── Public API ───────────────────────────────────────────────
  const getAgentActivity = useCallback((agentId: string): RuntimeAgentActivity => {
    return activities.get(agentId) ?? { ...UNKNOWN_ACTIVITY, agentId };
  }, [activities]);

  const updateFromPoll = useCallback((
    agentId: string,
    availability: string,
    timestamp: number = Date.now(),
  ) => {
    const state = mapAvailabilityToRuntimeState(availability);
    updateActivity(agentId, state, timestamp, 'POLL');
  }, [updateActivity]);

  const getAllActivities = useCallback(() => new Map(activities), [activities]);

  return { getAgentActivity, updateFromPoll, getAllActivities, bubbles, sseConnected };
}
