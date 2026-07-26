import express from 'express';
import { OpenClawAdapter } from '../runtime/OpenClawAdapter.js';

export const runtimeRouter = express.Router();
const adapter = new OpenClawAdapter();

runtimeRouter.get('/health', async (req, res) => {
  const result = await adapter.getHealth();
  res.json(result);
});

runtimeRouter.get('/agents', async (req, res) => {
  const result = await adapter.listAgents();
  res.json(result);
});

runtimeRouter.get('/workspaces', async (req, res) => {
  const result = await adapter.listWorkspaces();
  res.json(result);
});
