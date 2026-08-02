/* ────────────────────────────────────────────────────────────
   Workspace — safe read-only server-side file access
   Rejects traversal, absolute paths, secrets, symlinks
   ──────────────────────────────────────────────────────────── */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import type { LastClawResponse } from '../runtime/types.js';

export const workspaceRouter = express.Router();

/** Canonical workspace roots — uses OPENCLAW_HOME for shared workspace */
function getWorkspaceRoots(): Record<string, string> {
  const openclawHome = process.env.OPENCLAW_HOME || path.join(process.env.HOME || '~', '.openclaw');
  return {
    'shared': path.join(openclawHome, 'workspace'),
    'main': path.join(openclawHome, 'workspace'),
    'draco': path.join(openclawHome, 'workspace'),
    'polaris': path.join(openclawHome, 'workspace'),
    'antares': path.join(openclawHome, 'workspace'),
    'altair': path.join(openclawHome, 'workspace'),
    'capella': path.join(openclawHome, 'workspace'),
  };
}

/** Blocked filenames/patterns */
const BLOCKED_FILES = new Set([
  '.env', '.env.local', '.env.production', '.env.development',
  '.env.staging', '.env.test', '.env.backup',
  'credentials', 'credentials.json', 'credentials.yaml',
  '.env.json', '.env.yaml', '.env.yml',
  'secrets.json', 'secrets.yaml', 'secrets.yml',
  'service-account.json', 'service-account.yaml',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.pem', '.key', '.p12', '.pfx', '.jks',
  '.keystore', '.truststore',
]);

/** Detect if a path looks like a secret */
function isSecretFile(filePath: string): boolean {
  const basename = path.basename(filePath).toLowerCase();
  if (BLOCKED_FILES.has(basename)) return true;
  const ext = path.extname(filePath).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) return true;
  // Check for common secret patterns
  if (basename.includes('private') && (basename.endsWith('.key') || basename.endsWith('.pem'))) return true;
  if (basename.includes('secret') || basename.includes('credential') || basename.includes('password')) return true;
  return false;
}

/** Resolve and validate workspace path */
function resolveWorkspacePath(
  agentId: string,
  filePath: string,
): { ok: true; resolved: string; root: string } | { ok: false; status: number; error: string } {
  const roots = getWorkspaceRoots();
  const root = roots[agentId];
  if (!root) {
    return { ok: false, status: 404, error: `Unknown agent: ${agentId}` };
  }

  // Reject absolute paths
  if (path.isAbsolute(filePath)) {
    return { ok: false, status: 400, error: 'Absolute paths not allowed' };
  }

  // Reject traversal
  if (filePath.includes('..')) {
    return { ok: false, status: 400, error: 'Path traversal not allowed' };
  }

  const resolved = path.resolve(root, filePath);
  if (!resolved.startsWith(root)) {
    return { ok: false, status: 403, error: 'Path escapes workspace root' };
  }

  // Check for symlink escape
  try {
    const realPath = fs.realpathSync(resolved);
    if (!realPath.startsWith(root)) {
      return { ok: false, status: 403, error: 'Symlink escapes workspace root' };
    }
  } catch {
    // File doesn't exist yet — that's fine for stat check
  }

  return { ok: true, resolved, root };
}

// ── List workspace files ────────────────────────────────────
workspaceRouter.get('/workspace/:agentId/files', (req, res) => {
  const { agentId } = req.params;
  const filePath = (req.query.path as string) || '';

  const validation = resolveWorkspacePath(agentId, filePath || '.');
  if (!validation.ok) {
    res.status(validation.status).json({ error: validation.error });
    return;
  }

  try {
    const stat = fs.statSync(validation.resolved);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'Path is not a directory' });
      return;
    }

    const entries = fs.readdirSync(validation.resolved, { withFileTypes: true });
    const files = entries
      .filter(e => !e.name.startsWith('.'))
      .filter(e => !isSecretFile(e.name))
      .slice(0, 200) // Limit
      .map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
        path: filePath ? `${filePath}/${e.name}` : e.name,
        size: e.isFile() ? fs.statSync(path.join(validation.resolved, e.name)).size : undefined,
        modified: fs.statSync(path.join(validation.resolved, e.name)).mtime.toISOString(),
      }));

    res.json({
      data: files,
      source: 'REAL',
      observedAt: new Date().toISOString(),
      stale: false,
    } satisfies LastClawResponse<typeof files>);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Path not found' });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

// ── Read a workspace file ───────────────────────────────────
workspaceRouter.get('/workspace/:agentId/file', (req, res) => {
  const { agentId } = req.params;
  const filePath = req.query.path as string;
  if (!filePath) {
    res.status(400).json({ error: 'path query param required' });
    return;
  }

  const validation = resolveWorkspacePath(agentId, filePath);
  if (!validation.ok) {
    res.status(validation.status).json({ error: validation.error });
    return;
  }

  if (isSecretFile(filePath)) {
    res.status(403).json({ error: 'File blocked (secret/credential pattern)' });
    return;
  }

  try {
    const stat = fs.statSync(validation.resolved);
    if (stat.isDirectory()) {
      res.status(400).json({ error: 'Path is a directory, not a file' });
      return;
    }

    // Limit file size to 500KB
    if (stat.size > 500 * 1024) {
      res.status(413).json({ error: `File too large (${stat.size} bytes, max 500KB)` });
      return;
    }

    const content = fs.readFileSync(validation.resolved, 'utf-8');
    res.json({
      data: {
        path: filePath,
        name: path.basename(filePath),
        size: stat.size,
        modified: stat.mtime.toISOString(),
        content,
        encoding: 'utf-8',
      },
      source: 'REAL',
      observedAt: new Date().toISOString(),
      stale: false,
    });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});
