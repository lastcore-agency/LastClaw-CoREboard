import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadSessionData,
  saveSessionData,
  saveSessionMeta,
  getSessionMeta,
  removeSessionMeta,
  clearSessionData,
} from '../../src/components/chat/session-storage.js';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
    _reset() { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('Session Storage', () => {
  beforeEach(() => {
    localStorageMock._reset();
    vi.clearAllMocks();
  });

  it('loadSessionData returns empty when no data', () => {
    const data = loadSessionData();
    expect(data).toEqual({});
  });

  it('saveSessionData persists and loadSessionData reads it', () => {
    saveSessionData({
      selectedSessionKey: 'agent:main:lastclaw:abc',
      searchFilter: 'test',
      collapsedSections: ['external'],
      mobileTab: 'workroom',
    });

    const data = loadSessionData();
    expect(data.selectedSessionKey).toBe('agent:main:lastclaw:abc');
    expect(data.searchFilter).toBe('test');
    expect(data.collapsedSections).toEqual(['external']);
    expect(data.mobileTab).toBe('workroom');
  });

  it('loadSessionData returns empty object when no data', () => {
    const data = loadSessionData();
    expect(data.selectedSessionKey).toBeUndefined();
    expect(data.searchFilter).toBeUndefined();
    expect(data.collapsedSections).toBeUndefined();
    expect(data.mobileTab).toBeUndefined();
  });

  it('saveSessionMeta persists session metadata', () => {
    saveSessionMeta('agent:main:lastclaw:test', {
      title: 'Test Session',
      objective: 'Test objective',
      primaryAgentId: 'sirius',
      participatingAgentIds: ['sirius', 'draco'],
      source: 'lastclaw-native',
    });

    const meta = getSessionMeta('agent:main:lastclaw:test');
    expect(meta).not.toBeNull();
    expect(meta!.title).toBe('Test Session');
    expect(meta!.objective).toBe('Test objective');
    expect(meta!.primaryAgentId).toBe('sirius');
    expect(meta!.participatingAgentIds).toEqual(['sirius', 'draco']);
    expect(meta!.source).toBe('lastclaw-native');
  });

  it('getSessionMeta returns null for unknown key', () => {
    expect(getSessionMeta('unknown:key')).toBeNull();
  });

  it('removeSessionMeta deletes metadata', () => {
    saveSessionMeta('agent:main:lastclaw:to-delete', {
      title: 'Delete me',
      objective: '',
      primaryAgentId: 'sirius',
      participatingAgentIds: [],
      source: 'lastclaw-native',
    });

    expect(getSessionMeta('agent:main:lastclaw:to-delete')).not.toBeNull();
    removeSessionMeta('agent:main:lastclaw:to-delete');
    expect(getSessionMeta('agent:main:lastclaw:to-delete')).toBeNull();
  });

  it('clearSessionData removes all data', () => {
    saveSessionData({ selectedSessionKey: 'test' });
    clearSessionData();
    const data = loadSessionData();
    expect(data).toEqual({});
  });

  it('rejects corrupted localStorage data', () => {
    localStorageMock.setItem('lastclaw:sessions:v1', 'not-json{');
    const data = loadSessionData();
    expect(data).toEqual({});
  });

  it('rejects data with wrong version', () => {
    localStorageMock.setItem('lastclaw:sessions:v1', JSON.stringify({ version: 999, selectedSessionKey: 'test' }));
    const data = loadSessionData();
    expect(data).toEqual({});
  });

  it('does not persist token-like values in title', () => {
    saveSessionMeta('agent:main:lastclaw:token-test', {
      title: 'Token: 793d1d973b91dddc31ee598f127cdd4a05288827c00e7465',
      objective: '',
      primaryAgentId: 'sirius',
      participatingAgentIds: [],
      source: 'lastclaw-native',
    });

    const meta = getSessionMeta('agent:main:lastclaw:token-test');
    // Token-like titles should be filtered out
    expect(meta).toBeNull();
  });

  it('does not persist secret values in objective', () => {
    saveSessionMeta('agent:main:lastclaw:secret-test', {
      title: 'Normal Title',
      objective: 'secret: abc123',
      primaryAgentId: 'sirius',
      participatingAgentIds: [],
      source: 'lastclaw-native',
    });

    const meta = getSessionMeta('agent:main:lastclaw:secret-test');
    // Secret-containing objectives should be filtered
    expect(meta).toBeNull();
  });

  it('preserves valid metadata', () => {
    saveSessionMeta('agent:main:lastclaw:valid', {
      title: 'Normal Session Title',
      objective: 'Build the feature',
      primaryAgentId: 'draco',
      participatingAgentIds: ['draco'],
      source: 'lastclaw-native',
    });

    const meta = getSessionMeta('agent:main:lastclaw:valid');
    expect(meta).not.toBeNull();
    expect(meta!.title).toBe('Normal Session Title');
    expect(meta!.objective).toBe('Build the feature');
  });

  it('mobileTab is persisted and loaded', () => {
    saveSessionData({ mobileTab: 'context' });
    const data = loadSessionData();
    expect(data.mobileTab).toBe('context');
  });

  it('collapsedSections are persisted', () => {
    saveSessionData({ collapsedSections: ['native', 'automation'] });
    const data = loadSessionData();
    expect(data.collapsedSections).toEqual(['native', 'automation']);
  });
});
