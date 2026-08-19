/* ────────────────────────────────────────────────────────────
   OpenClawAdapter — persistent GatewayClient wrapper
   Replaces per-request WebSocket with a single persistent connection
   ──────────────────────────────────────────────────────────── */

import fs from 'fs';
import path from 'path';
import JSON5 from 'json5';
import { GatewayClient, type GatewayClientOptions } from './gateway/GatewayClient.js';
import type { GatewayError } from './gateway/GatewayErrors.js';
import { env } from '../config/env.js';
import { loadInstallationManifest } from '../config/manifest.js';
import { resolveAgentWorkspace, resolveAllAgentWorkspaces, expandHome } from './workspaceResolver.js';
import type {
  LastClawResponse,
  GatewayHealth,
  RuntimeAgent,
  NormalizedChannel,
  NormalizedChannelAccount,
  NormalizedDeliveryQueueFailure,
  ChannelConnectionState,
  DataSource,
} from './types.js';

let _client: GatewayClient | null = null;

/** Reset the singleton client (for tests) */
export function resetAdapterClient(): void {
  if (_client) {
    _client.close().catch(() => {});
    _client = null;
  }
}

function getClient(): GatewayClient {
  if (_client) return _client;

  const opts: GatewayClientOptions = {
    url: env.OPENCLAW_GATEWAY_URL,
    token: env.OPENCLAW_GATEWAY_TOKEN,
    lastclawHome: env.LASTCLAW_HOME,
    reconnectDelay: 3000,
    requestTimeout: 15_000,
    maxReconnectAttempts: 0,
  };

  _client = new GatewayClient(opts);

  _client.on('error', (err: GatewayError) => {
    console.error(`[GatewayClient] error: ${err.code} — ${err.message}`);
  });

  _client.on('connected', (info: { serverVersion?: string; protocol?: number }) => {
    console.log(`[GatewayClient] connected to Gateway v${info.serverVersion}, protocol ${info.protocol}`);
  });

  _client.on('disconnected', (err: GatewayError) => {
    console.warn(`[GatewayClient] disconnected: ${err.code} — ${err.message}`);
  });

  _client.on('gave-up', (err: GatewayError) => {
    console.error(`[GatewayClient] gave up reconnecting: ${err.message}`);
  });

  return _client;
}

/** Shut down the client (for graceful shutdown) */
export function shutdownAdapter(): Promise<void> {
  if (_client) {
    const p = _client.close();
    _client = null;
    return p;
  }
  return Promise.resolve();
}

/** Get the shared GatewayClient instance */
export function getGatewayClient(): GatewayClient {
  return getClient();
}

function ok<T>(data: T, source: DataSource = 'LIVE'): LastClawResponse<T> {
  return { data, source, observedAt: new Date().toISOString(), stale: false };
}

function fail<T>(data: T, code: string, message: string): LastClawResponse<T> {
  return {
    data,
    source: 'ERROR',
    observedAt: new Date().toISOString(),
    stale: false,
    error: { code, message },
  };
}

function extractError(err: unknown): { code: string; message: string } {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const e = err as { code: string; message?: string };
    return { code: e.code, message: e.message || String(e) };
  }
  return {
    code: 'GATEWAY_UNAVAILABLE',
    message: err instanceof Error ? err.message : String(err),
  };
}

// ── Channel + queue normalization helpers ──────────────────

function asStr(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  // Real OpenClaw payloads send timestamps as unix ms numbers
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    return new Date(v).toISOString();
  }
  return null;
}

function asBool(v: unknown): boolean {
  return v === true;
}

function asNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function deriveConnectionState(
  connected: boolean,
  reconnectPending: boolean,
  lastError: string | null,
): ChannelConnectionState {
  if (reconnectPending) return 'RECONNECTING';
  if (lastError) return 'ERROR';
  if (connected) return 'CONNECTED';
  return 'DISCONNECTED';
}

