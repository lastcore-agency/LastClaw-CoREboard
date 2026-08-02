/* ────────────────────────────────────────────────────────────
   GatewayClient — persistent WebSocket to OpenClaw Gateway
   Protocol v3, auto-reconnect, request/response correlation,
   heartbeat, event forwarding to GatewayEventBus.
   ──────────────────────────────────────────────────────────── */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
  GATEWAY_PROTOCOL_VERSION,
  nextRequestId,
  type GatewayRequest,
  type GatewayResponse,
  type GatewayEvent,
  type GatewayFrame,
  type GatewayMethodName,
  type GatewayMethodMap,
  type ConnectChallengePayload,
  type HelloOkPayload,
  type HealthPayload,
  buildRequest,
  isGatewayFrame,
} from './GatewayProtocol.js';
import {
  type GatewayError,
  type GatewayErrorCode,
  classifyWsClose,
  classifyError,
  gatewayError,
} from './GatewayErrors.js';
import { GatewayEventBus, type NormalizedEvent } from './GatewayEvents.js';
import { getOrCreateDeviceIdentity, signNonce, type DeviceIdentity } from './GatewayIdentity.js';

export interface GatewayClientOptions {
  url: string;
  token: string;
  lastclawHome: string;
  /** Auto-reconnect delay in ms (default 3000) */
  reconnectDelay?: number;
  /** Request timeout in ms (default 15000) */
  requestTimeout?: number;
  /** Max reconnect attempts before emitting 'gave-up' (0 = infinite) */
  maxReconnectAttempts?: number;
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: GatewayError) => void;
  timer: ReturnType<typeof setTimeout>;
};

type ClientState = 'idle' | 'connecting' | 'handshake' | 'connected' | 'reconnecting' | 'closed';

