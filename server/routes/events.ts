/* ────────────────────────────────────────────────────────────
   Event Stream — SSE endpoint for Visual Office events
   Normalizes Gateway events for browser consumption
   ──────────────────────────────────────────────────────────── */

import express from 'express';

export const eventStreamRouter = express.Router();

interface NormalizedEvent {
  id: string;
  timestamp: string;
  type: string;
  agentId: string;
  targetAgentId?: string;
  sessionId?: string;
  text?: string;
  source: 'LIVE' | 'MOCK';
}

type SSEClient = {
  id: string;
  res: express.Response;
};

const clients: Map<string, SSEClient> = new Map();
let clientCounter = 0;

/** Broadcast a normalized event to all connected SSE clients */
export function broadcastEvent(event: NormalizedEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const [, client] of clients) {
    try {
      client.res.write(payload);
    } catch {
      // Client disconnected
    }
  }
}

/** Clean up disconnected clients */
function cleanupClient(id: string): void {
  clients.delete(id);
}

// SSE endpoint
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

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`:heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
      cleanupClient(clientId);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    cleanupClient(clientId);
  });
});

// Manual event injection endpoint (for testing)
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
  broadcastEvent(event);
  res.json({ ok: true, event });
});