/**
 * Normalize channels block from raw health payload.
 * Handles both nested-object shape:
 *   channels: { discord: { accounts: { main: {...} } } }
 * and array shape:
 *   channels: [ { name: 'discord', accounts: [...] } ]
 * No hardcoded channel or account names.
 */
export function normalizeChannels(rawHealth: any): NormalizedChannel[] {
  const rawChannels = rawHealth?.channels;
  if (!rawChannels) return [];

  const result: NormalizedChannel[] = [];

  // Array shape
  if (Array.isArray(rawChannels)) {
    for (const ch of rawChannels) {
      const channelName = asStr(ch.name) || 'unknown';
      const rawAccounts = ch.accounts;
      result.push({ channelName, accounts: normalizeAccounts(channelName, rawAccounts) });
    }
    return result;
  }

  // Object shape: { channelName: { accounts: { accountId: {...} } | [...] } }
  if (typeof rawChannels === 'object') {
    for (const [channelName, chData] of Object.entries(rawChannels as Record<string, any>)) {
      const rawAccounts = (chData as any)?.accounts;
      result.push({ channelName, accounts: normalizeAccounts(channelName, rawAccounts) });
    }
  }

  return result;
}

function normalizeAccounts(channelName: string, rawAccounts: any): NormalizedChannelAccount[] {
  if (!rawAccounts) return [];

  const entries: Array<[string, any]> = Array.isArray(rawAccounts)
    ? rawAccounts.map((a: any) => [asStr(a.id) || asStr(a.accountId) || 'unknown', a])
    : Object.entries(rawAccounts as Record<string, any>);

  return entries.map(([accountId, acc]) => {
    const connected = asBool(acc.connected);
    const reconnectPending = asBool(acc.reconnectPending);
    const lastError = asStr(acc.lastError);
    return {
      accountId,
      enabled: asBool(acc.enabled),
      configured: asBool(acc.configured),
      running: asBool(acc.running),
      connected,
      reconnectPending,
      reconnectAttempts: asNum(acc.reconnectAttempts),
      lastConnectedAt: asStr(acc.lastConnectedAt),
      lastEventAt: asStr(acc.lastEventAt),
      lastTransportActivityAt: asStr(acc.lastTransportActivityAt),
      lastInboundAt: asStr(acc.lastInboundAt),
      lastOutboundAt: asStr(acc.lastOutboundAt),
      lastError,
      lastDisconnect: asStr(acc.lastDisconnect),
      connectionState: deriveConnectionState(connected, reconnectPending, lastError),
    };
  });
}

/**
 * Normalize deliveryQueues block.
 * Only returns queues with count > 0 (failures only).
 * Handles: { outbound: { count: 32, oldestFailedAt: ... } }
 *   and: { failed: [ { name, count, oldestFailedAt } ] }
 */
export function normalizeDeliveryQueues(rawHealth: any): NormalizedDeliveryQueueFailure[] {
  const rawQueues = rawHealth?.deliveryQueues;
  if (!rawQueues || typeof rawQueues !== 'object') return [];

  const failures: NormalizedDeliveryQueueFailure[] = [];

  // Array of failed items shape: { failed: [...] }
  if (Array.isArray(rawQueues.failed)) {
    for (const item of rawQueues.failed) {
      const count = asNum(item.count);
      if (count > 0) {
        failures.push({
          queueName: asStr(item.name) || asStr(item.queueName) || 'unknown',
          count,
          oldestFailedAt: asStr(item.oldestFailedAt) || asStr(item.oldest) || null,
        });
      }
    }
    return failures;
  }

  // Object shape: { outbound: { count, oldestFailedAt }, inbound: {...} }
  for (const [queueName, qData] of Object.entries(rawQueues)) {
    if (typeof qData !== 'object' || qData === null) continue;
    const count = asNum((qData as any).count);
    if (count > 0) {
      failures.push({
        queueName,
        count,
        oldestFailedAt:
          asStr((qData as any).oldestFailedAt) ||
          asStr((qData as any).oldest) ||
          null,
      });
    }
  }

  return failures;
}

