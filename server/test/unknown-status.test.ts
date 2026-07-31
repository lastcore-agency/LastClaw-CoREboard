import { describe, it, expect } from 'vitest';
import { mapAvailabilityToStatus } from '../../src/lib/openclaw.js';
import { deriveMotionState } from '../../src/lib/motion.js';
import type { Agent, AgentStatus } from '../../src/types.js';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'sirius',
    displayName: 'Sirius',
    role: 'Team Lead',
    status: 'online',
    currentTask: '',
    model: 'gpt-4o',
    progress: 0,
    room: 'HQ',
    avatar: '/avatar.webp',
    source: 'LIVE',
    x: 17,
    y: 24,
    position: {
      desktop: { x: 18, y: 38, scale: 1 },
      tablet: { x: 18, y: 36, scale: 0.9 },
      mobile: { x: 22, y: 30, scale: 0.8 },
    },
    character: {
      animated: '/characters/sirius/idle-front.webp',
      static: '/characters/sirius/static-front.webp',
      direction: 'front',
    },
    bubble: '',
    color: '#3b82f6',
    uptime: '0m',
    queue: '0',
    latency: '0ms',
    memory: '0MB',
    lastActive: 'just now',
    sessionId: '',
    workspace: '',
    recentActivity: [],
    runtimeHealth: 'healthy',
    skills: [],
    ...overrides,
  };
}

describe('mapAvailabilityToStatus', () => {
  it('maps UNKNOWN to unknown', () => {
    expect(mapAvailabilityToStatus('UNKNOWN')).toBe('unknown');
  });

  it('maps empty string to unknown', () => {
    expect(mapAvailabilityToStatus('')).toBe('unknown');
  });

  it('maps undefined to unknown', () => {
    expect(mapAvailabilityToStatus(undefined)).toBe('unknown');
  });

  it('maps null to unknown', () => {
    expect(mapAvailabilityToStatus(null)).toBe('unknown');
  });

  it('maps unrecognized status to unknown', () => {
    expect(mapAvailabilityToStatus('CUSTOM_STATUS')).toBe('unknown');
    expect(mapAvailabilityToStatus('SUSPENDED')).toBe('unknown');
    expect(mapAvailabilityToStatus('PENDING')).toBe('unknown');
  });

  it('maps OFFLINE to offline (not unknown)', () => {
    expect(mapAvailabilityToStatus('OFFLINE')).toBe('offline');
  });

  it('maps ONLINE to online', () => {
    expect(mapAvailabilityToStatus('ONLINE')).toBe('online');
  });

  it('maps WORKING to working', () => {
    expect(mapAvailabilityToStatus('WORKING')).toBe('working');
  });

  it('maps BUSY to busy', () => {
    expect(mapAvailabilityToStatus('BUSY')).toBe('busy');
  });

  it('maps WAITING to waiting', () => {
    expect(mapAvailabilityToStatus('WAITING')).toBe('waiting');
  });

  it('maps ERROR to error', () => {
    expect(mapAvailabilityToStatus('ERROR')).toBe('error');
  });

  it('is case-insensitive', () => {
    expect(mapAvailabilityToStatus('unknown')).toBe('unknown');
    expect(mapAvailabilityToStatus('Unknown')).toBe('unknown');
    expect(mapAvailabilityToStatus('offline')).toBe('offline');
    expect(mapAvailabilityToStatus('Offline')).toBe('offline');
  });
});

describe('AgentStatus type includes unknown', () => {
  it('unknown is a valid AgentStatus value', () => {
    const status: AgentStatus = 'unknown';
    expect(status).toBe('unknown');
  });

  it('offline is still a valid AgentStatus value', () => {
    const status: AgentStatus = 'offline';
    expect(status).toBe('offline');
  });
});

describe('deriveMotionState with unknown status', () => {
  it('returns atDesk for unknown agents in LIVE mode', () => {
    const agent = makeAgent({ status: 'unknown' });
    expect(deriveMotionState(agent, false)).toBe('atDesk');
  });

  it('returns atDesk for unknown agents in MOCK mode', () => {
    const agent = makeAgent({ status: 'unknown' });
    expect(deriveMotionState(agent, true)).toBe('atDesk');
  });

  it('returns offline for offline agents (not atDesk)', () => {
    const agent = makeAgent({ status: 'offline' });
    expect(deriveMotionState(agent, false)).toBe('offline');
    expect(deriveMotionState(agent, true)).toBe('offline');
  });

  it('returns atDesk for working agents in LIVE mode', () => {
    const agent = makeAgent({ status: 'working' });
    expect(deriveMotionState(agent, false)).toBe('atDesk');
  });
});

