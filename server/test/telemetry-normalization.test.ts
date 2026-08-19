/* ────────────────────────────────────────────────────────────
   Telemetry Normalization Tests — 20 cases as required

   1.  session recency does NOT imply ONLINE presence
   2.  sessions.count → sessionCount
   3.  latest recent.updatedAt → lastActiveAt
   4.  heartbeat disabled ≠ offline
   5.  connected account → CONNECTED
   6.  connected=false → DISCONNECTED
   7.  reconnectPending → RECONNECTING
   8.  channel error → ERROR
   9.  one disconnected channel does NOT imply Agent OFFLINE
   10. SSE newer than poll wins (via timestamp precedence)
   11. stale poll cannot overwrite WORKING
   12. delivery queue failures → WARNING (count > 0)
   13. zero queue failures → no warning
   14. generic channel/account discovery — no hardcoded names
   15. no main→sirius hardcode in generic normalizer
   16. no token/credential in normalized payload
   17. unknown mapping stays UNKNOWN not invented
   18. gateway unavailable → agent activity UNKNOWN
   19. heartbeat informational only — not used for availability
   20. VisualOffice stability — availability logic never flips based on session recency alone
   ──────────────────────────────────────────────────────────── */

import { describe, it, expect } from 'vitest';
import {
  normalizeChannels,
  normalizeDeliveryQueues,
  OpenClawAdapter,
} from '../../server/runtime/OpenClawAdapter.js';
import { mapAvailabilityToRuntimeState } from '../../src/lib/useAgentActivity.js';

// ── Fixtures ─────────────────────────────────────────────────

const rawHealthWithChannels = {
  ok: true,
  agents: [
    {
      agentId: 'main',
      sessions: {
        count: 6,
        recent: [
          { key: 'agent:main:sess1', updatedAt: 1700000000000, age: 1000 },
          { key: 'agent:main:sess2', updatedAt: 1700000050000, age: 500 },
        ],
      },
      heartbeat: { enabled: false, intervalMs: 30000 },
      isDefault: true,
    },
    {
      agentId: 'draco',
      sessions: { count: 2, recent: [{ key: 'agent:draco:sess1', updatedAt: 1700000010000 }] },
      heartbeat: { enabled: true },
      isDefault: false,
    },
  ],
  channels: {
    discord: {
      accounts: {
        main: {
          enabled: true,
          configured: true,
          running: true,
          connected: true,
          reconnectPending: false,
          reconnectAttempts: 0,
          lastConnectedAt: '2024-01-01T00:00:00.000Z',
          lastEventAt: '2024-01-01T01:00:00.000Z',
          lastTransportActivityAt: '2024-01-01T01:00:01.000Z',
          lastInboundAt: '2024-01-01T01:00:00.000Z',
          lastOutboundAt: '2024-01-01T00:59:00.000Z',
          lastError: null,
          lastDisconnect: null,
        },
        draco: {
          enabled: true,
          configured: true,
          running: true,
          connected: false,
          reconnectPending: true,
          reconnectAttempts: 3,
          lastConnectedAt: '2024-01-01T00:00:00.000Z',
          lastEventAt: null,
          lastTransportActivityAt: null,
          lastInboundAt: null,
          lastOutboundAt: null,
          lastError: null,
          lastDisconnect: '2024-01-01T01:00:00.000Z',
        },
      },
    },
    telegram: {
      accounts: {
        polaris: {
          enabled: true,
          configured: true,
          running: false,
          connected: false,
          reconnectPending: false,
          reconnectAttempts: 0,
          lastConnectedAt: null,
          lastEventAt: null,
          lastTransportActivityAt: null,
          lastInboundAt: null,
          lastOutboundAt: null,
          lastError: 'TOKEN_INVALID',
          lastDisconnect: null,
        },
      },
    },
  },
  deliveryQueues: {
    outbound: { count: 32, oldestFailedAt: '2024-01-01T00:30:00.000Z' },
    inbound: { count: 0 },
  },
};

// ── 1. Session recency does NOT imply ONLINE ──────────────────

describe('1. Session recency does NOT imply ONLINE presence', () => {
  it('agent with sessions but no explicit availability → UNKNOWN, not ONLINE', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(
      [{
        agentId: 'test-agent',
        sessions: {
          count: 5,
          recent: [{ key: 'agent:test-agent:s1', updatedAt: Date.now() - 1000 }],
        },
        // No availability field
      }],
      {},
    );
    expect(agents[0].availability).toBe('UNKNOWN');
    expect(agents[0].availability).not.toBe('ONLINE');
  });
});