export class OpenClawAdapter {
  // ── Canonical agent mapping (manifest-aware & canonical resolver) ──
  /**
   * Map raw health agents to canonical RuntimeAgents.
   * Pass rawHealth to extract channel telemetry and heartbeat info.
   */
  mapToCanonicalAgents(rawAgents: any[], rawHealth?: any): RuntimeAgent[] {
    const manifest = loadInstallationManifest();
    const runtimeTarget = manifest.runtimeTarget || 'unknown';

    // Build reverse map: runtimeAgentId → canonical agent id
    const reverseMap = new Map<string, string>();
    for (const [canonicalId, agent] of Object.entries(manifest.agents)) {
      reverseMap.set(agent.runtimeAgentId, canonicalId);
      if (agent.runtimeAliases) {
        for (const alias of agent.runtimeAliases) {
          reverseMap.set(alias, canonicalId);
        }
      }
    }

    const VALID_AVAILABILITIES = new Set([
      'ONLINE', 'WORKING', 'BUSY', 'WAITING', 'OFFLINE', 'ERROR', 'UNKNOWN',
    ]);

    // Pre-normalize channels for channel↔agent matching
    const normalizedChannels = normalizeChannels(rawHealth || {});

    return rawAgents.map((raw: any) => {
      const runtimeAgentId = raw.agentId || raw.id || '';
      const canonicalId = reverseMap.get(runtimeAgentId) || runtimeAgentId;

      // ── Session telemetry ────────────────────────────────
      // session recency = proof of activity, NOT proof of availability
      const recentSessions: any[] = raw.sessions?.recent || [];
      const sessionCount: number = typeof raw.sessions?.count === 'number'
        ? raw.sessions.count
        : recentSessions.length;

      // lastActiveAt = MAX of sessions.recent[].updatedAt (unix ms)
      let lastActiveAt: number | undefined;
      for (const s of recentSessions) {
        const ts = typeof s.updatedAt === 'number' ? s.updatedAt
          : typeof s.updatedAt === 'string' ? new Date(s.updatedAt).getTime()
          : null;
        if (ts && (!lastActiveAt || ts > lastActiveAt)) lastActiveAt = ts;
        // also check s.age
        if (!ts && typeof s.age === 'number' && s.age > 0) {
          const derived = Date.now() - s.age * 1000;
          if (!lastActiveAt || derived > lastActiveAt) lastActiveAt = derived;
        }
      }

      // ── Availability ─────────────────────────────────────
      // STOP deriving ONLINE from session recency — session recency proves activity, not presence
      // Only trust explicit availability field from Gateway
      const rawAvail = (raw.availability || '').toUpperCase();
      let availability: string;
      if (VALID_AVAILABILITIES.has(rawAvail)) {
        availability = rawAvail;
      } else {
        // No explicit availability field in health payload → UNKNOWN
        // Do NOT promote to ONLINE based on session count/recency
        availability = 'UNKNOWN';
      }

      // ── Heartbeat (informational only) ───────────────────
      // heartbeat.enabled=false does NOT mean offline or disabled
      const heartbeatEnabled: boolean | undefined =
        raw.heartbeat != null ? asBool(raw.heartbeat?.enabled ?? raw.heartbeat) : undefined;
      const heartbeatIntervalMs: number | undefined =
        raw.heartbeat?.intervalMs != null ? asNum(raw.heartbeat.intervalMs) : undefined;

      // ── isDefault ────────────────────────────────────────
      const isDefault = asBool(raw.isDefault);

      // ── Canonical workspace resolution ───────────────────
      let resolvedWorkspace = '';
      if (raw.workspace && typeof raw.workspace === 'string' && raw.workspace.trim()) {
        resolvedWorkspace = path.resolve(expandHome(raw.workspace.trim()));
      } else {
        const resolution = resolveAgentWorkspace(runtimeAgentId);
        if (resolution.ok) {
          resolvedWorkspace = resolution.workspacePath;
        }
      }

      // ── Model resolution ─────────────────────────────────
      const resolvedModel = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : null;
      const configuredModel = typeof raw.configuredModel === 'string' && raw.configuredModel.trim()
        ? raw.configuredModel.trim()
        : null;

      // ── Channel telemetry ─────────────────────────────────
      // Match channel account to this agent using generic precedence:
      // 1. explicit runtime/channel binding (if OpenClaw exposes it — future)
      // 2. manifest channelAccountId (e.g. sirius.channelAccountId = 'sirius')
      // 3. exact runtimeAgentId == accountId
      // 4. canonical/presentation alias fallback (canonicalId == accountId)
      // 5. otherwise: channelConnected = undefined (unmapped)
      // No hardcoded if (agentId === 'main') return 'sirius' anywhere.
      let channelAccount: NormalizedChannelAccount | undefined;

      // Precedence 2: manifest channelAccountId
      const manifestAgent = manifest.agents[canonicalId];
      const boundAccountId = manifestAgent?.channelAccountId;
      if (boundAccountId) {
        findBound: for (const ch of normalizedChannels) {
          for (const acc of ch.accounts) {
            if (acc.accountId === boundAccountId) {
              channelAccount = acc;
              break findBound;
            }
          }
        }
      }

      // Precedence 3: exact runtimeAgentId == accountId
      if (!channelAccount) {
        findRuntime: for (const ch of normalizedChannels) {
          for (const acc of ch.accounts) {
            if (acc.accountId === runtimeAgentId) {
              channelAccount = acc;
              break findRuntime;
            }
          }
        }
      }

      // Precedence 4: canonical/presentation alias fallback
      if (!channelAccount) {
        findCanonical: for (const ch of normalizedChannels) {
          for (const acc of ch.accounts) {
            if (acc.accountId === canonicalId) {
              channelAccount = acc;
              break findCanonical;
            }
          }
        }
      }

      return {
        id: canonicalId,
        canonicalId,
        runtimeAgentId,
        runtimeTarget,
        runtimeKey: `${runtimeTarget}:${runtimeAgentId}`,
        name: raw.name || canonicalId,
        model: resolvedModel || configuredModel || 'unknown',
        resolvedModel: resolvedModel ?? undefined,
        configuredModel: configuredModel ?? undefined,
        workspace: resolvedWorkspace,
        availability,
        // Session telemetry
        sessionCount,
        lastActiveAt,
        isDefault,
        // Heartbeat — informational only
        heartbeatEnabled,
        heartbeatIntervalMs,
        // Channel telemetry (undefined if no matched account)
        channelConnected: channelAccount?.connected,
        channelRunning: channelAccount?.running,
        channelConfigured: channelAccount?.configured,
        channelEnabled: channelAccount?.enabled,
        channelReconnectPending: channelAccount?.reconnectPending,
        channelReconnectAttempts: channelAccount?.reconnectAttempts,
        lastChannelConnectedAt: channelAccount?.lastConnectedAt ?? null,
        lastChannelEventAt: channelAccount?.lastEventAt ?? null,
        lastChannelActivityAt: channelAccount?.lastTransportActivityAt ?? null,
        lastChannelInboundAt: channelAccount?.lastInboundAt ?? null,
        lastChannelOutboundAt: channelAccount?.lastOutboundAt ?? null,
        channelLastError: channelAccount?.lastError ?? null,
        bindings: raw.bindings || [],
        role: raw.role || 'agent',
      };
    });
  }

