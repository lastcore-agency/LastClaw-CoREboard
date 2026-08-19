/* ────────────────────────────────────────────────────────────
   Agent types for LastClaw-CoREboard
   ──────────────────────────────────────────────────────────── */

export type AgentStatus = 'online' | 'working' | 'busy' | 'waiting' | 'offline' | 'error' | 'unknown';

export type DataSource = 'MOCK' | 'LIVE' | 'CACHED' | 'REAL' | 'FALLBACK' | 'EMPTY' | 'ERROR';

export interface SkillEntry {
  name: string;
  description: string;
  source: string;
  enabled: boolean;
  permission: 'granted' | 'denied' | 'pending';
  dependencyStatus: 'ok' | 'missing' | 'outdated';
}

/** Responsive scene coordinate for each breakpoint */
export interface BreakpointPosition {
  x: number;
  y: number;
  scale: number;
}

/** Agent position across responsive breakpoints */
export interface AgentPosition {
  desktop: BreakpointPosition;
  tablet: BreakpointPosition;
  mobile: BreakpointPosition;
}

/** Character animation direction */
export type CharacterDirection = 'front' | 'left' | 'right' | 'back';

/** Character animation state */
export type CharacterAnimState = 'idle' | 'working';

/** Character avatar paths */
export interface CharacterAssets {
  animated: string; // webp animated for idle
  static: string;   // static webp for reduced-motion
  direction: CharacterDirection;
}

export interface Agent {
  id: string;
  displayName: string;
  role: string;
  status: AgentStatus;
  currentTask: string;
  model: string;
  progress: number;
  room: string;
  avatar: string;
  source: DataSource;
  /* Visual Office position (legacy) */
  x: number;
  y: number;
  /* Responsive positions */
  position: AgentPosition;
  /* Character assets */
  character: CharacterAssets;
  bubble: string;
  color: string;
  /* Extended fields */
  uptime: string;
  queue: string;
  latency: string;
  memory: string;
  lastActive: string;
  sessionId: string;
  workspace: string;
  recentActivity: string[];
  runtimeHealth: 'healthy' | 'degraded' | 'unhealthy';
  skills: SkillEntry[];

  // ── Runtime telemetry (optional — populated in LIVE mode only) ──
  /** Canonical runtime agent ID from Gateway */
  runtimeAgentId?: string;
  /** Whether this is the Gateway default agent */
  isDefault?: boolean;
  /** Number of active sessions in Gateway */
  sessionCount?: number;
  /** Unix ms of most recent session activity */
  lastActiveAt?: number;
  // Channel connectivity (best-match account for this agent)
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
  /** Heartbeat enabled flag — informational only, never used for availability */
  heartbeatEnabled?: boolean;
  heartbeatIntervalMs?: number;
  /** Live-resolved model from Gateway */
  resolvedModel?: string;
  /** Configured model from openclaw.json */
  configuredModel?: string;
}

export type ConnectionState = 'connected' | 'degraded' | 'offline' | 'reconnecting';

/** Normalized channel account (mirrors server NormalizedChannelAccount) */
export interface ChannelAccount {
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
  connectionState: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'ERROR' | 'UNKNOWN';
}

export interface NormalizedChannel {
  channelName: string;
  accounts: ChannelAccount[];
}

export interface DeliveryQueueFailure {
  queueName: string;
  count: number;
  oldestFailedAt: string | null;
}

export interface GatewaySnapshot {
  status: 'online' | 'offline';
  latency: string;
  cpu: string;
  ram: string;
  queue: string;
  sessions: number;
  source: DataSource;
  /** Raw ok flag from Gateway health payload */
  ok?: boolean;
  /** ISO timestamp of health observation */
  observedAt?: string;
  /** Whether the health data is stale */
  stale?: boolean;
  /** Normalized channel connectivity */
  normalizedChannels?: NormalizedChannel[];
  /** Delivery queue failures (count > 0 only) */
  deliveryQueueFailures?: DeliveryQueueFailure[];
}

export type NavPage = 'center' | 'studio' | 'board' | 'chat' | 'settings';

export type InspectorTab = 'status' | 'configure' | 'skills' | 'chat';

/** Scene configuration */
export interface SceneConfig {
  id: string;
  name: string;
  desktop: string;
  mobile: string;
  aspectRatio: { desktop: string; mobile: string };
}