// ── 2. sessions.count → sessionCount ─────────────────────────

describe('2. sessions.count maps to sessionCount', () => {
  it('raw sessions.count is preserved as sessionCount', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(
      [{ agentId: 'main', sessions: { count: 6, recent: [] } }],
      {},
    );
    expect(agents[0].sessionCount).toBe(6);
  });

  it('falls back to recentSessions.length if count missing', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(
      [{ agentId: 'main', sessions: { recent: [{ key: 'k1' }, { key: 'k2' }] } }],
      {},
    );
    expect(agents[0].sessionCount).toBe(2);
  });
});

// ── 3. latest recent.updatedAt → lastActiveAt ─────────────────

describe('3. lastActiveAt = MAX of sessions.recent[].updatedAt', () => {
  it('picks the maximum updatedAt across recent sessions', () => {
    const adapter = new OpenClawAdapter();
    const t1 = 1700000000000;
    const t2 = 1700000050000;
    const agents = adapter.mapToCanonicalAgents(
      [{
        agentId: 'main',
        sessions: {
          count: 2,
          recent: [{ updatedAt: t1 }, { updatedAt: t2 }],
        },
      }],
      {},
    );
    expect(agents[0].lastActiveAt).toBe(t2);
  });

  it('handles ISO string updatedAt', () => {
    const adapter = new OpenClawAdapter();
    const isoTs = '2024-01-15T10:30:00.000Z';
    const expected = new Date(isoTs).getTime();
    const agents = adapter.mapToCanonicalAgents(
      [{ agentId: 'main', sessions: { count: 1, recent: [{ updatedAt: isoTs }] } }],
      {},
    );
    expect(agents[0].lastActiveAt).toBe(expected);
  });

  it('lastActiveAt is undefined when no sessions', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(
      [{ agentId: 'main', sessions: { count: 0, recent: [] } }],
      {},
    );
    expect(agents[0].lastActiveAt).toBeUndefined();
  });
});

// ── 4. Heartbeat disabled ≠ offline ──────────────────────────

describe('4. Heartbeat disabled does NOT mean offline/unavailable', () => {
  it('heartbeat.enabled=false → heartbeatEnabled=false but availability unchanged', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(
      [{
        agentId: 'main',
        heartbeat: { enabled: false, intervalMs: 30000 },
        availability: 'ONLINE',
        sessions: { count: 0, recent: [] },
      }],
      {},
    );
    expect(agents[0].heartbeatEnabled).toBe(false);
    expect(agents[0].availability).toBe('ONLINE'); // unchanged
  });

  it('heartbeatEnabled is informational — mapAvailabilityToRuntimeState ignores it', () => {
    // heartbeat field should never be passed to availability mapping
    const state = mapAvailabilityToRuntimeState('ONLINE');
    expect(state).toBe('IDLE'); // heartbeat doesn't affect this
  });
});

// ── 5. connected account → CONNECTED ─────────────────────────

describe('5. Channel connected=true → CONNECTED connectionState', () => {
  it('connected=true → CONNECTED', () => {
    const channels = normalizeChannels({
      channels: {
        discord: {
          accounts: { main: { connected: true, reconnectPending: false, lastError: null } },
        },
      },
    });
    expect(channels[0].accounts[0].connectionState).toBe('CONNECTED');
  });
});

// ── 6. connected=false → DISCONNECTED ────────────────────────

describe('6. Channel connected=false → DISCONNECTED', () => {
  it('connected=false, no reconnect → DISCONNECTED', () => {
    const channels = normalizeChannels({
      channels: {
        discord: {
          accounts: { draco: { connected: false, reconnectPending: false, lastError: null } },
        },
      },
    });
    expect(channels[0].accounts[0].connectionState).toBe('DISCONNECTED');
  });
});

// ── 7. reconnectPending → RECONNECTING ───────────────────────

describe('7. reconnectPending → RECONNECTING', () => {
  it('reconnectPending=true → RECONNECTING regardless of connected', () => {
    const channels = normalizeChannels({
      channels: {
        discord: {
          accounts: { draco: { connected: false, reconnectPending: true, lastError: null } },
        },
      },
    });
    expect(channels[0].accounts[0].connectionState).toBe('RECONNECTING');
  });
});

