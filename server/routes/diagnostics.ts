/* ────────────────────────────────────────────────────────────
   Diagnostics — server-side systemctl/journal access
   Safe redaction, fixed limits, no shell injection
   ──────────────────────────────────────────────────────────── */

import express from 'express';
import { execSync } from 'child_process';
import type { LastClawResponse } from '../runtime/types.js';

export const diagnosticsRouter = express.Router();

const MAX_JOURNAL_LINES = 100;

/** Redact sensitive strings from output */
function redactOutput(text: string): string {
  return text
    // Gateway token (hex strings > 20 chars)
    .replace(/[a-f0-9]{40,}/gi, '[REDACTED_TOKEN]')
    // Bearer tokens
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    // Authorization headers
    .replace(/Authorization["\s:=]+[^\s,]+/gi, 'Authorization=[REDACTED]')
    // API keys
    .replace(/(?:api[_-]?key|apikey)["\s:=]+\S+/gi, 'api_key=[REDACTED]')
    // Passwords
    .replace(/(?:password|passwd|pwd)["\s:=]+\S+/gi, 'password=[REDACTED]')
    // Cookies
    .replace(/Cookie["\s:=]+[^\s,]+/gi, 'Cookie=[REDACTED]')
    // Tokens in env
    .replace(/(?:TOKEN|SECRET|KEY|CREDENTIAL)["\s:=]+\S+/gi, '[REDACTED]')
    // Telegram bot tokens
    .replace(/\d+:[A-Za-z0-9_-]{35}/g, '[REDACTED_BOT_TOKEN]')
    // Discord tokens
    .replace(/[MN][A-Za-z0-9_-]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/g, '[REDACTED_DISCORD_TOKEN]')
    // Ed25519 PEM
    .replace(/-----BEGIN(?:\s+PRIVATE)?\s+KEY-----[\s\S]*?-----END(?:\s+PRIVATE)?\s+KEY-----/g, '[REDACTED_PRIVATE_KEY]');
}

/** Safe systemctl status fetch */
function getServiceStatus(service: string): string {
  try {
    const output = execSync(
      `systemctl --user status ${service} --no-pager 2>&1`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    return redactOutput(output);
  } catch (err: any) {
    return redactOutput(err.stdout || err.message || 'Unknown error');
  }
}

/** Safe journal fetch */
function getJournalLogs(service: string, lines: number): string {
  const safeLines = Math.min(Math.max(lines, 1), MAX_JOURNAL_LINES);
  try {
    const output = execSync(
      `journalctl --user -u ${service} --no-pager --lines=${safeLines} 2>&1`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    return redactOutput(output);
  } catch (err: any) {
    return redactOutput(err.stdout || err.message || 'Unknown error');
  }
}

// ── Service status ──────────────────────────────────────────
diagnosticsRouter.get('/diagnostics/status', (_req, res) => {
  const lastclawStatus = getServiceStatus('lastclaw-coreboard.service');
  const openclawStatus = getServiceStatus('openclaw.service');

  res.json({
    data: {
      lastclaw: lastclawStatus,
      openclaw: openclawStatus,
    },
    source: 'REAL',
    observedAt: new Date().toISOString(),
    stale: false,
  });
});

// ── Journal logs ────────────────────────────────────────────
diagnosticsRouter.get('/diagnostics/logs', (req, res) => {
  const service = (req.query.service as string) || 'lastclaw-coreboard.service';
  const lines = parseInt(req.query.lines as string, 10) || 50;

  // Only allow known services
  const allowed = ['lastclaw-coreboard.service', 'openclaw.service'];
  if (!allowed.includes(service)) {
    res.status(400).json({ error: `Service must be one of: ${allowed.join(', ')}` });
    return;
  }

  const logs = getJournalLogs(service, lines);

  res.json({
    data: {
      service,
      lines: Math.min(lines, MAX_JOURNAL_LINES),
      output: logs,
    },
    source: 'REAL',
    observedAt: new Date().toISOString(),
    stale: false,
  });
});

// ── Connection diagnostics ──────────────────────────────────
diagnosticsRouter.get('/diagnostics/connection', (_req, res) => {
  const { getGatewayClient } = require('../runtime/OpenClawAdapter.js');
  try {
    const client = getGatewayClient();
    res.json({
      data: {
        state: client.connectionState,
        connected: client.connected,
        events: client.events.getRecent(10),
      },
      source: 'REAL',
      observedAt: new Date().toISOString(),
      stale: false,
    });
  } catch (err: any) {
    res.json({
      data: {
        state: 'error',
        connected: false,
        error: err.message,
      },
      source: 'ERROR',
      observedAt: new Date().toISOString(),
      stale: false,
    });
  }
});
