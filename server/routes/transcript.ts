/* ────────────────────────────────────────────────────────────
   Transcript — safe server-side JSONL transcript reader
   Maps session keys → session IDs → transcript files
   No browser path input allowed
   ──────────────────────────────────────────────────────────── */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

export const transcriptRouter = express.Router();

const MAX_MESSAGES = 200;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** Redact sensitive content from text */
function redactContent(text: string): string {
  if (!text) return '';
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/\[INTERNAL\][\s\S]*?\[\/INTERNAL\]/gi, '')
    .replace(/```\s*thinking[\s\S]*?```/gi, '')
    .replace(/token["\s:=]+\S+/gi, 'token=[REDACTED]')
    .replace(/key["\s:=]+\S+/gi, 'key=[REDACTED]')
    .replace(/secret["\s:=]+\S+/gi, 'secret=[REDACTED]')
    .replace(/password["\s:=]+\S+/gi, 'password=[REDACTED]')
    .replace(/Authorization["\s:=]+[^\s,]+/gi, 'Authorization=[REDACTED]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/[a-f0-9]{40,}/gi, '[REDACTED_TOKEN]')
    .replace(/\d+:[A-Za-z0-9_-]{35}/g, '[REDACTED_BOT_TOKEN]')
    .trim();
}

/** Extract text from content (string or array of content blocks) */
function extractText(content: unknown): string {
  if (typeof content === 'string') return redactContent(content);
  if (Array.isArray(content)) {
    const joined = content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text || '')
      .join('\n')
      .slice(0, 4000);
    return redactContent(joined);
  }
  return '';
}

/** Find the sessions.json file for a given agent */
function findSessionsJson(agentId: string): string | null {
  const openclawHome = env.OPENCLAW_HOME;
  const sessionsPath = path.join(openclawHome, 'agents', agentId, 'sessions', 'sessions.json');
  if (fs.existsSync(sessionsPath)) return sessionsPath;
  return null;
}

/** Read session registry and map session key → sessionFile */
function resolveSessionFile(sessionKey: string): { sessionFile: string; sessionId: string } | null {
  // Extract agentId from session key (first segment after "agent:")
  const parts = sessionKey.split(':');
  const agentId = parts[0] === 'agent' ? parts[1] : parts[0] || 'main';

  const sessionsPath = findSessionsJson(agentId);
  if (!sessionsPath) return null;

  try {
    const raw = fs.readFileSync(sessionsPath, 'utf-8');
    const registry = JSON.parse(raw);

    // Try exact match first
    if (registry[sessionKey]?.sessionFile) {
      return {
        sessionFile: registry[sessionKey].sessionFile,
        sessionId: registry[sessionKey].sessionId,
      };
    }

    // Try partial match (session key might be truncated or formatted differently)
    for (const [key, entry] of Object.entries(registry)) {
      if (typeof entry === 'object' && entry !== null && 'sessionFile' in entry) {
        const e = entry as { sessionFile: string; sessionId: string };
        if (sessionKey.includes(key) || key.includes(sessionKey)) {
          return { sessionFile: e.sessionFile, sessionId: e.sessionId };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Parse JSONL transcript and extract normalized messages */
function parseTranscript(sessionFile: string, limit: number): Array<{
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  agentId?: string;
  model?: string;
}> {
  // Security: verify file exists and is within expected directory
  if (!fs.existsSync(sessionFile)) return [];

  const stat = fs.statSync(sessionFile);
  if (stat.size > MAX_FILE_SIZE) return [];
  if (!sessionFile.endsWith('.jsonl')) return [];

  // Verify file is in the expected sessions directory
  const sessionsDir = path.join(env.OPENCLAW_HOME, 'agents');
  const realPath = fs.realpathSync(sessionFile);
  if (!realPath.startsWith(sessionsDir)) return [];

  const raw = fs.readFileSync(sessionFile, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  const messages: Array<{
    role: 'user' | 'assistant';
    text: string;
    timestamp: string;
    agentId?: string;
    model?: string;
  }> = [];

  // Read newest entries first so long transcripts return the latest conversation,
  // then restore chronological order for the browser timeline.
  for (let index = lines.length - 1; index >= 0 && messages.length < limit; index -= 1) {
    const line = lines[index];

    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'message') continue;

      const msg = entry.message;
      if (!msg || !msg.role) continue;

      // Only include user and assistant messages
      if (msg.role !== 'user' && msg.role !== 'assistant') continue;

      // Skip error messages and failed turns
      if (msg.stopReason === 'error' || msg.stopReason === 'aborted') continue;

      const text = extractText(msg.content);
      if (!text || text.startsWith('[assistant turn failed')) continue;

      messages.push({
        role: msg.role,
        text,
        timestamp: entry.timestamp || msg.timestamp || '',
        agentId: msg.agentId || msg.provider,
        model: msg.model,
      });
    } catch {
      // Skip malformed lines
    }
  }

  return messages.reverse();
}

// ── Transcript endpoint ──────────────────────────────────────
transcriptRouter.get('/transcript/:sessionKey', (req, res) => {
  const { sessionKey } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, MAX_MESSAGES);

  if (!sessionKey || typeof sessionKey !== 'string') {
    res.status(400).json({ error: 'sessionKey is required' });
    return;
  }

  // Security: reject traversal attempts
  if (sessionKey.includes('..') || sessionKey.includes('/') || sessionKey.includes('\\')) {
    res.status(400).json({ error: 'Invalid session key' });
    return;
  }

  const resolved = resolveSessionFile(sessionKey);
  if (!resolved) {
    res.json({
      data: [],
      source: 'EMPTY',
      observedAt: new Date().toISOString(),
      stale: false,
      note: 'Session not found in registry',
    });
    return;
  }

  const messages = parseTranscript(resolved.sessionFile, limit);

  res.json({
    data: messages,
    source: 'REAL',
    observedAt: new Date().toISOString(),
    stale: false,
    sessionId: resolved.sessionId,
    count: messages.length,
  });
});
