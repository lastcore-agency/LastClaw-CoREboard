/* ────────────────────────────────────────────────────────────
   Event Stream — SSE endpoint for Visual Office events
   Bridges Gateway events → browser via SSE
   ──────────────────────────────────────────────────────────── */

import express from 'express';
import { getGatewayClient } from '../runtime/OpenClawAdapter.js';
import type { NormalizedEvent } from '../runtime/gateway/GatewayEvents.js';

export const eventStreamRouter = express.Router();

type SSEClient = {
  id: string;
  res: express.Response;
};

const clients: Map<string, SSEClient> = new Map();
let clientCounter = 0;
let gatewayBridgeActive = false;

/** Broadcast a normalized event to all connected SSE clients */
function broadcastToClients(event: NormalizedEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const [, client] of clients) {
    try {
      client.res.write(payload);
    } catch {
      // Client disconnected — will be cleaned up on 'close'
    }
  }
}

/** Set up the Gateway→SSE bridge (called once) */
function ensureGatewayBridge(): void {
  if (gatewayBridgeActive) return;
  gatewayBridgeActive = true;

  try {
    const client = getGatewayClient();

    // Subscribe to all events from the Gateway
    client.events.on('*', (event: NormalizedEvent) => {
      // Only forward to SSE clients if we have any
      if (clients.size > 0) {
        // Redact sensitive content from text fields
        const redacted: NormalizedEvent = {
          ...event,
          text: redactSensitive(event.text),
          raw: undefined, // never forward raw payload to browser
        };
        broadcastToClients(redacted);
      }
    });

    // Also re-emit client state changes as events
    client.on('connected', () => {
      broadcastToClients({
        id: `evt-gw-connect-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'gateway.connected',
        agentId: '',
        source: 'LIVE',
      });
    });

    client.on('disconnected', () => {
      broadcastToClients({
        id: `evt-gw-disconnect-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'gateway.disconnected',
        agentId: '',
        source: 'LIVE',
      });
    });

    console.log('[EventBridge] Gateway→SSE bridge active');
  } catch (err) {
    console.error('[EventBridge] Failed to set up bridge:', err);
  }
}

/** Redact tokens, keys, secrets from text */
function redactSensitive(text: string | undefined): string | undefined {
  if (!text) return text;
  return text
    .replace(/token["\s:=]+\S+/gi, 'token=[REDACTED]')
    .replace(/key["\s:=]+\S+/gi, 'key=[REDACTED]')
    .replace(/secret["\s:=]+\S+/gi, 'secret=[REDACTED]')
    .replace(/password["\s:=]+\S+/gi, 'password=[REDACTED]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
}

/** Clean up disconnected clients */
function cleanupClient(id: string): void {
  clients.delete(id);
}

// ── SSE endpoint ─────────────────────────────────────────────
eventStreamRouter.get('/events', (req, res) => {
  const clientId = `sse-${++clientCounter}`;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    id: `evt-connect-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'stream.connected',
    agentId: '',
    source: 'LIVE',
  })}\n\n`);

  clients.set(clientId, { id: clientId, res });

  // Set up the bridge on first SSE client
  ensureGatewayBridge();

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`:heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
      cleanupClient(clientId);
    }
  }, 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    cleanupClient(clientId);
  });
});

// ── Manual event injection (TESTING ONLY, disabled in production) ────
if (process.env.NODE_ENV !== 'production') {
  eventStreamRouter.post('/events/inject', express.json(), (req, res) => {
    const event: NormalizedEvent = {
      id: `evt-inject-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type: req.body.type || 'message.started',
      agentId: req.body.agentId || 'sirius',
      targetAgentId: req.body.targetAgentId,
      text: req.body.text || 'Hello from injected event',
      source: 'LIVE',
    };
    broadcastToClients(event);
    res.json({ ok: true, event });
  });
}
