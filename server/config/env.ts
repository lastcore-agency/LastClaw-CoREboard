import * as dotenv from 'dotenv';
import * as os from 'os';
import * as path from 'path';

dotenv.config();

function resolveHome(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
}

export const env = {
  get OPENCLAW_GATEWAY_URL() { return process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789'; },
  get OPENCLAW_GATEWAY_TOKEN() { return process.env.OPENCLAW_GATEWAY_TOKEN || ''; },
  get OPENCLAW_HOME() { return resolveHome(process.env.OPENCLAW_HOME || '~/.openclaw'); },
  get OPENCLAW_CONFIG_PATH() { return resolveHome(process.env.OPENCLAW_CONFIG_PATH || '~/.openclaw/openclaw.json'); },
  get LASTCLAW_HOME() { return resolveHome(process.env.LASTCLAW_HOME || '~/.lastclaw'); },
};
