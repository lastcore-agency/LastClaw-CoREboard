import { describe, it, expect } from 'vitest';

/**
 * Focused tests for the exact crash cause (model object rendering)
 * and safe missing-field rendering in the Inspector.
 *
 * These tests verify the normalizeModel function logic and safe() helper
 * without requiring a full DOM testing framework.
 */

// Mirror of normalizeModel from src/lib/openclaw.ts
function normalizeModel(model: unknown): string {
  if (!model) return '';
  if (typeof model === 'string') return model;
  if (typeof model === 'object' && model !== null && 'primary' in model) {
    return String((model as { primary: unknown }).primary || '');
  }
  try { return JSON.stringify(model); } catch { return ''; }
}

// Mirror of safe() from AgentInspector
function safe(value: unknown, fallback = '—'): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value || fallback;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && 'primary' in (value as Record<string, unknown>)) {
    return String((value as { primary: unknown }).primary || fallback);
  }
  try { return JSON.stringify(value); } catch { return fallback; }
}

describe('Model Normalization (Black Screen Root Cause)', () => {
  it('extracts primary from runtime model object', () => {
    const rtModel = { primary: 'nvidia/nemotron-3-ultra-550b-a55b', fallbacks: ['nvidia/z-ai/glm-5.2'] };
    expect(normalizeModel(rtModel)).toBe('nvidia/nemotron-3-ultra-550b-a55b');
  });

  it('passes through string model unchanged', () => {
    expect(normalizeModel('gpt-4o')).toBe('gpt-4o');
  });

  it('returns empty string for null', () => {
    expect(normalizeModel(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(normalizeModel(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(normalizeModel('')).toBe('');
  });

  it('handles object with empty primary', () => {
    expect(normalizeModel({ primary: '', fallbacks: [] })).toBe('');
  });

  it('stringifies unexpected object shapes', () => {
    const weird = { foo: 'bar' };
    expect(normalizeModel(weird)).toBe('{"foo":"bar"}');
  });
});

describe('Safe Field Rendering (Inspector Null Safety)', () => {
  it('returns string values unchanged', () => {
    expect(safe('online')).toBe('online');
  });

  it('returns fallback for null', () => {
    expect(safe(null)).toBe('—');
  });

  it('returns fallback for undefined', () => {
    expect(safe(undefined)).toBe('—');
  });

  it('returns fallback for empty string', () => {
    expect(safe('')).toBe('—');
  });

  it('returns custom fallback when specified', () => {
    expect(safe(null, 'N/A')).toBe('N/A');
  });

  it('converts numbers to strings', () => {
    expect(safe(42)).toBe('42');
    expect(safe(0)).toBe('0');
  });

  it('extracts primary from model objects', () => {
    const model = { primary: 'nvidia/nemotron-3-ultra-550b-a55b', fallbacks: [] };
    expect(safe(model)).toBe('nvidia/nemotron-3-ultra-550b-a55b');
  });

  it('handles model object with missing primary gracefully', () => {
    expect(safe({ primary: null }, 'unknown')).toBe('unknown');
  });

  it('stringifies unknown objects rather than crashing', () => {
    expect(safe({ x: 1, y: 2 })).toBe('{"x":1,"y":2}');
  });

  it('never throws for any input', () => {
    const inputs = [null, undefined, '', 0, false, NaN, {}, [], { primary: '' }, Symbol('test')];
    for (const input of inputs) {
      expect(() => safe(input)).not.toThrow();
    }
  });
});
