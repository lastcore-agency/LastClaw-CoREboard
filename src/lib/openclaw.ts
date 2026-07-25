/* ────────────────────────────────────────────────────────────
   OpenClaw client library
   Currently using mock data — will connect to real Gateway later
   ──────────────────────────────────────────────────────────── */

import { mockAgents, mockGateway } from '../data/mockAgents';
import type { Agent, GatewaySnapshot } from '../types';

const apiBase = import.meta.env.VITE_OPENCLAW_API_BASE || 'http://localhost:3001';
const useMock = String(import.meta.env.VITE_USE_MOCK || 'true') === 'true';

function wait(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAgents(): Promise<Agent[]> {
  if (useMock) {
    await wait();
    return structuredClone(mockAgents);
  }

  const response = await fetch(`${apiBase}/agents`);
  if (!response.ok) throw new Error('Failed to fetch agents');
  return response.json();
}

export async function fetchGateway(): Promise<GatewaySnapshot> {
  if (useMock) {
    await wait();
    return structuredClone(mockGateway);
  }

  const response = await fetch(`${apiBase}/gateway`);
  if (!response.ok) throw new Error('Failed to fetch gateway snapshot');
  return response.json();
}

export async function updateAgentConfig(agentId: string, patch: Partial<Agent>): Promise<Agent> {
  if (useMock) {
    await wait();
    const existing = mockAgents.find((item) => item.id === agentId);
    if (!existing) throw new Error('Agent not found');
    return { ...structuredClone(existing), ...patch };
  }

  const response = await fetch(`${apiBase}/agents/${agentId}/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

  if (!response.ok) throw new Error('Failed to update agent config');
  return response.json();
}

export async function restartAgent(agentId: string): Promise<void> {
  if (useMock) {
    await wait();
    return;
  }

  const response = await fetch(`${apiBase}/agents/${agentId}/runtime/restart`, {
    method: 'POST',
  });

  if (!response.ok) throw new Error('Failed to restart agent');
}

export async function pauseAgent(agentId: string): Promise<void> {
  if (useMock) {
    await wait();
    return;
  }

  const response = await fetch(`${apiBase}/agents/${agentId}/runtime/pause`, {
    method: 'POST',
  });

  if (!response.ok) throw new Error('Failed to pause agent');
}