  /** Health check via persistent connection with cache fallback */
  async getHealth(): Promise<LastClawResponse<GatewayHealth | null>> {
    try {
      const client = getClient();
      const payload = await client.request('health') as any;
      // Enrich payload with normalized channel + queue data
      const enriched: GatewayHealth = {
        ...(payload as GatewayHealth),
        normalizedChannels: normalizeChannels(payload),
        deliveryQueueFailures: normalizeDeliveryQueues(payload),
      };
      const response = ok(enriched);
      // Write cache (redacts tokens internally)
      await this.writeCacheAtomically('health', enriched).catch(() => {});
      return response;
    } catch (err) {
      const { code, message } = extractError(err);
      // Try cache fallback
      const cached = await this.readCache('health');
      if (cached.source === 'CACHED') {
        return cached;
      }
      return fail(null, code, message);
    }
  }

  /** List agents — extracted from health payload (no agents.list method exists) */
  async listAgents(): Promise<LastClawResponse<RuntimeAgent[]>> {
    try {
      const client = getClient();
      const health = await client.request('health') as any;
      const rawAgents = health?.agents || [];
      // Pass full health so channel telemetry can be matched per-agent
      return ok(this.mapToCanonicalAgents(rawAgents, health));
    } catch (err) {
      const { code, message } = extractError(err);
      return fail([], code, message);
    }
  }

