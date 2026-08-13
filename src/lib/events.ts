/* ────────────────────────────────────────────────────────────
   Normalized Event types for Visual Office
   ──────────────────────────────────────────────────────────── */

export type NormalizedEventType =
  | 'agent.started'
  | 'agent.status'
  | 'session.started'
  | 'session.closed'
  | 'turn.started'
  | 'tool.started'
  | 'tool.finished'
  | 'message.started'
  | 'message.finished'
  | 'handoff.created'
  | 'handoff.accepted'
  | 'handoff.completed'
  | 'task.started'
  | 'task.completed'
  | 'task.failed';

export interface NormalizedEvent {
  id: string;
  timestamp: string;
  type: NormalizedEventType;
  agentId: string;
  runtimeAgentId?: string;
  targetAgentId?: string;
  sessionId?: string;
  text?: string;
  role?: 'user' | 'assistant' | 'system' | 'tool';
  source: 'LIVE' | 'MOCK';
  meta?: Record<string, unknown>;
}

/** Sanitize text for display — strip HTML, limit length */
export function sanitizeEventText(text: string, maxLen = 120): string {
  if (!text) return '';
  // Strip any HTML tags
  const stripped = text.replace(/<[^>]*>/g, '');
  // Strip hidden reasoning / chain-of-thought markers
  const cleaned = stripped
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/\[INTERNAL\][\s\S]*?\[\/INTERNAL\]/gi, '')
    .replace(/```\s*thinking[\s\S]*?```/gi, '');
  // Trim and limit
  const trimmed = cleaned.trim();
  if (trimmed.length > maxLen) return trimmed.slice(0, maxLen - 1) + '…';
  return trimmed;
}

/** Check if event type should show a speech bubble */
export function shouldShowBubble(type: NormalizedEventType): boolean {
  return ['message.started', 'message.finished', 'task.started', 'task.completed', 'handoff.created'].includes(type);
}

/** TTL for different event types (ms) */
export function getEventTTL(type: NormalizedEventType): number {
  switch (type) {
    case 'message.started':
    case 'message.finished':
      return 8000; // 8 seconds
    case 'task.started':
    case 'task.completed':
    case 'task.failed':
      return 10000; // 10 seconds
    case 'handoff.created':
      return 6000; // 6 seconds
    default:
      return 5000;
  }
}
