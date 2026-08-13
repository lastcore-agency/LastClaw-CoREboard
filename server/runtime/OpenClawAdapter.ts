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

export class OpenClawAdapter {
  // ── Canonical agent mapping (manifest-aware & canonical resolver) ──
  mapToCanonicalAgents(rawAgents: any[]): RuntimeAgent[] {
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

    return rawAgents.map((raw: any) => {
      const runtimeAgentId = raw.agentId || raw.id || '';
      const canonicalId = reverseMap.get(runtimeAgentId) || runtimeAgentId;

      // Availability: prefer explicit field; derive from sessions if not present
      // OpenClaw Gateway /health does not send availability field directly —
      // infer from sessions.recent[0].updatedAt age
      const rawAvail = (raw.availability || '').toUpperCase();
      // Last active timestamp and session count: from Gateway sessions data (Item 7)
      const recentSessions: any[] = raw.sessions?.recent || [];
      const lastActiveAt: number | null = recentSessions.length > 0
        ? (recentSessions[0].updatedAt || null)
        : null;
      const sessionCount: number = raw.sessions?.count || recentSessions.length;

      let availability: string;
      if (VALID_AVAILABILITIES.has(rawAvail)) {
        availability = rawAvail;
      } else {
        // Derive from session recency — Gateway /health provides sessions but not availability
        if (lastActiveAt && Date.now() - lastActiveAt < 30 * 60 * 1000) {
          availability = 'ONLINE'; // Active within 30 min
        } else if (lastActiveAt) {
          availability = 'ONLINE'; // Has registered sessions (registered in runtime)
        } else {
          availability = 'UNKNOWN'; // No sessions at all
        }
      }

      // Canonical workspace resolution
      let resolvedWorkspace = '';
      if (raw.workspace && typeof raw.workspace === 'string' && raw.workspace.trim()) {
        resolvedWorkspace = path.resolve(expandHome(raw.workspace.trim()));
      } else {
        const resolution = resolveAgentWorkspace(runtimeAgentId);
        if (resolution.ok) {
          resolvedWorkspace = resolution.workspacePath;
        }
      }

      // Model resolution: Gateway field = live/resolvedModel
      // configuredModel comes from openclaw.json (may be pre-injected via mergeConfigModel)
      const resolvedModel = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : null;
      const configuredModel = typeof raw.configuredModel === 'string' && raw.configuredModel.trim()
        ? raw.configuredModel.trim()
        : null;

      return {
        id: canonicalId,
        canonicalId,
        runtimeAgentId,
        runtimeTarget,
        runtimeKey: `${runtimeTarget}:${runtimeAgentId}`,
        name: raw.name || canonicalId,
        // Prefer live resolvedModel, fall back to configuredModel, then 'unknown'
        model: resolvedModel || configuredModel || 'unknown',
        resolvedModel: resolvedModel ?? undefined,
        configuredModel: configuredModel ?? undefined,
        workspace: resolvedWorkspace,
        availability,
        // Item 7: last active from real session data
        lastActiveAt: lastActiveAt ?? undefined,
        sessionCount,
        bindings: raw.bindings || [],
        role: raw.role || 'agent',
      };
    });
  }

  /** Health check via persistent connection with cache fallback */
  async getHealth(): Promise<LastClawResponse<GatewayHealth | null>> {
    try {
      const client = getClient();
      const payload = await client.request('health');
      const response = ok(payload as GatewayHealth);
      // Write cache on success
      await this.writeCacheAtomically('health', payload).catch(() => {});
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
      return ok(this.mapToCanonicalAgents(rawAgents));
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
