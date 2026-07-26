import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { OpenClawAdapter } from '../../server/runtime/OpenClawAdapter.js';

describe('Config Parser', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lastclaw-test-'));
  const configPath = path.join(tempDir, 'openclaw.json');

  beforeEach(() => {
    process.env.OPENCLAW_CONFIG_PATH = configPath;
    process.env.LASTCLAW_HOME = tempDir;
  });

  it('parses json5 config file successfully', async () => {
    const configContent = `
    {
      // Comment here
      agents: {
        defaults: { workspace: '/default/workspace', model: 'default/model' },
        list: [
          { id: 'agent1', name: 'Agent 1' }
        ]
      }
    }`;
    fs.writeFileSync(configPath, configContent);

    const adapter = new OpenClawAdapter();
    const result = await (adapter as any).readFallbackConfig();

    expect(result.source).toBe('FALLBACK');
    expect(result.agents.length).toBe(1);
    expect(result.agents[0].id).toBe('agent1');
    expect(result.agents[0].workspace).toBe('/default/workspace'); // inherits default
    expect(result.agents[0].model).toBe('default/model'); // inherits default
  });

  it('handles missing config file', async () => {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    const adapter = new OpenClawAdapter();
    const result = await (adapter as any).readFallbackConfig();

    expect(result.source).toBe('ERROR');
    expect(result.error.code).toBe('CONFIG_NOT_FOUND');
  });

  it('handles malformed config file', async () => {
    fs.writeFileSync(configPath, '{ invalid_json ');
    const adapter = new OpenClawAdapter();
    const result = await (adapter as any).readFallbackConfig();

    expect(result.source).toBe('ERROR');
    expect(result.error.code).toBe('CONFIG_PARSE_FAILED');
  });
});
