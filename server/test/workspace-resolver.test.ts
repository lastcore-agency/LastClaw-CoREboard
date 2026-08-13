import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  resolveAgentWorkspace,
  resolveAllAgentWorkspaces,
  expandHome,
  readOpenClawConfigFile,
} from '../runtime/workspaceResolver.js';
import { resolveWorkspacePath } from '../routes/workspace.js';

describe('Canonical Agent Workspace Resolver', () => {
  let tmpDir: string;
  let configPath: string;
  let origEnvConfig: string | undefined;
  let origOpenclawHome: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lastclaw-workspace-test-'));
    configPath = path.join(tmpDir, 'openclaw.json');
    origEnvConfig = process.env.OPENCLAW_CONFIG_PATH;
    origOpenclawHome = process.env.OPENCLAW_HOME;
    process.env.OPENCLAW_CONFIG_PATH = configPath;
    process.env.OPENCLAW_HOME = path.join(tmpDir, '.openclaw');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.env.OPENCLAW_CONFIG_PATH = origEnvConfig;
    process.env.OPENCLAW_HOME = origOpenclawHome;
  });

  // ── CASE 1: agent has explicit workspace ─────────────────────
  it('CASE 1: agent with explicit workspace returns explicit workspace', () => {
    const customWorkspace = path.join(tmpDir, 'draco-workspace');
    fs.mkdirSync(customWorkspace, { recursive: true });

    const configContent = `
    {
      agents: {
        defaults: {
          workspace: "${path.join(tmpDir, 'default-workspace').replace(/\\/g, '/')}",
        },
        list: [
          { id: 'main', workspace: "${path.join(tmpDir, 'main-workspace').replace(/\\/g, '/')}" },
          { id: 'draco', workspace: "${customWorkspace.replace(/\\/g, '/')}" }
        ]
      }
    }`;
    fs.writeFileSync(configPath, configContent);

    const result = resolveAgentWorkspace('draco', { configPath });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workspacePath).toBe(path.resolve(customWorkspace));
      expect(result.source).toBe('EXPLICIT');
      expect(result.agentId).toBe('draco');
    }
  });

  // ── CASE 2: agent has no explicit workspace -> fallback defaults.workspace ─
  it('CASE 2: agent without explicit workspace falls back to defaults.workspace', () => {
    const defaultWorkspace = path.join(tmpDir, 'default-workspace');
    fs.mkdirSync(defaultWorkspace, { recursive: true });

    const configContent = `
    {
      agents: {
        defaults: {
          workspace: "${defaultWorkspace.replace(/\\/g, '/')}",
        },
        list: [
          { id: 'polaris' } // No explicit workspace
        ]
      }
    }`;
    fs.writeFileSync(configPath, configContent);

    const result = resolveAgentWorkspace('polaris', { configPath });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workspacePath).toBe(path.resolve(defaultWorkspace));
      expect(result.source).toBe('DEFAULTS');
      expect(result.agentId).toBe('polaris');
    }
  });

  // ── CASE 3: unknown/non-resolvable non-main agent -> diagnostic/error ──────
  it('CASE 3: unknown/non-resolvable non-main agent returns diagnostic error and NEVER silent shared workspace', () => {
    // Config without defaults and without altair
    const configContent = `
    {
      agents: {
        list: [
          { id: 'main', workspace: "${path.join(tmpDir, 'main-ws').replace(/\\/g, '/')}" }
        ]
      }
    }`;
    fs.writeFileSync(configPath, configContent);

    // Test unknown non-main agent
    const resultUnknown = resolveAgentWorkspace('unknown_agent_99', { configPath });
    expect(resultUnknown.ok).toBe(false);
    if (!resultUnknown.ok) {
      expect(resultUnknown.error).toBe('WORKSPACE_NOT_RESOLVED');
      expect(resultUnknown.agentId).toBe('unknown_agent_99');
      expect(resultUnknown.message).toContain('unknown_agent_99');
    }

    // Test non-main known agent with NO explicit workspace and NO default workspace
    const configWithNoWs = `
    {
      agents: {
        list: [
          { id: 'capella' }
        ]
      }
    }`;
    fs.writeFileSync(configPath, configWithNoWs);
    const resultCapella = resolveAgentWorkspace('capella', { configPath });
    expect(resultCapella.ok).toBe(false);
    if (!resultCapella.ok) {
      expect(resultCapella.error).toBe('WORKSPACE_NOT_RESOLVED');
      expect(resultCapella.agentId).toBe('capella');
    }

    // Ensure route returns 404 / WORKSPACE_NOT_RESOLVED and not shared workspace files
    const routeValidation = resolveWorkspacePath('capella', 'some-file.txt');
    expect(routeValidation.ok).toBe(false);
    if (!routeValidation.ok) {
      expect(routeValidation.code).toBe('WORKSPACE_NOT_RESOLVED');
      expect(routeValidation.error).toContain('WORKSPACE_NOT_RESOLVED: agentId=capella');
    }
  });

  // ── CASE 4: Agent A and Agent B have different workspaces ─────
  it('CASE 4: Agent A and Agent B have distinct workspaces and resolver returns distinct paths', () => {
    const wsA = path.join(tmpDir, 'workspace-sirius-main');
    const wsB = path.join(tmpDir, 'workspace-draco-ui');
    const wsC = path.join(tmpDir, 'workspace-polaris-orch');
    fs.mkdirSync(wsA, { recursive: true });
    fs.mkdirSync(wsB, { recursive: true });
    fs.mkdirSync(wsC, { recursive: true });

    // Put different files in each workspace to verify distinct content
    fs.writeFileSync(path.join(wsA, 'IDENTITY.md'), '# Sirius Lead');
    fs.writeFileSync(path.join(wsB, 'IDENTITY.md'), '# Draco Frontend');
    fs.writeFileSync(path.join(wsC, 'IDENTITY.md'), '# Polaris Orchestrator');

    const configContent = `
    {
      agents: {
        list: [
          { id: 'main', workspace: "${wsA.replace(/\\/g, '/')}" },
          { id: 'draco', workspace: "${wsB.replace(/\\/g, '/')}" },
          { id: 'polaris', workspace: "${wsC.replace(/\\/g, '/')}" }
        ]
      }
    }`;
    fs.writeFileSync(configPath, configContent);

    const resA = resolveAgentWorkspace('main', { configPath });
    const resB = resolveAgentWorkspace('draco', { configPath });
    const resC = resolveAgentWorkspace('polaris', { configPath });

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
    expect(resC.ok).toBe(true);

    if (resA.ok && resB.ok && resC.ok) {
      expect(resA.workspacePath).toBe(path.resolve(wsA));
      expect(resB.workspacePath).toBe(path.resolve(wsB));
      expect(resC.workspacePath).toBe(path.resolve(wsC));
      expect(resA.workspacePath).not.toBe(resB.workspacePath);
      expect(resB.workspacePath).not.toBe(resC.workspacePath);
      expect(resA.workspacePath).not.toBe(resC.workspacePath);
    }

    // Verify resolveWorkspacePath routes resolve correctly to distinct files
    const fileA = resolveWorkspacePath('main', 'IDENTITY.md');
    const fileB = resolveWorkspacePath('draco', 'IDENTITY.md');
    expect(fileA.ok).toBe(true);
    expect(fileB.ok).toBe(true);
    if (fileA.ok && fileB.ok) {
      expect(fs.readFileSync(fileA.resolved, 'utf-8')).toBe('# Sirius Lead');
      expect(fs.readFileSync(fileB.resolved, 'utf-8')).toBe('# Draco Frontend');
    }
  });

  // ── Extra Safety: Home directory expansion (~/...) ───────────
  it('expands leading tilde (~) in workspace paths', () => {
    const configContent = `
    {
      agents: {
        list: [
          { id: 'antares', workspace: '~/test-antares-ws' }
        ]
      }
    }`;
    fs.writeFileSync(configPath, configContent);

    const result = resolveAgentWorkspace('antares', { configPath });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workspacePath).toBe(path.join(os.homedir(), 'test-antares-ws'));
      expect(result.source).toBe('EXPLICIT');
    }
  });

  // ── Extra Safety: resolveAllAgentWorkspaces maps accurately ───
  it('resolveAllAgentWorkspaces resolves all defined agents and isolates workspaces', () => {
    const configContent = `
    {
      agents: {
        defaults: { workspace: "${path.join(tmpDir, 'common-default').replace(/\\/g, '/')}" },
        list: [
          { id: 'main', workspace: "${path.join(tmpDir, 'ws-main').replace(/\\/g, '/')}" },
          { id: 'draco', workspace: "${path.join(tmpDir, 'ws-draco').replace(/\\/g, '/')}" },
          { id: 'polaris' } // defaults
        ]
      }
    }`;
    fs.writeFileSync(configPath, configContent);

    const { workspaces, details } = resolveAllAgentWorkspaces({ configPath });
    expect(workspaces['main']).toBe(path.resolve(tmpDir, 'ws-main'));
    expect(workspaces['draco']).toBe(path.resolve(tmpDir, 'ws-draco'));
    expect(workspaces['polaris']).toBe(path.resolve(tmpDir, 'common-default'));
    expect(details['main'].ok).toBe(true);
    expect(details['draco'].ok).toBe(true);
    expect(details['polaris'].ok).toBe(true);
  });
});
