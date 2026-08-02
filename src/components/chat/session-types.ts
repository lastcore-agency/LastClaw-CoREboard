/* ────────────────────────────────────────────────────────────
   Native Session Information Model
   LastClaw command-center session interface types
   ──────────────────────────────────────────────────────────── */

/** Canonical agent IDs */
export const CANONICAL_AGENTS = [
  { id: 'sirius', name: 'Sirius', runtimeId: 'main', role: 'Team Lead' },
  { id: 'draco', name: 'Draco', runtimeId: 'draco', role: 'Frontend' },
  { id: 'polaris', name: 'Polaris', runtimeId: 'polaris', role: 'Orchestrator' },
  { id: 'antares', name: 'Antares', runtimeId: 'antares', role: 'QA' },
  { id: 'altair', name: 'Altair', runtimeId: 'altair', role: 'Deploy' },
  { id: 'capella', name: 'Capella', runtimeId: 'capella', role: 'Research' },
] as const;

export type CanonicalAgentId = typeof CANONICAL_AGENTS[number]['id'];

/** Session source classification */
export type SessionSource =
  | 'lastclaw-native'
  | 'main-direct'
  | 'discord'
  | 'telegram'
  | 'cron'
  | 'handoff'
  | 'other';

/** Session group in the navigator */
export type SessionGroup = 'native' | 'automation' | 'external';

/** Agent participation status */
export type AgentParticipation = 'primary' | 'planned' | 'active' | 'confirmed';

/** Message timeline item type */
export type TimelineItemType =
  | 'user-message'
  | 'agent-response'
  | 'runtime-event'
  | 'tool-event'
  | 'connection-event'
  | 'system-event'
  | 'error';

/** Session status */
export type SessionStatus = 'active' | 'idle' | 'closed' | 'unknown';

/** Normalized frontend session */
export interface NativeSession {
  sessionKey: string;
  title: string;
  objective: string;
  primaryAgentId: string;
  participatingAgentIds: string[];
  source: SessionSource;
  group: SessionGroup;
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  stale: boolean;
  messages: TimelineItem[];
  events: NormalizedEvent[];
  relatedFiles: string[];
  result: string | null;
  runtimeSource: string;
}

/** Timeline item in the workroom */
export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  role: 'user' | 'assistant' | 'system' | 'event' | 'error';
  text: string;
  agentId?: string;
  timestamp: number;
  source: 'LIVE' | 'LOCAL' | 'REAL';
  metadata?: Record<string, unknown>;
}

/** Normalized event from SSE */
export interface NormalizedEvent {
  id: string;
  timestamp: string;
  type: string;
  agentId: string;
  targetAgentId?: string;
  sessionId?: string;
  text?: string;
  source: 'LIVE' | 'MOCK';
  meta?: Record<string, unknown>;
}

/** Runtime agent from API */
export interface RuntimeAgent {
  id: string;
  canonicalId: string;
  runtimeAgentId: string;
  name?: string;
  model?: string;
  workspace?: string;
  availability?: string;
  bindings?: string[];
  role?: string;
}

/** LastClaw response wrapper */
export interface LastClawResponse<T> {
  data: T;
  source: 'LIVE' | 'REAL' | 'CACHED' | 'FALLBACK' | 'MOCK' | 'EMPTY' | 'ERROR';
  observedAt: string;
  stale: boolean;
  error?: { code: string; message: string };
}

/** Gateway health */
export interface GatewayHealth {
  ok: boolean;
  ts: number;
  durationMs?: number;
  uptime?: number;
  version?: string;
  pid?: number;
  memory?: { rss: number; heapUsed: number; heapTotal: number };
}

/** Workspace file entry */
export interface WorkspaceFile {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  modified?: string;
}

/** Workspace file content */
export interface WorkspaceFileContent {
  path: string;
  name: string;
  size: number;
  modified: string;
  content: string;
  encoding: string;
}

/** Chat send response */
export interface ChatSendResponse {
  runId: string;
  status: string;
}

/** Session metadata stored in localStorage */
export interface SessionMetadata {
  title: string;
  objective: string;
  primaryAgentId: string;
  participatingAgentIds: string[];
  source: SessionSource;
}

