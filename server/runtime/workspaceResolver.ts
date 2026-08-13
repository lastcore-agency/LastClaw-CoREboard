/* ────────────────────────────────────────────────────────────
   Canonical Agent Workspace Resolver
   Single source of truth for resolving per-agent workspace paths.
   ──────────────────────────────────────────────────────────── */

import fs from 'fs';
import path from 'path';
import os from 'os';
import JSON5 from 'json5';
import { env } from '../config/env.js';
import { loadInstallationManifest } from '../config/manifest.js';

export type WorkspaceResolutionSource = 'EXPLICIT' | 'DEFAULTS' | 'MANIFEST' | 'FALLBACK';

export interface WorkspaceResolutionSuccess {
  ok: true;
  agentId: string;
  workspacePath: string;
  source: WorkspaceResolutionSource;
}

export interface WorkspaceResolutionFailure {
  ok: false;
  agentId: string;
  error: 'WORKSPACE_NOT_RESOLVED' | 'CONFIG_PARSE_FAILED';
  message: string;
}

export type WorkspaceResolution = WorkspaceResolutionSuccess | WorkspaceResolutionFailure;

/** Expand leading ~ or ~/ to user homedir */
export function expandHome(filePath: string): string {
  if (!filePath) return '';
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath.replace(/^~(?=$|\/|\\)/, os.homedir());
}

/**
 * Known OpenClaw runtime agent IDs — populated from openclaw.json + manifest at runtime.
 * NOT hardcoded to any specific team. Kept for backward compat; prefer resolveAllAgentWorkspaces().
 * @deprecated Use resolveAllAgentWorkspaces() which reads from config+manifest dynamically.
 */
export const SIX_SQUAD_AGENT_IDS: readonly string[] = [];

/**
 * Reads OpenClaw config file safely.
 * Returns parsed object or null with error.
 */
