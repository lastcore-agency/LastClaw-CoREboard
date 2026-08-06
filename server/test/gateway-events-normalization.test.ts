import { describe, expect, it } from 'vitest';
import { GatewayEventBus } from '../runtime/gateway/GatewayEvents.js';

describe('GatewayEventBus normalization', () => {
  it('extracts session key, role, text blocks, and canonical agent from a nested message payload', () => {
    const bus = new GatewayEventBus();
    const event = bus.normalize({
      type: 'event',
      event: 'session.message',
      payload: {
        sessionKey: 'agent:main:lastclaw:abc123',
        message: {
          role: 'assistant',
          provider: 'modelark',
          content: [{ type: 'text', text: 'งานเสร็จแล้วครับ' }],
        },
        ts: 1785890000000,
      },
    });

    expect(event.sessionId).toBe('agent:main:lastclaw:abc123');
    expect(event.agentId).toBe('sirius');
    expect(event.role).toBe('assistant');
    expect(event.text).toBe('งานเสร็จแล้วครับ');
    expect(event.timestamp).toBe('1785890000000');
  });

  it('prefers explicit agent identifiers over the session-derived fallback', () => {
    const bus = new GatewayEventBus();
    const event = bus.normalize({
      type: 'event',
      event: 'session.message',
      payload: {
        agentId: 'capella',
        sessionKey: 'agent:main:lastclaw:abc123',
        role: 'assistant',
        text: 'กำลังรับสายลูกค้า',
      },
    });

    expect(event.agentId).toBe('capella');
  });
});