/** Classify a session key into a source */
export function classifySessionSource(sessionKey: string): SessionSource {
  if (!sessionKey) return 'other';
  if (sessionKey.includes(':discord:')) return 'discord';
  if (sessionKey.includes(':telegram:')) return 'telegram';
  if (sessionKey.includes(':cron:')) return 'cron';
  if (sessionKey.includes(':handoff:')) return 'handoff';
  if (sessionKey.includes(':lastclaw:')) return 'lastclaw-native';
  if (sessionKey.startsWith('agent:main:') || sessionKey.includes(':main:')) return 'main-direct';
  return 'other';
}

/** Classify a session key into a display group */
export function classifySessionGroup(source: SessionSource): SessionGroup {
  if (source === 'lastclaw-native' || source === 'main-direct') return 'native';
  if (source === 'cron') return 'automation';
  return 'external';
}

/** Derive a safe display title from session key */
export function deriveSessionTitle(sessionKey: string, metadata?: SessionMetadata): string {
  if (metadata?.title) return metadata.title;
  if (!sessionKey) return 'Untitled Session';

  // Try to extract human-readable parts from key
  const parts = sessionKey.split(':');
  const agentPart = parts.find(p =>
    CANONICAL_AGENTS.some(a => a.id === p || a.runtimeId === p)
  );
  const agentName = agentPart
    ? CANONICAL_AGENTS.find(a => a.id === agentPart || a.runtimeId === agentPart)?.name || agentPart
    : null;

  // Get the last meaningful segment (usually a short id)
  const lastPart = parts[parts.length - 1];
  if (lastPart && lastPart.length > 8) {
    // Looks like a UUID or hash — show first 8 chars
    return agentName ? `${agentName} · ${lastPart.slice(0, 8)}` : lastPart.slice(0, 8);
  }

  if (agentName && lastPart) return `${agentName} · ${lastPart}`;
  if (agentName) return agentName;
  if (lastPart) return lastPart;
  return sessionKey.slice(0, 32);
}

/** Derive agent name from canonical or runtime ID */
export function getAgentName(agentId: string): string {
  const found = CANONICAL_AGENTS.find(a => a.id === agentId || a.runtimeId === agentId);
  return found?.name || agentId;
}

/** Get canonical ID from any agent ID form */
export function getCanonicalAgentId(agentId: string): string {
  const found = CANONICAL_AGENTS.find(a => a.id === agentId || a.runtimeId === agentId);
  return found?.id || agentId;
}

/** Get runtime ID from canonical ID */
export function getRuntimeAgentId(canonicalId: string): string {
  const found = CANONICAL_AGENTS.find(a => a.id === canonicalId);
  return found?.runtimeId || canonicalId;
}

/** Format timestamp to relative time */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return 'just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Format timestamp to time string (HH:MM) */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Get source badge label and color */
export function getSourceBadge(source: SessionSource): { label: string; color: string } {
  switch (source) {
    case 'lastclaw-native': return { label: 'Native', color: '#8b5cf6' };
    case 'main-direct': return { label: 'Direct', color: '#3b82f6' };
    case 'discord': return { label: 'Discord', color: '#5865F2' };
    case 'telegram': return { label: 'Telegram', color: '#0088cc' };
    case 'cron': return { label: 'Cron', color: '#f59e0b' };
    case 'handoff': return { label: 'Handoff', color: '#10b981' };
    default: return { label: 'Other', color: '#6b7280' };
  }
}

/** Map timeline item type to display info */
export function getTimelineTypeDisplay(type: TimelineItemType): { icon: string; color: string } {
  switch (type) {
    case 'user-message': return { icon: '👤', color: '#3b82f6' };
    case 'agent-response': return { icon: '🤖', color: '#8b5cf6' };
    case 'runtime-event': return { icon: '⚡', color: '#06b6d4' };
    case 'tool-event': return { icon: '🔧', color: '#f59e0b' };
    case 'connection-event': return { icon: '🔗', color: '#10b981' };
    case 'system-event': return { icon: '📋', color: '#6b7280' };
    case 'error': return { icon: '⚠️', color: '#ef4444' };
    default: return { icon: '•', color: '#6b7280' };
  }
}
