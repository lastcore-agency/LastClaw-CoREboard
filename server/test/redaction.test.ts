import { describe, it, expect, beforeEach } from 'vitest';
import { OpenClawAdapter } from '../../server/runtime/OpenClawAdapter.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Redaction and Security', () => {
  let adapter: OpenClawAdapter;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lastclaw-test-'));
    process.env.LASTCLAW_HOME = tempDir;
    adapter = new OpenClawAdapter();
  });

  it('redacts tokens from cache files', async () => {
    const sensitiveData = {
      name: 'Test Agent',
      GatewayToken: 'secret123',
      deviceToken: 'secret456',
      normalField: 'safe'
    };

    await (adapter as any).writeCacheAtomically('sensitive_test', sensitiveData);
    
    const content = fs.readFileSync(path.join(tempDir, 'cache', 'sensitive_test.json'), 'utf-8');
    const parsed = JSON.parse(content);
    
    expect(parsed.data.name).toBe('Test Agent');
    expect(parsed.data.normalField).toBe('safe');
    expect(parsed.data.GatewayToken).toBeUndefined();
    expect(parsed.data.deviceToken).toBeUndefined();
  });
});
