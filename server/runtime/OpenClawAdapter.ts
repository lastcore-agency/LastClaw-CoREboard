import fs from 'fs';
import path from 'path';
import os from 'os';
import { WebSocket } from 'ws';
import crypto from 'crypto';
import JSON5 from 'json5';
import { env } from '../config/env.js';
import { RuntimeAdapter } from './RuntimeAdapter.js';
import { LastClawResponse, GatewayHealth, RuntimeAgent, DataSource } from './types.js';
import { loadInstallationManifest, InstallationManifest } from '../config/manifest.js';

export class OpenClawAdapter implements RuntimeAdapter {
  private cacheDir: string;

  constructor() {
    this.cacheDir = path.join(env.LASTCLAW_HOME, 'cache');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private async writeCacheAtomically(key: string, data: any): Promise<void> {
    const targetPath = path.join(this.cacheDir, `${key}.json`);
    const tempPath = `${targetPath}.tmp.${Date.now()}`;
    const payload = {
      schemaVersion: 1,
      observedAt: new Date().toISOString(),
      data,
    };
    // Exclude tokens if any accidentally leaked
    const safePayloadStr = JSON.stringify(payload, (k, v) => (k.toLowerCase().includes('token') ? undefined : v), 2);
    await fs.promises.writeFile(tempPath, safePayloadStr, 'utf-8');
    await fs.promises.rename(tempPath, targetPath);
  }

  private async readCache(key: string): Promise<any | null> {
    const targetPath = path.join(this.cacheDir, `${key}.json`);
    try {
      const content = await fs.promises.readFile(targetPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private mapToCanonicalAgents(rawAgents: any[], defaultModel?: string, defaultWorkspace?: string): RuntimeAgent[] {
    const manifest = loadInstallationManifest();
    return rawAgents.map(a => {
      const runtimeAgentId = a.id;
      let canonicalId = runtimeAgentId;

      for (const [canonId, def] of Object.entries(manifest.agents)) {
        if (def.runtimeAgentId === runtimeAgentId || (def.runtimeAliases && def.runtimeAliases.includes(runtimeAgentId))) {
          canonicalId = canonId;
          break;
        }
      }

      let availability = 'UNKNOWN';
      const rawAvailability = (a.availability || '').toUpperCase();
      if (['WORKING', 'ONLINE', 'BUSY', 'WAITING', 'OFFLINE', 'ERROR'].includes(rawAvailability)) {
        availability = rawAvailability;
      }

      const ws = a.workspace || defaultWorkspace;

      return {
        id: canonicalId,
        canonicalId,
        runtimeAgentId,
        runtimeTarget: manifest.runtimeTarget,
        runtimeKey: `${manifest.runtimeTarget}:${runtimeAgentId}`,
        name: a.name,
        model: a.model || defaultModel || 'unknown',
        workspace: ws ? ws.replace(/^~(?=$|\/|\\)/, os.homedir()) : ws,
        bindings: a.bindings || [],
        availability
      };
    });
  }

  private async readFallbackConfig(): Promise<{ source: DataSource; error?: any; agents?: RuntimeAgent[]; workspaces?: string[] }> {
    try {
      const content = await fs.promises.readFile(env.OPENCLAW_CONFIG_PATH, 'utf-8');
      const parsed = JSON5.parse(content);
      
      const agents = parsed?.agents?.list || [];
      const mappedAgents: RuntimeAgent[] = this.mapToCanonicalAgents(agents, parsed?.agents?.defaults?.model, parsed?.agents?.defaults?.workspace);

      const workspaces = mappedAgents.map(a => a.workspace).filter(Boolean) as string[];

      return {
        source: 'FALLBACK',
        agents: mappedAgents,
        workspaces: Array.from(new Set(workspaces))
      };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return { source: 'ERROR', error: { code: 'CONFIG_NOT_FOUND', message: 'Config file not found' } };
      }
      return { source: 'ERROR', error: { code: 'CONFIG_PARSE_FAILED', message: 'Failed to parse config file' } };
    }
  }

  private async executeGatewayCommand<T>(method: string, params: any = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(env.OPENCLAW_GATEWAY_URL);
      
      let challengeReceived = false;
      let helloOkReceived = false;
      const timeoutId = setTimeout(() => {
        ws.close();
        reject({ code: 'GATEWAY_TIMEOUT', message: 'Gateway connection timed out' });
      }, 5000);

      ws.on('error', (err: any) => {
        clearTimeout(timeoutId);
        reject({ code: 'GATEWAY_UNAVAILABLE', message: err.message });
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          
          if (msg.type === 'event' && msg.event === 'connect.challenge') {
            challengeReceived = true;
            const nonce = msg.payload.nonce;
            const ts = Date.now();
            
            // Dummy keypair for device signature matching protocol format
            const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
            const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
            // The server derives deviceId from PEM by removing header/footer and hashing
            // But we can just use the server's derive logic or send PEM.
            // Wait, deriveDeviceIdFromPublicKey on server handles PEM strings too.
            // Let's just hash the SPKI DER directly for deviceId because derivePublicKeyRaw extracts the DER from PEM.
            const derBuffer = publicKey.export({ type: 'spki', format: 'der' });
            const deviceId = crypto.createHash('sha256').update(derBuffer.subarray(12)).digest('hex');

            const payloadV2 = [
              'v2',
              deviceId,
              'cli',
              'cli',
              'operator',
              'operator.read',
              String(ts),
              env.OPENCLAW_GATEWAY_TOKEN,
              nonce
            ].join('|');

            const signature = crypto.sign(null, Buffer.from(payloadV2, 'utf8'), privateKey).toString('base64');

            ws.send(JSON.stringify({
              type: 'req',
              id: 'req_connect',
              method: 'connect',
              params: {
                minProtocol: 1,
                maxProtocol: 10,
                client: { id: 'cli', version: '1.0.0', platform: os.platform(), mode: 'cli' },
                role: 'operator',
                scopes: ['operator.read'],
                caps: [],
                commands: [],
                permissions: {},
                auth: { token: env.OPENCLAW_GATEWAY_TOKEN },
                locale: 'en-US',
                userAgent: 'lastclaw-server/1.0.0',
                device: {
                  id: deviceId,
                  publicKey: publicKeyPem,
                  signature,
                  signedAt: ts,
                  nonce
                }
              }
            }));
          } else if (msg.type === 'res' && msg.id === 'req_connect') {
            if (msg.ok && msg.payload && msg.payload.type === 'hello-ok') {
              helloOkReceived = true;
              
              if (method === 'health') {
                 // The hello-ok might contain status, or we might need to send a health request.
                 // The prompt specifies to establish handshake, then return health/state.
                 ws.send(JSON.stringify({ type: 'req', id: 'req_target', method: 'health', params }));
              } else {
                 ws.send(JSON.stringify({ type: 'req', id: 'req_target', method, params }));
              }
            } else {
              clearTimeout(timeoutId);
              ws.close();
              reject({ code: 'GATEWAY_AUTH_FAILED', message: msg.error?.message || 'Handshake failed' });
            }
          } else if (msg.type === 'res' && msg.id === 'req_target') {
            clearTimeout(timeoutId);
            ws.close();
            if (msg.ok) {
              resolve(msg.payload);
            } else {
              reject({ code: 'GATEWAY_PROTOCOL_ERROR', message: msg.error?.message || 'Request failed' });
            }
          }
        } catch (err: any) {
          console.error('WS MESSAGE ERROR:', err.stack);
          clearTimeout(timeoutId);
          ws.close();
          reject({ code: 'GATEWAY_PROTOCOL_ERROR', message: 'Malformed JSON from gateway' });
        }
      });
    });
  }

