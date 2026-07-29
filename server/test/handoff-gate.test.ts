import { describe, it, expect } from 'vitest';

describe('Handoff demo gate logic', () => {
  function isMockEnabled(envVal: string | undefined): boolean {
    return String(envVal || 'false') === 'true';
  }

  it('returns false when VITE_USE_MOCK is undefined', () => {
    expect(isMockEnabled(undefined)).toBe(false);
  });

  it('returns false when VITE_USE_MOCK is "false"', () => {
    expect(isMockEnabled('false')).toBe(false);
  });

  it('returns true when VITE_USE_MOCK is "true"', () => {
    expect(isMockEnabled('true')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isMockEnabled('')).toBe(false);
  });

  it('returns false for any random value', () => {
    expect(isMockEnabled('yes')).toBe(false);
    expect(isMockEnabled('1')).toBe(false);
  });
});
