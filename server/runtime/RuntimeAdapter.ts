import {
  LastClawResponse,
  GatewayHealth,
  RuntimeAgent,
  RuntimeSession,
  RuntimeChatMessage,
  RuntimeWorkspaceFile,
  RuntimeLogEntry,
} from './types.js';

export interface RuntimeAdapter {
  discoverRuntime(): Promise<void>;
  getHealth(): Promise<LastClawResponse<GatewayHealth | null>>;
  listAgents(): Promise<LastClawResponse<RuntimeAgent[]>>;
  listWorkspaces(): Promise<LastClawResponse<Record<string, string>>>;

  listSessions(agentId?: string): Promise<LastClawResponse<RuntimeSession[]>>;
  createSession(channel?: string, agentId?: string): Promise<LastClawResponse<RuntimeSession | null>>;
  sendMessage(sessionId: string, text: string): Promise<LastClawResponse<any>>;
  closeSession(sessionId: string): Promise<LastClawResponse<any>>;

  sendChat(text: string, agentId?: string, sessionId?: string): Promise<LastClawResponse<any>>;
  chatHistory(sessionId: string, limit?: number): Promise<LastClawResponse<RuntimeChatMessage[]>>;

  listFiles(workspace: string, filePath?: string): Promise<LastClawResponse<RuntimeWorkspaceFile[]>>;
  readFile(workspace: string, filePath: string): Promise<LastClawResponse<{ content: string } | null>>;

  getLogs(agentId?: string, limit?: number, level?: string): Promise<LastClawResponse<RuntimeLogEntry[]>>;
}
