/* ────────────────────────────────────────────────────────────
   Workspace — safe read-only server-side file access
   Rejects traversal, absolute paths, secrets, symlinks.
   Uses Canonical Agent Workspace Resolver for per-agent isolation.
   ──────────────────────────────────────────────────────────── */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { resolveAgentWorkspace, resolveAllAgentWorkspaces } from '../runtime/workspaceResolver.js';
import type { LastClawResponse } from '../runtime/types.js';

export const workspaceRouter = express.Router();

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

/** Resolve and validate workspace path using Canonical Resolver */
export function resolveWorkspacePath(
  agentId: string,
  filePath: string,
): { ok: true; resolved: string; root: string } | { ok: false; status: number; error: string; code: string } {
  const resolution = resolveAgentWorkspace(agentId);
  if (!resolution.ok) {
    return {
      ok: false,
      status: 404,
      error: `WORKSPACE_NOT_RESOLVED: agentId=${agentId}`,
      code: resolution.error || 'WORKSPACE_NOT_RESOLVED',
    };
  }

  const root = resolution.workspacePath;

  // Reject absolute paths
  if (path.isAbsolute(filePath)) {
    return { ok: false, status: 400, error: 'Absolute paths not allowed', code: 'INVALID_PATH' };
  }

  // Reject traversal
  if (filePath.includes('..')) {
    return { ok: false, status: 400, error: 'Path traversal not allowed', code: 'PATH_TRAVERSAL' };
  }

  const resolved = path.resolve(root, filePath);
  if (!resolved.startsWith(root)) {
    return { ok: false, status: 403, error: 'Path escapes workspace root', code: 'PATH_ESCAPES_ROOT' };
  }

  // Check for symlink escape
  try {
    const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : root;
    const realPath = fs.realpathSync(resolved);
    if (!realPath.startsWith(realRoot)) {
      return { ok: false, status: 403, error: 'Symlink escapes workspace root', code: 'SYMLINK_ESCAPES_ROOT' };
    }
  } catch {
    // File doesn't exist yet — that's fine for stat check
  }

  return { ok: true, resolved, root };
}

// ── Resolve workspace route (diagnostic endpoint) ───────────
workspaceRouter.get('/workspace/:agentId/resolve', (req, res) => {
  const { agentId } = req.params;
  const resolution = resolveAgentWorkspace(agentId);
  if (!resolution.ok) {
    res.status(404).json({
      data: null,
      source: 'ERROR',
      observedAt: new Date().toISOString(),
      stale: false,
      error: {
        code: resolution.error,
        message: resolution.message,
        agentId: resolution.agentId,
      },
    });
    return;
  }
  res.json({
    data: resolution,
    source: 'REAL',
    observedAt: new Date().toISOString(),
    stale: false,
  });
});

// ── List workspace files ────────────────────────────────────
workspaceRouter.get('/workspace/:agentId/files', (req, res) => {
  const { agentId } = req.params;
  const filePath = (req.query.path as string) || '';

  const validation = resolveWorkspacePath(agentId, filePath || '.');
  if (!validation.ok) {
    res.status(validation.status).json({
      error: validation.error,
      code: validation.code,
      agentId,
    });
    return;
  }

  try {
    const stat = fs.statSync(validation.resolved);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'Path is not a directory', code: 'NOT_A_DIRECTORY' });
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
      res.status(404).json({ error: 'Path not found', code: 'ENOENT' });
      return;
    }
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
  }
});

// ── Read a workspace file ───────────────────────────────────
workspaceRouter.get('/workspace/:agentId/file', (req, res) => {
  const { agentId } = req.params;
  const filePath = req.query.path as string;
  if (!filePath) {
    res.status(400).json({ error: 'path query param required', code: 'MISSING_PARAM' });
    return;
  }

  const validation = resolveWorkspacePath(agentId, filePath);
  if (!validation.ok) {
    res.status(validation.status).json({
      error: validation.error,
      code: validation.code,
      agentId,
    });
    return;
  }

  if (isSecretFile(filePath)) {
    res.status(403).json({ error: 'File blocked (secret/credential pattern)', code: 'FILE_BLOCKED' });
    return;
  }

  try {
    const stat = fs.statSync(validation.resolved);
    if (stat.isDirectory()) {
      res.status(400).json({ error: 'Path is a directory, not a file', code: 'IS_DIRECTORY' });
      return;
    }

    // Limit file size to 500KB
    if (stat.size > 500 * 1024) {
      res.status(413).json({ error: `File too large (${stat.size} bytes, max 500KB)`, code: 'FILE_TOO_LARGE' });
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
      res.status(404).json({ error: 'File not found', code: 'ENOENT' });
      return;
    }
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
  }
});