  /** List workspaces — resolved from canonical resolver and live agents */
  async listWorkspaces(): Promise<LastClawResponse<Record<string, string>>> {
    const { workspaces } = resolveAllAgentWorkspaces();
    const result = await this.listAgents();
    if (result.source !== 'ERROR') {
      for (const agent of result.data || []) {
        if (agent.workspace) {
          workspaces[agent.id] = agent.workspace;
          if (agent.runtimeAgentId && agent.runtimeAgentId !== agent.id) {
            workspaces[agent.runtimeAgentId] = agent.workspace;
          }
        }
      }
    }
    return ok(workspaces, result.source === 'ERROR' ? 'CACHED' : result.source);
  }

  /** List sessions — extracted from health payload */
  async listSessions(agentId?: string): Promise<LastClawResponse<any[]>> {
    try {
      const client = getClient();
      const health = await client.request('health') as any;
      let sessions = health?.sessions?.recent || [];
      if (agentId) {
        sessions = sessions.filter((s: any) => s.key?.includes(`agent:${agentId}:`));
      }
      return ok(sessions);
    } catch (err) {
      const { code, message } = extractError(err);
      return fail([], code, message);
    }
  }

  /** Create a new session — Gateway creates via chat.send (sessionKey routing) */
  async createSession(channel?: string, agentId?: string): Promise<LastClawResponse<any>> {
    // Gateway auto-creates sessions when chat.send is called with a new sessionKey
    return ok({ channel, agentId, note: 'Gateway auto-creates sessions on chat.send' });
  }

  /** Send a message — via chat.send */
  async sendMessage(sessionKey: string, message: string): Promise<LastClawResponse<any>> {
    try {
      const client = getClient();
      const idempotencyKey = `lastclaw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await client.request('chat.send', { sessionKey, message, idempotencyKey } as any);
      return ok(result);
    } catch (err) {
      const { code, message } = extractError(err);
      return fail(null, code, message);
    }
  }

  /** Close a session — Gateway does not expose this method */
  async closeSession(sessionId: string): Promise<LastClawResponse<any>> {
    return fail(null, 'NOT_SUPPORTED', 'Gateway does not expose a close session method');
  }

  /** Send a chat message — Gateway chat.send */
  async sendChat(message: string, sessionKey: string, agentId?: string): Promise<LastClawResponse<any>> {
    try {
      const client = getClient();
      const idempotencyKey = `lastclaw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await client.request('chat.send', {
        sessionKey,
        message,
        agentId,
        idempotencyKey,
      } as any);
      return ok(result);
    } catch (err) {
      const { code, message } = extractError(err);
      return fail(null, code, message);
    }
  }

  /** Get chat history — via chat.history */
  async chatHistory(sessionKey: string, limit?: number): Promise<LastClawResponse<any[]>> {
    try {
      const client = getClient();
      const history = await client.request('chat.history', { sessionKey, limit } as any);
      return ok(Array.isArray(history) ? history : []);
    } catch (err) {
      const { code, message } = extractError(err);
      return fail([], code, message);
    }
  }