export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: ClientState = 'idle';
  private opts: Required<GatewayClientOptions>;
  private identity: DeviceIdentity;
  private pending = new Map<string, PendingRequest>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private lastError: GatewayError | null = null;

  /** Public event bus — events emitted here are normalized and buffered */
  readonly events: GatewayEventBus;

  constructor(opts: GatewayClientOptions) {
    super();
    this.opts = {
      reconnectDelay: 3000,
      requestTimeout: 15_000,
      maxReconnectAttempts: 0,
      ...opts,
    };
    this.identity = getOrCreateDeviceIdentity(this.opts.lastclawHome);
    this.events = new GatewayEventBus(500);
  }

  // ── Public API ──────────────────────────────────────────────

  get connected(): boolean {
    return this.state === 'connected';
  }

  get connectionState(): ClientState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') return;
    this.state = 'connecting';
    this.emit('state-change', this.state);
    this.openSocket();
  }

  /** Wait for the client to reach 'connected' state */
  waitForConnected(timeoutMs = 10_000): Promise<void> {
    if (this.state === 'connected') return Promise.resolve();
    if (this.state === 'closed') {
      return Promise.reject(this.lastError || gatewayError('GATEWAY_DISCONNECTED', 'Connection closed'));
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('state-change', onState);
        reject(this.lastError || gatewayError('GATEWAY_TIMEOUT', 'Connection timed out'));
      }, timeoutMs);

      const onState = (state: ClientState) => {
        if (state === 'connected') {
          clearTimeout(timer);
          this.removeListener('state-change', onState);
          resolve();
        } else if (state === 'closed') {
          clearTimeout(timer);
          this.removeListener('state-change', onState);
          reject(this.lastError || gatewayError('GATEWAY_DISCONNECTED', 'Connection closed'));
        }
      };

      this.on('state-change', onState);
    });
  }

  async close(): Promise<void> {
    this.state = 'closed';
    this.emit('state-change', this.state);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.rejectAllPending('GATEWAY_DISCONNECTED', 'Client shutting down');
    if (this.ws) {
      this.ws.close(1000, 'Client shutdown');
      this.ws = null;
    }
  }

  /** Send a typed request and wait for correlated response */
  async request<M extends GatewayMethodName>(
    method: M,
    params?: GatewayMethodMap[M]['params'],
  ): Promise<GatewayMethodMap[M]['result']> {
    // Auto-connect if idle
    if (this.state === 'idle') {
      await this.connect();
    }

    // Wait for connection to be established (up to 10s)
    if (this.state !== 'connected') {
      await this.waitForConnected(10_000);
    }

    if (this.state !== 'connected') {
      throw gatewayError('GATEWAY_NOT_CONNECTED', `Cannot send ${method}: state=${this.state}`);
    }

    const req = buildRequest(method, params);

    return new Promise<GatewayMethodMap[M]['result']>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(req.id);
        reject(gatewayError('GATEWAY_TIMEOUT', `Request ${method} timed out`));
      }, this.opts.requestTimeout);

      this.pending.set(req.id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      this.sendFrame(req);
    });
  }

  // ── Internals ───────────────────────────────────────────────

  private openSocket(): void {
    try {
      this.ws = new WebSocket(this.opts.url, {
        handshakeTimeout: 10_000,
      });
    } catch (err) {
      this.handleError(classifyError(err));
      return;
    }

    this.ws.on('open', () => {
      this.reconnectAttempt = 0;
      this.state = 'handshake';
      this.emit('state-change', this.state);
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.handleClose(code, reason.toString());
    });

    this.ws.on('error', (err: Error) => {
      this.handleError(classifyError(err));
    });

    this.ws.on('pong', () => {
      // WebSocket pong received — connection alive
    });
  }

  private handleMessage(data: WebSocket.Data): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      this.handleError(gatewayError('GATEWAY_PROTOCOL_ERROR', 'Non-JSON frame'));
      return;
    }

    if (!isGatewayFrame(parsed)) {
      this.handleError(gatewayError('GATEWAY_PROTOCOL_ERROR', 'Unknown frame type'));
      return;
    }

    const frame = parsed as GatewayFrame;

    switch (frame.type) {
      case 'event':
        this.handleEventFrame(frame);
        break;
      case 'res':
        this.handleResponseFrame(frame);
        break;
      case 'req':
        // Server-initiated request — we don't expect these in v3
        break;
    }
  }

  private handleEventFrame(frame: GatewayEvent): void {
    if (frame.event === 'connect.challenge') {
      this.handleChallenge(frame.payload as ConnectChallengePayload);
      return;
    }

    if (frame.event === 'tick') {
      this.lastTick = Date.now();
      this.events.emitFrame(frame);
      return;
    }

    // Forward all other events to the event bus
    this.events.emitFrame(frame);
    this.emit('event', frame);
  }

  private async handleChallenge(payload: ConnectChallengePayload): Promise<void> {
    if (!payload?.nonce) {
      this.handleError(gatewayError('GATEWAY_PROTOCOL_ERROR', 'Challenge missing nonce'));
      return;
    }

    const signature = signNonce(this.identity, payload.nonce);

    const connectReq: GatewayRequest = {
      type: 'req',
      id: nextRequestId(),
      method: 'connect',
      params: {
        minProtocol: GATEWAY_PROTOCOL_VERSION,
        maxProtocol: GATEWAY_PROTOCOL_VERSION,
        auth: { kind: 'token', token: this.opts.token },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        device: {
          nonce: payload.nonce,
          signature,
        },
      },
    };

    this.sendFrame(connectReq);

    // Wait for hello-ok/hello-error in the response handler
  }

  private handleResponseFrame(frame: GatewayResponse): void {
    // Special: hello-ok/hello-error comes as response to our connect request
    const payload = frame.payload as HelloOkPayload | undefined;

    if (payload && typeof payload === 'object' && 'type' in payload) {
      if (payload.type === 'hello-ok') {
        this.state = 'connected';
        this.emit('state-change', this.state);
        this.emit('connected', {
          serverVersion: (payload as HelloOkPayload).serverVersion,
          protocol: (payload as HelloOkPayload).protocol,
        });
        this.startHeartbeat();
        return;
      }
      if (payload.type === 'hello-error') {
        const msg = (payload as { message?: string }).message || 'Auth failed';
        this.handleError(gatewayError('GATEWAY_AUTH_FAILED', msg));
        return;
      }
    }

    // If we're in handshake and the response is not hello-ok, treat as auth failure
    if (this.state === 'handshake' && !frame.ok) {
      this.handleError(gatewayError('GATEWAY_AUTH_FAILED', frame.error?.message || 'Connect rejected'));
      return;
    }

    // Regular request/response correlation
    const pending = this.pending.get(frame.id);
    if (pending) {
      this.pending.delete(frame.id);
      clearTimeout(pending.timer);
      if (frame.ok) {
        pending.resolve(frame.payload);
      } else {
        pending.reject(gatewayError(
          'GATEWAY_REQUEST_FAILED',
          frame.error?.message || 'Request failed',
          false,
        ));
      }
    }
  }

  private handleClose(code: number, reason: string): void {
    this.ws = null;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.rejectAllPending('GATEWAY_DISCONNECTED', 'WebSocket closed');

    const err = classifyWsClose(code, reason);
    this.emit('disconnected', err);

    if (this.state !== 'closed') {
      this.scheduleReconnect();
    }
  }

  private handleError(err: GatewayError): void {
    this.lastError = err;
    this.emit('error', err);

    if (this.state === 'handshake' || this.state === 'connecting') {
      if (err.code === 'GATEWAY_AUTH_FAILED' || err.code === 'GATEWAY_UNAVAILABLE' || err.code === 'GATEWAY_PROTOCOL_ERROR') {
        this.state = 'closed';
        this.emit('state-change', this.state);
        return;
      }
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.state = 'reconnecting';
    this.emit('state-change', this.state);

    if (this.opts.maxReconnectAttempts > 0 && this.reconnectAttempt >= this.opts.maxReconnectAttempts) {
      this.state = 'closed';
      this.emit('state-change', this.state);
      this.emit('gave-up', gatewayError('GATEWAY_DISCONNECTED', `Max reconnect attempts (${this.opts.maxReconnectAttempts}) exceeded`));
      return;
    }

    const jitter = Math.random() * 1000;
    const delay = this.opts.reconnectDelay * Math.min(this.reconnectAttempt + 1, 10) + jitter;
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.ws.ping();
      // If we haven't received a tick in 45s, consider stale
      if (this.lastTick > 0 && Date.now() - this.lastTick > 45_000) {
        this.ws.terminate();
      }
    }, 30_000);
  }

  private sendFrame(frame: GatewayFrame | GatewayRequest): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(frame));
  }

  private rejectAllPending(code: GatewayErrorCode, message: string): void {
    const err = gatewayError(code, message);
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pending.clear();
  }
}