export function readOpenClawConfigFile(customPath?: string): {
  config: any | null;
  exists: boolean;
  error?: string;
} {
  const configPath = customPath ? expandHome(customPath) : env.OPENCLAW_CONFIG_PATH;
  try {
    if (!fs.existsSync(configPath)) {
      return { config: null, exists: false };
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON5.parse(raw);
    return { config: parsed, exists: true };
  } catch (err: any) {
    return {
      config: null,
      exists: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Canonical Agent Workspace Resolver
 *
 * Logic:
 * 1. Read real OpenClaw config.
 * 2. Find agents.list[] where id === agentId (or matching runtime agent alias).
 * 3. If agent.workspace is defined -> use that workspace (source: EXPLICIT).
 * 4. If no explicit workspace -> consider agents.defaults.workspace (source: DEFAULTS).
 * 5. Non-main Safety:
 *    - For agentId !== 'main', if workspace cannot be resolved from explicit or defaults:
 *      DO NOT silently fall back to shared/main workspace!
 *      Return diagnostic failure: WORKSPACE_NOT_RESOLVED (agentId=<id>).
 *    - For agentId === 'main':
 *      If neither explicit nor defaults is present, fallback to OPENCLAW_HOME/workspace.
 */
export function resolveAgentWorkspace(
  agentId: string,
  options?: { configPath?: string; strictNonMain?: boolean }
): WorkspaceResolution {
  const id = (agentId || '').trim();
  if (!id) {
    return {
      ok: false,
      agentId: id,
      error: 'WORKSPACE_NOT_RESOLVED',
      message: 'Empty agentId provided',
    };
  }

  const { config, exists, error: parseError } = readOpenClawConfigFile(options?.configPath);

  if (parseError) {
    // If config exists but fails to parse, we must not silently ignore it for non-main
    if (id !== 'main') {
      return {
        ok: false,
        agentId: id,
        error: 'CONFIG_PARSE_FAILED',
        message: `Failed to parse OpenClaw config: ${parseError}`,
      };
    }
  }

  const agentsList: any[] = Array.isArray(config?.agents?.list) ? config.agents.list : [];
  const defaultsWorkspace: string | undefined = config?.agents?.defaults?.workspace;

  // 1. Search in config agents.list[]
  const matchedAgent = agentsList.find((a: any) => {
    if (!a || typeof a !== 'object') return false;
    if (a.id === id || a.agentId === id) return true;
    return false;
  });

  if (matchedAgent) {
    // 1a. Explicit workspace on agent entry
    if (typeof matchedAgent.workspace === 'string' && matchedAgent.workspace.trim() !== '') {
      const resolved = path.resolve(expandHome(matchedAgent.workspace.trim()));
      return {
        ok: true,
        agentId: id,
        workspacePath: resolved,
        source: 'EXPLICIT',
      };
    }

    // 1b. Fallback to agents.defaults.workspace
    if (typeof defaultsWorkspace === 'string' && defaultsWorkspace.trim() !== '') {
      const resolved = path.resolve(expandHome(defaultsWorkspace.trim()));
      return {
        ok: true,
        agentId: id,
        workspacePath: resolved,
        source: 'DEFAULTS',
      };
    }

    // 1c. Matched agent in config but has no explicit workspace and no default workspace
    if (id === 'main') {
      const fallbackPath = path.resolve(env.OPENCLAW_HOME, 'workspace');
      return {
        ok: true,
        agentId: id,
        workspacePath: fallbackPath,
        source: 'FALLBACK',
      };
    }

    // Non-main safety: MUST NOT fallback silently to shared workspace
    return {
      ok: false,
      agentId: id,
      error: 'WORKSPACE_NOT_RESOLVED',
      message: `Workspace not resolved for agent: ${id} (no explicit workspace and no defaults.workspace)`,
    };
  }

  // 2. Not in agents.list[] — check Installation Manifest
  const manifest = loadInstallationManifest();
  let manifestAgent = manifest.agents[id];
  if (!manifestAgent) {
    // Check if `id` is a runtimeAgentId in manifest
    for (const [, a] of Object.entries(manifest.agents)) {
      if (a.runtimeAgentId === id || (a.runtimeAliases && a.runtimeAliases.includes(id))) {
        manifestAgent = a;
        break;
      }
    }
  }

  if (manifestAgent && typeof manifestAgent.workspace === 'string' && manifestAgent.workspace.trim() !== '') {
    const resolved = path.resolve(expandHome(manifestAgent.workspace.trim()));
    return {
      ok: true,
      agentId: id,
      workspacePath: resolved,
      source: 'MANIFEST',
    };
  }

  // 3. Check defaults workspace if agent wasn't explicitly listed but config defaults exist
  // Note: For non-main agents that are completely unknown, safety rule requires WORKSPACE_NOT_RESOLVED
  // unless explicitly part of known installation or main agent.
  if (id === 'main') {
    if (typeof defaultsWorkspace === 'string' && defaultsWorkspace.trim() !== '') {
      const resolved = path.resolve(expandHome(defaultsWorkspace.trim()));
      return {
        ok: true,
        agentId: id,
        workspacePath: resolved,
        source: 'DEFAULTS',
      };
    }
    const fallbackPath = path.resolve(env.OPENCLAW_HOME, 'workspace');
    return {
      ok: true,
      agentId: id,
      workspacePath: fallbackPath,
      source: 'FALLBACK',
    };
  }

  // Non-main safety: Unknown / non-resolvable non-main agent
  return {
    ok: false,
    agentId: id,
    error: 'WORKSPACE_NOT_RESOLVED',
    message: `Workspace not resolved for agent: ${id} (agent not found in OpenClaw config or manifest)`,
  };
}

/**
 * Resolve all known workspaces from openclaw.json config + installation manifest.
 * Does NOT hardcode any team names — discovers agents dynamically.
 */
export function resolveAllAgentWorkspaces(options?: { configPath?: string }): {
  workspaces: Record<string, string>;
  details: Record<string, WorkspaceResolution>;
} {
  const { config } = readOpenClawConfigFile(options?.configPath);
  // Seed from config and manifest only — no hardcoded team list
  const agentIds = new Set<string>();

  if (Array.isArray(config?.agents?.list)) {
    for (const a of config.agents.list) {
      if (a?.id) agentIds.add(String(a.id));
      if (a?.agentId) agentIds.add(String(a.agentId));
    }
  }

  const manifest = loadInstallationManifest();
  if (manifest?.agents) {
    for (const [key, a] of Object.entries(manifest.agents)) {
      if (a?.runtimeAgentId) agentIds.add(a.runtimeAgentId);
      else agentIds.add(key);
    }
  }

  const workspaces: Record<string, string> = {};
  const details: Record<string, WorkspaceResolution> = {};

  for (const id of agentIds) {
    const res = resolveAgentWorkspace(id, options);
    details[id] = res;
    if (res.ok) {
      workspaces[id] = res.workspacePath;
    }
  }

  return { workspaces, details };
}
