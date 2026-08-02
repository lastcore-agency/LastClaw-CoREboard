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

export interface GatewayHealth {
  ok: boolean;
  ts: number;
  durationMs?: number;
  uptime?: number;
  version?: string;
  pid?: number;
  memory?: { rss: number; heapUsed: number; heapTotal: number };
}

export interface RuntimeAgent {
  id: string;
  canonicalId: string;
  runtimeAgentId: string;
  runtimeTarget: string;
  runtimeKey: string;
  name?: string;
  model?: string;
  workspace?: string;
  availability?: string;
  bindings?: string[];
  role?: string;
  status?: string;
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
