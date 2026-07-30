import { describe, it, expect } from 'vitest';
import { sanitizeEventText, shouldShowBubble, getEventTTL } from '../../src/lib/events.js';

describe('sanitizeEventText', () => {
  it('returns empty for empty input', () => {
    expect(sanitizeEventText('')).toBe('');
  });

  it('passes through plain text', () => {
    expect(sanitizeEventText('Hello world')).toBe('Hello world');
  });

  it('strips HTML tags', () => {
    expect(sanitizeEventText('<p>Hello</p>')).toBe('Hello');
  });

  it('strips thinking tags (content preserved, tags removed)', () => {
    // HTML strip runs first, removing <thinking> tags but keeping content
    expect(sanitizeEventText('Hello <thinking>internal thought</thinking> world')).toBe('Hello internal thought world');
  });

  it('strips reasoning tags (content preserved, tags removed)', () => {
    expect(sanitizeEventText('Before <reasoning>secret</reasoning> after')).toBe('Before secret after');
  });

  it('strips internal markers', () => {
    expect(sanitizeEventText('Before [INTERNAL] secret [/INTERNAL] after')).toBe('Before  after');
  });

  it('truncates long text with ellipsis', () => {
    const long = 'a'.repeat(200);
    const result = sanitizeEventText(long, 100);
    expect(result.length).toBe(100);
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not truncate short text', () => {
    expect(sanitizeEventText('short', 100)).toBe('short');
  });

  it('trims whitespace', () => {
    expect(sanitizeEventText('  hello  ')).toBe('hello');
  });
});

describe('shouldShowBubble', () => {
  it('returns true for message events', () => {
    expect(shouldShowBubble('message.started')).toBe(true);
    expect(shouldShowBubble('message.finished')).toBe(true);
  });

  it('returns true for task events', () => {
    expect(shouldShowBubble('task.started')).toBe(true);
    expect(shouldShowBubble('task.completed')).toBe(true);
  });

  it('returns true for handoff.created', () => {
    expect(shouldShowBubble('handoff.created')).toBe(true);
  });

  it('returns false for non-bubble events', () => {
    expect(shouldShowBubble('agent.started')).toBe(false);
    expect(shouldShowBubble('agent.status')).toBe(false);
    expect(shouldShowBubble('session.started')).toBe(false);
    expect(shouldShowBubble('tool.started')).toBe(false);
    expect(shouldShowBubble('handoff.accepted')).toBe(false);
  });
});

describe('getEventTTL', () => {
  it('returns 8s for message events', () => {
    expect(getEventTTL('message.started')).toBe(8000);
    expect(getEventTTL('message.finished')).toBe(8000);
  });

  it('returns 10s for task events', () => {
    expect(getEventTTL('task.started')).toBe(10000);
    expect(getEventTTL('task.completed')).toBe(10000);
    expect(getEventTTL('task.failed')).toBe(10000);
  });

  it('returns 6s for handoff.created', () => {
    expect(getEventTTL('handoff.created')).toBe(6000);
  });

  it('returns 5s for default events', () => {
    expect(getEventTTL('agent.started')).toBe(5000);
    expect(getEventTTL('tool.started')).toBe(5000);
  });
});
