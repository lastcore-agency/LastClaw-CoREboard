export type DataSource =
  | 'LIVE'
  | 'REAL'
  | 'CACHED'
  | 'FALLBACK'
  | 'MOCK'
  | 'EMPTY'
  | 'ERROR';

export interface LastClawResponse<T> {
  data: T;
  source: DataSource;
  observedAt: string;
  stale: boolean;
  error?: {
    code: string;
    message: string;
  };
}

// ── Channel telemetry ─────────────────────────────────────────

export type ChannelConnectionState =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'ERROR'
  | 'UNKNOWN';

export interface NormalizedChannelAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  running: boolean;
  connected: boolean;
  reconnectPending: boolean;
  reconnectAttempts: number;
  lastConnectedAt: string | null;
  lastEventAt: string | null;
  lastTransportActivityAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  lastDisconnect: string | null;
  /** Derived from account fields — never use for Agent OFFLINE decision */
  connectionState: ChannelConnectionState;
}

export interface NormalizedChannel {
  channelName: string;
  accounts: NormalizedChannelAccount[];
}

// ── Delivery queue telemetry ──────────────────────────────────

export interface NormalizedDeliveryQueueFailure {
  queueName: string;
  count: number;
  oldestFailedAt: string | null;
}

// ── Gateway health ────────────────────────────────────────────

export interface GatewayHealth {
  ok: boolean;
  ts?: number;
  durationMs?: number;
  uptime?: number;
  version?: string;
  pid?: number;
  memory?: { rss: number; heapUsed: number; heapTotal: number };
  /** Normalized channel connectivity — populated by adapter after normalization */
  normalizedChannels?: NormalizedChannel[];
  /** Delivery queue failures (count > 0 only) — populated by adapter */
  deliveryQueueFailures?: NormalizedDeliveryQueueFailure[];
}

// ── Runtime agent ─────────────────────────────────────────────

export interface RuntimeAgent {
  id: string;
  canonicalId: string;
  runtimeAgentId: string;
  runtimeTarget: string;
  runtimeKey: string;
  name?: string;
  model?: string;
  resolvedModel?: string;
  configuredModel?: string;
  workspace?: string;
  availability?: string;
  bindings?: string[];
  role?: string;
  status?: string;

  // ── Session telemetry ─────────────────────────────────
  /** Number of sessions registered for this agent in the Gateway */
  sessionCount?: number;
  /** Unix ms of the most recent session.recent[].updatedAt */
  lastActiveAt?: number;
  /** Whether this is the default agent in the Gateway */
  isDefault?: boolean;

  // ── Heartbeat — informational only, never used for availability ──
  heartbeatEnabled?: boolean;
  heartbeatIntervalMs?: number;

  // ── Channel telemetry (best-match account for this agent) ────
  channelConnected?: boolean;
  channelRunning?: boolean;
  channelConfigured?: boolean;
  channelEnabled?: boolean;
  channelReconnectPending?: boolean;
  channelReconnectAttempts?: number;
  lastChannelConnectedAt?: string | null;
  lastChannelEventAt?: string | null;
  lastChannelActivityAt?: string | null;
  lastChannelInboundAt?: string | null;
  lastChannelOutboundAt?: string | null;
  channelLastError?: string | null;

  [key: string]: any;
}

export interface RuntimeSession {
  id: string;
  channel?: string;
  channelType?: string;
  agentId?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  lastMessage?: string;
}

export interface RuntimeChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  text?: string;
  agentId?: string;
  timestamp?: string;
}

export interface RuntimeWorkspaceFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

export interface RuntimeLogEntry {
  ts?: number;
  level?: string;
  msg?: string;
  agentId?: string;
  source?: string;
}
