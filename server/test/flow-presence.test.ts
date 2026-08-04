import { describe, expect, it } from 'vitest';
import { mockAgents } from '../../src/data/mockAgents.js';
import { applyFlowPresence, type FlowPresence } from '../../src/lib/useFlowPresence.js';

function flow(patch: Partial<FlowPresence>): FlowPresence {
  return {
    flowId: 'flow-demo',
    runId: 'LASTNEWS-DEMO',
    dbStatus: 'running',
    status: 'RUNNING',
    phase: 'running',
    activeAgent: 'polaris',
    currentStep: 'POLARIS_OPEN',
    completedSteps: [],
    failedStep: null,
    updatedAt: new Date().toISOString(),
    ...patch,
  };
}

describe('real flow presence projection', () => {
  it('clears operational placeholders when no flow exists', () => {
    const agents = applyFlowPresence(mockAgents, null);
    expect(agents.every((agent) => agent.status === 'unknown')).toBe(true);
    expect(agents.every((agent) => agent.currentTask === '' && agent.progress === 0)).toBe(true);
  });

  it('marks only the active runtime Agent as working', () => {
    const agents = applyFlowPresence(mockAgents, flow({
      activeAgent: 'draco',
      currentStep: 'DRACO_STORYBOARD',
      completedSteps: ['POLARIS_OPEN', 'DRACO_RESEARCH_BRIEF', 'SIRIUS_DIRECTION_APPROVAL'],
    }));
    const draco = agents.find((agent) => agent.id === 'draco');
    expect(draco?.status).toBe('working');
    expect(draco?.source).toBe('REAL');
    expect(draco?.currentTask).toBe('DRACO_STORYBOARD');
    expect(agents.filter((agent) => agent.status === 'working')).toHaveLength(1);
  });

  it('projects READY_FOR_PUBLISH as a real approval wait', () => {
    const agents = applyFlowPresence(mockAgents, flow({
      dbStatus: 'succeeded',
      status: 'READY_FOR_PUBLISH',
      phase: 'waiting_approval',
      activeAgent: null,
      currentStep: 'READY_FOR_PUBLISH',
      completedSteps: Array(9).fill('complete'),
    }));
    const sirius = agents.find((agent) => agent.id === 'sirius');
    expect(sirius?.status).toBe('waiting');
    expect(sirius?.progress).toBe(100);
    expect(sirius?.source).toBe('REAL');
  });
});
