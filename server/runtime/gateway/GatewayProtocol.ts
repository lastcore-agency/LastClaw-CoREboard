/* ────────────────────────────────────────────────────────────
   OpenClaw Gateway Protocol v3 — typed frames
   ──────────────────────────────────────────────────────────── */

export const GATEWAY_PROTOCOL_VERSION = 4 as const;

// ── Request ──────────────────────────────────────────────────
export interface GatewayRequest {
  type: 'req';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

// ── Response ─────────────────────────────────────────────────
export interface GatewayResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { message: string; code?: string; type?: string };
}

// ── Event ────────────────────────────────────────────────────
export interface GatewayEvent {
  type: 'event';
  event: string;
  payload?: unknown;
}

// ── Envelope (union) ─────────────────────────────────────────
export type GatewayFrame = GatewayRequest | GatewayResponse | GatewayEvent;

// ── Connect handshake ────────────────────────────────────────
export interface ConnectChallengePayload {
  nonce: string;
}

export interface ConnectRequestParams {
  minProtocol: number;
  maxProtocol: number;
  auth: { kind: string; token: string };
  role: string;
  scopes: string[];
  device?: { nonce: string; signature: string };
}

export interface HelloOkPayload {
  type: 'hello-ok';
  serverVersion?: string;
  protocol?: number;
  deviceId?: string;
}

export interface HelloErrorPayload {
  type: 'hello-error';
  message: string;
}

// ── Health ───────────────────────────────────────────────────
export interface HealthPayload {
  ok: boolean;
  ts?: number;
  uptime?: number;
  version?: string;
  pid?: number;
  memory?: { rss: number; heapUsed: number; heapTotal: number };
}

// ── Agent ────────────────────────────────────────────────────
export interface GatewayAgent {
  id: string;
  name?: string;
  model?: string | { primary: string; fallbacks?: string[] };
  workspace?: string;
  availability?: string;
  role?: string;
  status?: string;
}

// ── Session ──────────────────────────────────────────────────
export interface GatewaySession {
  id: string;
  channel?: string;
  channelType?: string;
  agentId?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  lastMessage?: string;
}

// ── Chat Message ─────────────────────────────────────────────
export interface GatewayChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  text?: string;
  agentId?: string;
  timestamp?: string;
}

// ── Workspace File ───────────────────────────────────────────
export interface GatewayWorkspaceFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

// ── Log Entry ────────────────────────────────────────────────
export interface GatewayLogEntry {
  ts?: number;
  level?: string;
  msg?: string;
  agentId?: string;
  source?: string;
}

// ── Request methods ──────────────────────────────────────────
export interface GatewayMethodMap {
  'health': { params?: never; result: HealthPayload };
  'agents.list': { params?: never; result: GatewayAgent[] };
  'sessions.list': { params?: { agentId?: string }; result: GatewaySession[] };
  'sessions.create': { params: { channel?: string; agentId?: string }; result: GatewaySession };
  'sessions.send': { params: { sessionId: string; text: string }; result: { ok: boolean; messageId?: string } };
  'sessions.close': { params: { sessionId: string }; result: { ok: boolean } };
  'chat.send': { params: { text: string; agentId?: string; sessionId?: string }; result: { ok: boolean; messageId?: string } };
  'chat.history': { params: { sessionId: string; limit?: number }; result: GatewayChatMessage[] };
  'files.list': { params: { workspace: string; path?: string }; result: GatewayWorkspaceFile[] };
  'files.read': { params: { workspace: string; path: string }; result: { content: string; encoding?: string } };
  'logs': { params?: { agentId?: string; limit?: number; level?: string }; result: GatewayLogEntry[] };
}

export type GatewayMethodName = keyof GatewayMethodMap;

// ── Tick (heartbeat) ─────────────────────────────────────────
export interface TickEvent {
  type: 'event';
  event: 'tick';
  payload?: { ts?: number };
}

// ── Helpers ──────────────────────────────────────────────────
let _reqCounter = 0;

export function nextRequestId(): string {
  return `lastclaw-${Date.now()}-${++_reqCounter}`;
}

export function buildRequest<M extends GatewayMethodName>(
  method: M,
  params?: GatewayMethodMap[M]['params'],
): GatewayRequest {
  return {
    type: 'req',
    id: nextRequestId(),
    method,
    params: params as Record<string, unknown> | undefined,
  };
}

export function isGatewayFrame(data: unknown): data is GatewayFrame {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return obj.type === 'req' || obj.type === 'res' || obj.type === 'event';
}