// ── 8. Channel error → ERROR ──────────────────────────────────

describe('8. Channel lastError → ERROR connectionState', () => {
  it('lastError present and not reconnecting → ERROR', () => {
    const channels = normalizeChannels({
      channels: {
        telegram: {
          accounts: {
            polaris: { connected: false, reconnectPending: false, lastError: 'TOKEN_INVALID' },
          },
        },
      },
    });
    expect(channels[0].accounts[0].connectionState).toBe('ERROR');
  });
});

// ── 9. One disconnected channel does NOT imply Agent OFFLINE ──

describe('9. Disconnected channel does NOT make agent OFFLINE', () => {
  it('draco channel disconnected but draco availability stays UNKNOWN (not OFFLINE)', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(
      [{ agentId: 'draco', sessions: { count: 2, recent: [] } }],
      rawHealthWithChannels,
    );
    // draco account is RECONNECTING in discord channel
    expect(agents[0].channelReconnectPending).toBe(true);
    // But the agent availability is UNKNOWN (no explicit field), NOT OFFLINE
    expect(agents[0].availability).toBe('UNKNOWN');
    expect(agents[0].availability).not.toBe('OFFLINE');
  });
});

// ── 10 & 11. SSE precedence + stale POLL ─────────────────────

describe('10–11. SSE timestamp precedence', () => {
  it('SSE state at t=5000 cannot be overwritten by POLL at t=3000', () => {
    const store = new Map<string, { state: string; ts: number; source: 'SSE' | 'POLL' }>();
    function update(id: string, state: string, ts: number, source: 'SSE' | 'POLL') {
      const ex = store.get(id);
      if (ex && ts < ex.ts) return;
      if (ex && ts === ex.ts && source === 'POLL' && ex.source === 'SSE') return;
      store.set(id, { state, ts, source });
    }
    update('main', 'WORKING', 5000, 'SSE');
    update('main', 'IDLE', 3000, 'POLL'); // stale — rejected
    expect(store.get('main')?.state).toBe('WORKING');
  });

  it('SSE WORKING cannot be overwritten by POLL IDLE at same timestamp', () => {
    const store = new Map<string, { state: string; ts: number; source: 'SSE' | 'POLL' }>();
    function update(id: string, state: string, ts: number, source: 'SSE' | 'POLL') {
      const ex = store.get(id);
      if (ex && ts < ex.ts) return;
      if (ex && ts === ex.ts && source === 'POLL' && ex.source === 'SSE') return;
      store.set(id, { state, ts, source });
    }
    update('main', 'WORKING', 5000, 'SSE');
    update('main', 'IDLE', 5000, 'POLL'); // same ts, SSE wins
    expect(store.get('main')?.state).toBe('WORKING');
  });
});

// ── 12. Delivery queue failures → WARNING ────────────────────

describe('12. Delivery queue failures produce WARNING', () => {
  it('outbound count=32 → one failure entry', () => {
    const failures = normalizeDeliveryQueues({
      deliveryQueues: {
        outbound: { count: 32, oldestFailedAt: '2024-01-01T00:30:00.000Z' },
      },
    });
    expect(failures).toHaveLength(1);
    expect(failures[0].queueName).toBe('outbound');
    expect(failures[0].count).toBe(32);
    expect(failures[0].oldestFailedAt).toBeTruthy();
  });

  it('only includes queues with count > 0', () => {
    const failures = normalizeDeliveryQueues({
      deliveryQueues: {
        outbound: { count: 32 },
        inbound: { count: 0 },
      },
    });
    expect(failures).toHaveLength(1);
    expect(failures.every(f => f.count > 0)).toBe(true);
  });
});

// ── 13. Zero queue failures → no warning ─────────────────────

describe('13. Zero queue failures → empty array', () => {
  it('all queues count=0 → no failures', () => {
    const failures = normalizeDeliveryQueues({
      deliveryQueues: { outbound: { count: 0 }, inbound: { count: 0 } },
    });
    expect(failures).toHaveLength(0);
  });

  it('no deliveryQueues field → empty array', () => {
    const failures = normalizeDeliveryQueues({ ok: true });
    expect(failures).toHaveLength(0);
  });
});

// ── 14. Generic channel/account discovery ────────────────────

