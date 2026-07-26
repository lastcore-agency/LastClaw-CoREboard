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
  durationMs: number;
  status?: any;
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
  bindings?: string[];
  availability?: string;
  [key: string]: any;
}