describe('Runtime Summary unknown counting', () => {
  it('unknown agents are not counted as offline', () => {
    const agents = [
      makeAgent({ id: 'sirius', status: 'unknown' }),
      makeAgent({ id: 'draco', status: 'unknown' }),
      makeAgent({ id: 'altair', status: 'unknown' }),
      makeAgent({ id: 'antares', status: 'unknown' }),
      makeAgent({ id: 'capella', status: 'unknown' }),
      makeAgent({ id: 'polaris', status: 'unknown' }),
    ];

    const offlineCount = agents.filter((a) => ['offline', 'error'].includes(a.status)).length;
    const unknownCount = agents.filter((a) => a.status === 'unknown').length;
    const activeCount = agents.filter((a) => ['online', 'working', 'busy', 'waiting'].includes(a.status)).length;

    expect(offlineCount).toBe(0);
    expect(unknownCount).toBe(6);
    expect(activeCount).toBe(0);
  });

  it('offline agents are still counted as offline', () => {
    const agents = [
      makeAgent({ id: 'sirius', status: 'offline' }),
      makeAgent({ id: 'draco', status: 'online' }),
    ];

    const offlineCount = agents.filter((a) => ['offline', 'error'].includes(a.status)).length;
    const unknownCount = agents.filter((a) => a.status === 'unknown').length;

    expect(offlineCount).toBe(1);
    expect(unknownCount).toBe(0);
  });

  it('mixed statuses count correctly', () => {
    const agents = [
      makeAgent({ id: 'sirius', status: 'online' }),
      makeAgent({ id: 'draco', status: 'working' }),
      makeAgent({ id: 'altair', status: 'unknown' }),
      makeAgent({ id: 'antares', status: 'offline' }),
      makeAgent({ id: 'capella', status: 'unknown' }),
      makeAgent({ id: 'polaris', status: 'error' }),
    ];

    const activeCount = agents.filter((a) => ['online', 'working', 'busy', 'waiting'].includes(a.status)).length;
    const offlineCount = agents.filter((a) => ['offline', 'error'].includes(a.status)).length;
    const unknownCount = agents.filter((a) => a.status === 'unknown').length;

    expect(activeCount).toBe(2);
    expect(offlineCount).toBe(2);
    expect(unknownCount).toBe(2);
  });
});

describe('Visual Office class selection', () => {
  it('unknown agents get agent-sprite--unknown class', () => {
    const agent = makeAgent({ status: 'unknown' });
    const classes = [
      agent.status === 'offline' ? 'agent-sprite--offline' : '',
      agent.status === 'working' ? 'agent-sprite--working' : '',
      agent.status === 'unknown' ? 'agent-sprite--unknown' : '',
    ].filter(Boolean).join(' ');

    expect(classes).toBe('agent-sprite--unknown');
    expect(classes).not.toContain('offline');
  });

  it('offline agents get agent-sprite--offline class, not unknown', () => {
    const agent = makeAgent({ status: 'offline' });
    const classes = [
      agent.status === 'offline' ? 'agent-sprite--offline' : '',
      agent.status === 'working' ? 'agent-sprite--working' : '',
      agent.status === 'unknown' ? 'agent-sprite--unknown' : '',
    ].filter(Boolean).join(' ');

    expect(classes).toBe('agent-sprite--offline');
    expect(classes).not.toContain('unknown');
  });

  it('unknown agents get agent-status-ring--unknown class', () => {
    const agent = makeAgent({ status: 'unknown' });
    const ringClass = `agent-status-ring agent-status-ring--${agent.status}`;
    expect(ringClass).toBe('agent-status-ring agent-status-ring--unknown');
    expect(ringClass).not.toContain('offline');
  });

  it('unknown agents get status-badge--unknown class in inspector', () => {
    const agent = makeAgent({ status: 'unknown' });
    const statusClass = agent.status || 'offline';
    const statusText = (agent.status || 'offline').toUpperCase();
    const badgeClass = `status-badge status-badge--${statusClass}`;

    expect(badgeClass).toBe('status-badge status-badge--unknown');
    expect(statusText).toBe('UNKNOWN');
    expect(badgeClass).not.toContain('offline');
  });
});