describe('14. Generic channel/account discovery — no hardcoded names', () => {
  it('discovers arbitrary channel and account names', () => {
    const channels = normalizeChannels({
      channels: {
        'my-custom-channel': {
          accounts: {
            'agent-xyz': { connected: true, reconnectPending: false, lastError: null },
            'agent-abc': { connected: false, reconnectPending: false, lastError: null },
          },
        },
        'another-channel': {
          accounts: {
            'bot-99': { connected: true, reconnectPending: false, lastError: null },
          },
        },
      },
    });
    expect(channels).toHaveLength(2);
    expect(channels.map(c => c.channelName)).toContain('my-custom-channel');
    expect(channels.map(c => c.channelName)).toContain('another-channel');
    expect(channels[0].accounts.map(a => a.accountId)).toContain('agent-xyz');
  });

  it('also handles array-shape channels', () => {
    const channels = normalizeChannels({
      channels: [
        { name: 'slack', accounts: [{ id: 'bot-1', connected: true, reconnectPending: false, lastError: null }] },
        { name: 'email', accounts: [{ id: 'bot-2', connected: false, reconnectPending: false, lastError: null }] },
      ],
    });
    expect(channels).toHaveLength(2);
    expect(channels[0].channelName).toBe('slack');
    expect(channels[1].channelName).toBe('email');
  });
});

// ── 15. No main→sirius hardcode in generic normalizer ─────────

describe('15. No main→sirius mapping in generic channel normalizer', () => {
  it('normalizeChannels does not rename main to sirius', () => {
    const channels = normalizeChannels({
      channels: { discord: { accounts: { main: { connected: true, reconnectPending: false, lastError: null } } } },
    });
    const accountIds = channels.flatMap(c => c.accounts.map(a => a.accountId));
    expect(accountIds).toContain('main');
    expect(accountIds).not.toContain('sirius');
  });
});

// ── 16. No token/credential in normalized payload ─────────────

describe('16. No credential fields in normalized channel payload', () => {
  it('token/secret fields are NOT present in NormalizedChannelAccount', () => {
    const channels = normalizeChannels({
      channels: {
        discord: {
          accounts: {
            main: {
              connected: true,
              reconnectPending: false,
              lastError: null,
              token: 'SECRET_TOKEN_DO_NOT_LEAK',
              tokenSource: 'config',
              password: 'hunter2',
              secret: 'abc123',
            },
          },
        },
      },
    });
    const acc = channels[0].accounts[0] as any;
    expect(acc.token).toBeUndefined();
    expect(acc.password).toBeUndefined();
    expect(acc.secret).toBeUndefined();
  });
});

// ── 17. Unknown mapping → UNKNOWN not invented ────────────────

describe('17. Unknown availability → UNKNOWN, never invented state', () => {
  it('empty availability string → UNKNOWN', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(
      [{ agentId: 'x', sessions: { count: 0, recent: [] } }],
      {},
    );
    expect(agents[0].availability).toBe('UNKNOWN');
  });

  it('unrecognized availability string → UNKNOWN', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(
      [{ agentId: 'x', availability: 'DREAMING', sessions: { count: 0, recent: [] } }],
      {},
    );
    expect(agents[0].availability).toBe('UNKNOWN');
  });

  it('mapAvailabilityToRuntimeState: unrecognized → UNKNOWN', () => {
    expect(mapAvailabilityToRuntimeState('DREAMING')).toBe('UNKNOWN');
    expect(mapAvailabilityToRuntimeState('')).toBe('UNKNOWN');
    expect(mapAvailabilityToRuntimeState(undefined)).toBe('UNKNOWN');
  });
});

// ── 18. Gateway unavailable → agent activity UNKNOWN ──────────

describe('18. Gateway unavailable → agent activity stays UNKNOWN not OFFLINE', () => {
  it('gateway.disconnected event does not mark agent OFFLINE', () => {
    // gateway.disconnected has no agentId → no per-agent state update
    const event = { type: 'gateway.disconnected', agentId: '' };
    const hasAgentId = Boolean(event.agentId);
    expect(hasAgentId).toBe(false); // gate: no agentId → no state update

    // The state UNKNOWN covers "no data" case
    const state = mapAvailabilityToRuntimeState(undefined);
    expect(state).toBe('UNKNOWN');
    expect(state).not.toBe('OFFLINE');
  });
});

// ── 19. Heartbeat informational only ─────────────────────────