  /** List workspace files — via worktrees.list */
  async listFiles(workspace: string, filePath?: string): Promise<LastClawResponse<any[]>> {
    try {
      const client = getClient();
      const worktrees = await client.request('worktrees.list' as any, { workspace } as any);
      return ok(Array.isArray(worktrees) ? worktrees : []);
    } catch (err) {
      const { code, message } = extractError(err);
      return fail([], code, message);
    }
  }

  /** Read a workspace file — placeholder */
  async readFile(workspace: string, filePath: string): Promise<LastClawResponse<any>> {
    return ok({ path: filePath, content: '', note: 'File read via Gateway not yet implemented' });
  }

  /** Get logs — via diagnostics.stability */
  async getLogs(agentId?: string, limit?: number, level?: string): Promise<LastClawResponse<any[]>> {
    try {
      const client = getClient();
      const logs = await client.request('diagnostics.stability' as any, {} as any);
      return ok(Array.isArray(logs) ? logs : []);
    } catch (err) {
      const { code, message } = extractError(err);
      return fail([], code, message);
    }
  }

  // ── Fallback config reader ──────────────────────────────────
  async readFallbackConfig(): Promise<any> {
    const configPath = env.OPENCLAW_CONFIG_PATH;
    try {
      if (!fs.existsSync(configPath)) {
        return { source: 'ERROR', error: { code: 'CONFIG_NOT_FOUND', message: `Config not found: ${configPath}` } };
      }
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON5.parse(raw);
      const defaults = parsed?.agents?.defaults || {};
      const agents = (parsed?.agents?.list || []).map((a: any) => {
        const agentId = a.id || a.agentId || '';
        const resolution = resolveAgentWorkspace(agentId);
        return {
          ...a,
          workspace: resolution.ok ? resolution.workspacePath : (a.workspace ? path.resolve(expandHome(a.workspace)) : (defaults.workspace ? path.resolve(expandHome(defaults.workspace)) : '')),
          model: a.model || defaults.model || 'unknown',
        };
      });
      return { source: 'FALLBACK', agents, defaults };
    } catch (err) {
      return { source: 'ERROR', error: { code: 'CONFIG_PARSE_FAILED', message: err instanceof Error ? err.message : String(err) } };
    }
  }

  // ── Cache read/write (with redaction) ──────────────────────
  async readCache(name: string): Promise<LastClawResponse<any>> {
    const cacheDir = path.join(env.LASTCLAW_HOME, 'cache');
    const cachePath = path.join(cacheDir, `${name}.json`);
    try {
      if (!fs.existsSync(cachePath)) {
        return fail(null, 'CACHE_NOT_FOUND', 'No cache file');
      }
      const raw = fs.readFileSync(cachePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const age = Date.now() - new Date(parsed.observedAt).getTime();
      const stale = age > 300_000; // 5 minutes
      return { data: parsed.data, source: 'CACHED', observedAt: parsed.observedAt, stale };
    } catch {
      return fail(null, 'CACHE_CORRUPTED', 'Cache file corrupted');
    }
  }

  async writeCacheAtomically(name: string, data: any): Promise<void> {
    const cacheDir = path.join(env.LASTCLAW_HOME, 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });

    const redacted = redactSensitiveFields(structuredClone(data));
    const payload = {
      schemaVersion: 1,
      observedAt: new Date().toISOString(),
      data: redacted,
    };

    const tmpPath = path.join(cacheDir, `${name}.tmp`);
    const finalPath = path.join(cacheDir, `${name}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
    fs.renameSync(tmpPath, finalPath);
  }
}

/** Recursively redact fields that look like tokens/keys/secrets */
function redactSensitiveFields(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  const SENSITIVE = /token|key|secret|password|authorization|credential/i;
  for (const k of Object.keys(obj)) {
    if (SENSITIVE.test(k) && typeof obj[k] === 'string') {
      delete obj[k];
    } else if (typeof obj[k] === 'object' && obj[k] !== null) {
      redactSensitiveFields(obj[k]);
    }
  }
  return obj;
}
