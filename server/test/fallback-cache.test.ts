import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { OpenClawAdapter } from '../../server/runtime/OpenClawAdapter.js';

describe('Fallback and Cache', () => {
  let adapter: OpenClawAdapter;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lastclaw-test-'));
    process.env.LASTCLAW_HOME = tempDir;
    process.env.OPENCLAW_GATEWAY_URL = 'ws://127.0.0.1:18792'; // dead port
    adapter = new OpenClawAdapter();
  });

  it('uses cache when gateway is down and cache exists', async () => {
    const cacheDir = path.join(tempDir, 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'health.json'), JSON.stringify({
      schemaVersion: 1,
      observedAt: '2026-07-26T00:00:00.000Z',
      data: { ok: true, ts: 100 }
    }));

    const result = await adapter.getHealth();
    expect(result.source).toBe('CACHED');
    expect(result.stale).toBe(true);
    expect(result.data?.ts).toBe(100);
  });

  it('ignores corrupted cache safely', async () => {
    const cacheDir = path.join(tempDir, 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'health.json'), '{ bad json');

    const result = await adapter.getHealth();
    expect(result.source).toBe('ERROR');
    expect(result.stale).toBe(false);
    expect(result.error?.code).toBe('GATEWAY_UNAVAILABLE');
  });

  it('writes cache atomically and does not leak tokens', async () => {
    const dataWithToken = {
      id: 'agent1',
      accessToken: 'secret_token_123',
      name: 'Agent One'
    };
    
    await (adapter as any).writeCacheAtomically('test_cache', dataWithToken);
    
    const targetPath = path.join(tempDir, 'cache', 'test_cache.json');
    const content = fs.readFileSync(targetPath, 'utf-8');
    const parsed = JSON.parse(content);
    
    expect(parsed.data.name).toBe('Agent One');
    expect(parsed.data.accessToken).toBeUndefined(); // Redacted
  });
});
