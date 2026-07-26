import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';

describe('Environment Path Resolution', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('resolves ~ to homedir', async () => {
    process.env.OPENCLAW_HOME = '~/test-openclaw';
    const { env } = await import('../../server/config/env.js');
    expect(env.OPENCLAW_HOME).toBe(`${os.homedir()}/test-openclaw`);
  });

  it('keeps absolute paths as is', async () => {
    process.env.OPENCLAW_HOME = '/absolute/path/test-openclaw';
    const { env } = await import('../../server/config/env.js');
    expect(env.OPENCLAW_HOME).toBe('/absolute/path/test-openclaw');
  });
});
