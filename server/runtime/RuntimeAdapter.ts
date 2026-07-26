import { LastClawResponse, GatewayHealth, RuntimeAgent } from './types.js';

export interface RuntimeAdapter {
  discoverRuntime(): Promise<void>;
  getHealth(): Promise<LastClawResponse<GatewayHealth | null>>;
  listAgents(): Promise<LastClawResponse<RuntimeAgent[]>>;
  listWorkspaces(): Promise<LastClawResponse<string[]>>;

  // Typed placeholders for later phases
  listSessions?(): Promise<LastClawResponse<any[]>>;
  listTasks?(): Promise<LastClawResponse<any[]>>;
  streamEvents?(): any;
  readFiles?(): Promise<LastClawResponse<any>>;
  readLogs?(): Promise<LastClawResponse<any>>;
}