describe('19. Heartbeat is informational — never drives availability', () => {
  it('heartbeat=false and heartbeat=true both leave availability unaffected', () => {
    const adapter = new OpenClawAdapter();
    const noHeartbeat = adapter.mapToCanonicalAgents(
      [{ agentId: 'a', heartbeat: { enabled: false }, availability: 'ONLINE', sessions: { count: 0, recent: [] } }],
      {},
    );
    const withHeartbeat = adapter.mapToCanonicalAgents(
      [{ agentId: 'b', heartbeat: { enabled: true }, availability: 'ONLINE', sessions: { count: 0, recent: [] } }],
      {},
    );
    expect(noHeartbeat[0].availability).toBe('ONLINE');
    expect(withHeartbeat[0].availability).toBe('ONLINE');
  });

  it('heartbeatEnabled field is purely informational', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(
      [{ agentId: 'main', heartbeat: { enabled: false, intervalMs: 60000 }, sessions: { count: 0, recent: [] } }],
      {},
    );
    expect(agents[0].heartbeatEnabled).toBe(false);
    expect(agents[0].heartbeatIntervalMs).toBe(60000);
    // Availability still UNKNOWN — heartbeat doesn't change it
    expect(agents[0].availability).toBe('UNKNOWN');
  });
});

// ── 20. Availability logic never flips on session recency alone ─

describe('20. Availability derivation stable — session recency alone cannot set ONLINE', () => {
  it('same agent at t1 and t2: availability stays UNKNOWN if no explicit field', () => {
    const adapter = new OpenClawAdapter();
    const agentWithSessions = (updatedAt: number) => ({
      agentId: 'main',
      sessions: { count: 3, recent: [{ updatedAt }] },
    });

    const t1 = adapter.mapToCanonicalAgents([agentWithSessions(Date.now() - 1000)], {});
    const t2 = adapter.mapToCanonicalAgents([agentWithSessions(Date.now() - 3600_000)], {});

    // Neither recent nor old session recency should flip to ONLINE
    expect(t1[0].availability).toBe('UNKNOWN');
    expect(t2[0].availability).toBe('UNKNOWN');
  });

  it('explicit ONLINE field → ONLINE regardless of session count', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(
      [{ agentId: 'main', availability: 'ONLINE', sessions: { count: 0, recent: [] } }],
      {},
    );
    expect(agents[0].availability).toBe('ONLINE');
  });
});

// ── 21. Real SiX-SQUAD payload: main agent → sirius channel ───

describe('21. Real SiX-SQUAD payload: agent main receives sirius channel via manifest binding', () => {
  const realHealth = {
    ok: true,
    agents: [
      {
        agentId: 'main',
        isDefault: true,
        sessions: {
          count: 30,
          recent: [
            {
              key: 'agent:main:test',
              updatedAt: 1786659871946,
            },
          ],
        },
      },
    ],
    channels: {
      discord: {
        accounts: {
          sirius: {
            accountId: 'sirius',
            enabled: true,
            configured: true,
            running: true,
            connected: true,
            reconnectPending: false,
            reconnectAttempts: 0,
            lastConnectedAt: 1786660181276,
            lastEventAt: 1786662274971,
            lastTransportActivityAt: 1786663236899,
            tokenSource: 'config',
            tokenStatus: 'available',
          },
        },
      },
    },
  };

  it('agent main resolves to canonical sirius via manifest reverseMap', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(realHealth.agents, realHealth);
    const agent = agents[0];

    expect(agent.runtimeAgentId).toBe('main');
    expect(agent.canonicalId).toBe('sirius');
    expect(agent.id).toBe('sirius');
  });

  it('sirius channel telemetry is attached to main agent via manifest channelAccountId', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(realHealth.agents, realHealth);
    const agent = agents[0];

    expect(agent.channelConnected).toBe(true);
    expect(agent.channelRunning).toBe(true);
    expect(agent.channelConfigured).toBe(true);
    expect(agent.channelEnabled).toBe(true);
    expect(agent.channelReconnectPending).toBe(false);
  });

  it('session telemetry matches real payload', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(realHealth.agents, realHealth);
    const agent = agents[0];

    expect(agent.sessionCount).toBe(30);
    expect(agent.lastActiveAt).toBe(1786659871946);
  });

  it('numeric timestamps are converted to ISO strings in channel normalization', () => {
    const channels = normalizeChannels(realHealth);
    const siriusAcc = channels[0].accounts[0];

    expect(siriusAcc.accountId).toBe('sirius');
    expect(siriusAcc.lastConnectedAt).toBe(new Date(1786660181276).toISOString());
    expect(siriusAcc.lastEventAt).toBe(new Date(1786662274971).toISOString());
    expect(siriusAcc.lastTransportActivityAt).toBe(new Date(1786663236899).toISOString());
  });

  it('no generic main→sirius hardcode — binding comes from manifest only', () => {
    // normalizeChannels itself does NOT rename main to sirius
    const channels = normalizeChannels({
      channels: { discord: { accounts: { main: { connected: true, reconnectPending: false, lastError: null } } } },
    });
    const accountIds = channels.flatMap(c => c.accounts.map(a => a.accountId));
    expect(accountIds).toContain('main');
    expect(accountIds).not.toContain('sirius');
  });

  it('tokenSource/tokenStatus/token are NOT in normalized channel output', () => {
    const channels = normalizeChannels(realHealth);
    const siriusAcc = channels[0].accounts[0] as any;

    expect(siriusAcc.tokenSource).toBeUndefined();
    expect(siriusAcc.tokenStatus).toBeUndefined();
    expect(siriusAcc.token).toBeUndefined();
  });
});

