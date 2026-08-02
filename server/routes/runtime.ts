import express from 'express';
import { OpenClawAdapter } from '../runtime/OpenClawAdapter.js';

export const runtimeRouter = express.Router();
const adapter = new OpenClawAdapter();

// ── Health ───────────────────────────────────────────────────
runtimeRouter.get('/health', async (req, res) => {
  const result = await adapter.getHealth();
  res.json(result);
});

// ── Agents ───────────────────────────────────────────────────
runtimeRouter.get('/agents', async (req, res) => {
  const result = await adapter.listAgents();
  res.json(result);
});

// ── Workspaces ───────────────────────────────────────────────
runtimeRouter.get('/workspaces', async (req, res) => {
  const result = await adapter.listWorkspaces();
  res.json(result);
});

// ── Sessions ─────────────────────────────────────────────────
runtimeRouter.get('/sessions', async (req, res) => {
  const agentId = req.query.agentId as string | undefined;
  const result = await adapter.listSessions(agentId);
  res.json(result);
});

runtimeRouter.post('/sessions', express.json(), async (req, res) => {
  const { channel, agentId } = req.body || {};
  const result = await adapter.createSession(channel, agentId);
  res.json(result);
});

runtimeRouter.post('/sessions/:sessionKey/send', express.json(), async (req, res) => {
  const { sessionKey } = req.params;
  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' });
    return;
  }
  const result = await adapter.sendMessage(sessionKey, message);
  res.json(result);
});

runtimeRouter.post('/sessions/:sessionId/close', async (req, res) => {
  const { sessionId } = req.params;
  const result = await adapter.closeSession(sessionId);
  res.json(result);
});

// ── Chat ─────────────────────────────────────────────────────
runtimeRouter.post('/chat', express.json(), async (req, res) => {
  const { message, sessionKey, agentId } = req.body || {};
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' });
    return;
  }
  if (!sessionKey || typeof sessionKey !== 'string') {
    res.status(400).json({ error: 'sessionKey is required' });
    return;
  }
  const result = await adapter.sendChat(message, sessionKey, agentId);
  res.json(result);
});

runtimeRouter.get('/chat/:sessionId/history', async (req, res) => {
  const { sessionId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const result = await adapter.chatHistory(sessionId, limit);
  res.json(result);
});

// ── Files ────────────────────────────────────────────────────
runtimeRouter.get('/files', async (req, res) => {
  const workspace = req.query.workspace as string;
  const filePath = req.query.path as string | undefined;
  if (!workspace) {
    res.status(400).json({ error: 'workspace is required' });
    return;
  }
  const result = await adapter.listFiles(workspace, filePath);
  res.json(result);
});

runtimeRouter.get('/files/read', async (req, res) => {
  const workspace = req.query.workspace as string;
  const filePath = req.query.path as string;
  if (!workspace || !filePath) {
    res.status(400).json({ error: 'workspace and path are required' });
    return;
  }
  const result = await adapter.readFile(workspace, filePath);
  res.json(result);
});

// ── Logs ─────────────────────────────────────────────────────
runtimeRouter.get('/logs', async (req, res) => {
  const agentId = req.query.agentId as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const level = req.query.level as string | undefined;
  const result = await adapter.getLogs(agentId, limit, level);
  res.json(result);
});
