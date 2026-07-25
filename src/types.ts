/* ────────────────────────────────────────────────────────────
   Agent types for LastClaw-CoREboard
   ──────────────────────────────────────────────────────────── */

export type AgentStatus = 'online' | 'working' | 'busy' | 'waiting' | 'offline' | 'error';

export type DataSource = 'MOCK' | 'LIVE' | 'CACHED';

export interface SkillEntry {
  name: string;
  description: string;
  source: string;
  enabled: boolean;
  permission: 'granted' | 'denied' | 'pending';
  dependencyStatus: 'ok' | 'missing' | 'outdated';
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
  /* Visual Office position */
  x: number;
  y: number;
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
}

export type ConnectionState = 'connected' | 'degraded' | 'offline' | 'reconnecting';

export interface GatewaySnapshot {
  status: 'online' | 'offline';
  latency: string;
  cpu: string;
  ram: string;
  queue: string;
  sessions: number;
  source: DataSource;
}

export type NavPage = 'center' | 'studio' | 'board' | 'chat' | 'settings';

export type InspectorTab = 'status' | 'configure' | 'skills' | 'chat';