  async discoverRuntime(): Promise<void> {
    // No-op for now
  }

  async getHealth(): Promise<LastClawResponse<GatewayHealth | null>> {
    const observedAt = new Date().toISOString();
    try {
      const startTime = Date.now();
      const payload = await this.executeGatewayCommand<any>('health');
      const durationMs = Date.now() - startTime;
      
      const health: GatewayHealth = {
        ok: payload?.ok ?? true,
        ts: payload?.ts ?? Date.now(),
        durationMs,
        status: payload?.status
      };
      
      await this.writeCacheAtomically('health', health);

      return {
        data: health,
        source: 'LIVE',
        observedAt,
        stale: false,
      };
    } catch (err: any) {
      console.error('getHealth error:', err);
      const cached = await this.readCache('health');
      if (cached) {
        return {
          data: cached.data,
          source: 'CACHED',
          observedAt: cached.observedAt,
          stale: true,
          error: { code: err.code, message: err.message }
        };
      }

      return {
        data: null,
        source: 'ERROR',
        observedAt,
        stale: false,
        error: { code: err.code || 'UNKNOWN', message: err.message || 'Failed to get health' }
      };
    }
  }

  async listAgents(): Promise<LastClawResponse<RuntimeAgent[]>> {
    const observedAt = new Date().toISOString();
    try {
      const payload = await this.executeGatewayCommand<any>('agents.list');
      let agents: RuntimeAgent[] = [];
      if (Array.isArray(payload)) {
        agents = this.mapToCanonicalAgents(payload);
      } else if (payload && payload.agents) {
        agents = this.mapToCanonicalAgents(payload.agents);
      }
      
      if (agents.length === 0) {
        return { data: [], source: 'EMPTY', observedAt, stale: false };
      }

      await this.writeCacheAtomically('agents', agents);
      
      return {
        data: agents,
        source: 'LIVE',
        observedAt,
        stale: false,
      };
    } catch (err: any) {
      // Fallback logic
      const fallback = await this.readFallbackConfig();
      if (fallback.source === 'FALLBACK') {
        return {
          data: fallback.agents || [],
          source: 'FALLBACK',
          observedAt,
          stale: false,
          error: { code: err.code, message: err.message }
        };
      }

      const cached = await this.readCache('agents');
      if (cached) {
        return {
          data: cached.data,
          source: 'CACHED',
          observedAt: cached.observedAt,
          stale: true,
          error: { code: err.code, message: err.message }
        };
      }

      return {
        data: [],
        source: fallback.source,
        observedAt,
        stale: false,
        error: fallback.error || { code: err.code, message: err.message }
      };
    }
  }

  async listWorkspaces(): Promise<LastClawResponse<string[]>> {
    const agentsRes = await this.listAgents();
    const workspaces = Array.from(new Set(agentsRes.data.map(a => a.workspace).filter(Boolean) as string[]));
    return {
      ...agentsRes,
      data: workspaces,
    };
  }
}
