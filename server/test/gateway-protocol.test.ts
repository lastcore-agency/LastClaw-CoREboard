import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketServer } from 'ws';
import { OpenClawAdapter } from '../../server/runtime/OpenClawAdapter.js';

describe('Gateway Protocol', () => {
  let wss: WebSocketServer;
  let adapter: OpenClawAdapter;
  const PORT = 18795;

  beforeEach(() => {
    process.env.OPENCLAW_GATEWAY_URL = `ws://127.0.0.1:${PORT}`;
    process.env.LASTCLAW_HOME = '/tmp/lastclaw-test-' + Date.now();
    adapter = new OpenClawAdapter();
  });

  afterEach(() => {
    if (wss) {
      wss.close();
    }
  });

  it('completes handshake and returns health', async () => {
    wss = new WebSocketServer({ port: PORT });
    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'event', event: 'connect.challenge', payload: { nonce: 'test-nonce' } }));
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'req' && msg.method === 'connect') {
          expect(msg.params.device.nonce).toBe('test-nonce');
          expect(msg.params.device.signature).toBeDefined();
          ws.send(JSON.stringify({ type: 'res', id: msg.id, ok: true, payload: { type: 'hello-ok' } }));
        } else if (msg.type === 'req' && msg.method === 'health') {
          ws.send(JSON.stringify({ type: 'res', id: msg.id, ok: true, payload: { ok: true, ts: 12345 } }));
        }
      });
    });

    const result = await adapter.getHealth();
    expect(result.source).toBe('LIVE');
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBe(12345);
  });

  it('handles gateway auth failure', async () => {
    wss = new WebSocketServer({ port: PORT });
    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'event', event: 'connect.challenge', payload: { nonce: 'test-nonce' } }));
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'req' && msg.method === 'connect') {
          ws.send(JSON.stringify({ type: 'res', id: msg.id, ok: false, error: { message: 'Invalid token' } }));
        }
      });
    });

    const result = await adapter.getHealth();
    expect(result.source).toBe('ERROR');
    expect(result.error?.code).toBe('GATEWAY_AUTH_FAILED');
  });

  it('handles gateway protocol errors', async () => {
    wss = new WebSocketServer({ port: PORT });
    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'event', event: 'connect.challenge', payload: { nonce: 'test-nonce' } }));
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'req' && msg.method === 'connect') {
          ws.send(JSON.stringify({ type: 'res', id: msg.id, ok: true, payload: { type: 'hello-ok' } }));
        } else if (msg.type === 'req' && msg.method === 'health') {
          ws.send(JSON.stringify({ type: 'res', id: msg.id, ok: false, error: { message: 'Internal error' } }));
        }
      });
    });

    const result = await adapter.getHealth();
    expect(result.source).toBe('ERROR');
    expect(result.error?.code).toBe('GATEWAY_PROTOCOL_ERROR');
  });

  it('handles gateway unavailable', async () => {
    // Intentionally not starting the server
    process.env.OPENCLAW_GATEWAY_URL = 'ws://127.0.0.1:18791'; 
    const result = await adapter.getHealth();
    expect(result.source).toBe('ERROR');
    expect(result.error?.code).toBe('GATEWAY_UNAVAILABLE');
  });
});
