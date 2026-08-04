import { useEffect, useState } from 'react';
import type { Agent } from '../types';

const FLOW_STEPS = [
  'POLARIS_OPEN',
  'DRACO_RESEARCH_BRIEF',
  'SIRIUS_DIRECTION_APPROVAL',
  'DRACO_STORYBOARD',
  'ANTARES_PRODUCTION',
  'ALTAIR_GROWTH_PACKAGE',
  'SIRIUS_FINAL_REVIEW',
  'CAPELLA_PACKAGE',
  'POLARIS_CLOSE',
] as const;

export interface FlowPresence {
  flowId: string;
  runId: string | null;
  dbStatus: string;
  status: string;
  phase: string;
  activeAgent: string | null;
  currentStep: string | null;
  completedSteps: string[];
  failedStep: string | null;
  updatedAt: string | null;
}

function canonicalAgentId(runtimeId: string | null): string | null {
  if (runtimeId === 'main') return 'sirius';
  return runtimeId;
}

function agentForStep(step: string | null): string | null {
  if (!step) return null;
  if (step.startsWith('POLARIS_')) return 'polaris';
  if (step.startsWith('DRACO_')) return 'draco';
  if (step.startsWith('SIRIUS_')) return 'sirius';
  if (step.startsWith('ANTARES_')) return 'antares';
  if (step.startsWith('ALTAIR_')) return 'altair';
  if (step.startsWith('CAPELLA_')) return 'capella';
  return null;
}

export function applyFlowPresence(agents: Agent[], flow: FlowPresence | null): Agent[] {
  const cleared = agents.map((agent) => ({
    ...agent,
    status: 'unknown' as const,
    currentTask: '',
    progress: 0,
    bubble: '',
  }));
  if (!flow) return cleared;

  const progress = Math.round((flow.completedSteps.length / FLOW_STEPS.length) * 100);
  const activeAgent = canonicalAgentId(flow.activeAgent) ?? agentForStep(flow.currentStep);
  if (flow.phase === 'running' && activeAgent) {
    return cleared.map((agent) => agent.id === activeAgent ? {
      ...agent,
      status: 'working',
      currentTask: flow.currentStep ?? 'Working',
      progress,
      bubble: `${flow.currentStep ?? 'TASK'} — กำลังทำงาน`,
      source: 'REAL',
    } : agent);
  }

  if (flow.phase === 'waiting_approval') {
    return cleared.map((agent) => agent.id === 'sirius' ? {
      ...agent,
      status: 'waiting',
      currentTask: 'READY_FOR_PUBLISH — รอ Last Boss อนุมัติ',
      progress: 100,
      bubble: 'งานพร้อมแล้ว รออนุมัติ',
      source: 'REAL',
    } : agent);
  }

  if (flow.phase === 'blocked') {
    const blockedAgent = agentForStep(flow.failedStep ?? flow.currentStep);
    return cleared.map((agent) => agent.id === blockedAgent ? {
      ...agent,
      status: 'error',
      currentTask: `${flow.failedStep ?? flow.currentStep ?? 'FLOW'} — BLOCKED`,
      progress,
      bubble: 'งานติดขัด ต้องตรวจสอบ',
      source: 'REAL',
    } : agent);
  }

  return cleared;
}

export function useFlowPresence(enabled: boolean) {
  const [flow, setFlow] = useState<FlowPresence | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const baseUrl = import.meta.env.VITE_OPENCLAW_API_BASE || '/api/runtime';

    async function refresh() {
      try {
        const response = await fetch(`${baseUrl}/flows/current`, { cache: 'no-store' });
        const json = await response.json();
        if (alive) setFlow(response.ok && json.source === 'REAL' ? json.data : null);
      } catch {
        if (alive) setFlow(null);
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, 2_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return flow;
}
