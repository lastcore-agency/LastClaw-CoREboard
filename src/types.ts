/* ────────────────────────────────────────────────────────────
   Agent types for LastClaw-CoREboard
   ──────────────────────────────────────────────────────────── */

export type AgentStatus = 'online' | 'working' | 'busy' | 'waiting' | 'offline' | 'error';

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

/** Scene configuration */
export interface SceneConfig {
  id: string;
  name: string;
  desktop: string;
  mobile: string;
  aspectRatio: { desktop: string; mobile: string };
}