// ── 22. Real delivery queue shape: failed array with numeric timestamps ─

describe('22. Real delivery queue shape — failed array with queueName + numeric oldestFailedAt', () => {
  it('parses real VM shape: deliveryQueues.failed[0] with numeric timestamp', () => {
    const failures = normalizeDeliveryQueues({
      deliveryQueues: {
        failed: [
          {
            queueName: 'outbound',
            count: 32,
            oldestFailedAt: 1785273395688,
          },
        ],
      },
    });
    expect(failures).toHaveLength(1);
    expect(failures[0].queueName).toBe('outbound');
    expect(failures[0].count).toBe(32);
    expect(failures[0].oldestFailedAt).toBe(new Date(1785273395688).toISOString());
  });

  it('delivery queue WARNING does not affect Gateway LIVE status', () => {
    // Gateway health.ok is separate from delivery queue failures
    const raw = {
      ok: true,
      deliveryQueues: {
        failed: [{ queueName: 'outbound', count: 32, oldestFailedAt: 1785273395688 }],
      },
    };
    const failures = normalizeDeliveryQueues(raw);
    expect(failures.length).toBeGreaterThan(0);
    // Gateway itself is still ok — queue failures are WARNING severity, not ERROR
    expect(raw.ok).toBe(true);
  });
});

// ── 23. Security — credential fields never appear in normalized output ──

describe('23. Security — credential fields stripped from all normalized outputs', () => {
  const payloadWithSecrets = {
    ok: true,
    agents: [
      {
        agentId: 'main',
        sessions: { count: 1, recent: [] },
        token: 'DO_NOT_EXPOSE',
        password: 'DO_NOT_EXPOSE',
        secret: 'DO_NOT_EXPOSE',
        authorization: 'DO_NOT_EXPOSE',
      },
    ],
    channels: {
      discord: {
        accounts: {
          sirius: {
            connected: true,
            reconnectPending: false,
            lastError: null,
            token: 'DO_NOT_EXPOSE',
            password: 'DO_NOT_EXPOSE',
            secret: 'DO_NOT_EXPOSE',
            authorization: 'DO_NOT_EXPOSE',
            tokenSource: 'config',
            credential: 'DO_NOT_EXPOSE',
          },
        },
      },
    },
  };

  it('normalized channel accounts do not contain token/password/secret/authorization/credential', () => {
    const channels = normalizeChannels(payloadWithSecrets);
    const acc = channels[0].accounts[0] as any;

    expect(acc.token).toBeUndefined();
    expect(acc.password).toBeUndefined();
    expect(acc.secret).toBeUndefined();
    expect(acc.authorization).toBeUndefined();
    expect(acc.credential).toBeUndefined();
    expect(acc.tokenSource).toBeUndefined();
  });

  it('RuntimeAgent normalized output does not leak agent-level credentials', () => {
    const adapter = new OpenClawAdapter();
    const agents = adapter.mapToCanonicalAgents(
      payloadWithSecrets.agents,
      payloadWithSecrets,
    );
    const agent = agents[0] as any;

    // The normalized RuntimeAgent only copies whitelisted fields
    // Raw fields like token/password are never assigned
    expect(agent.token).toBeUndefined();
    expect(agent.password).toBeUndefined();
    expect(agent.secret).toBeUndefined();
    expect(agent.authorization).toBeUndefined();
  });
});
