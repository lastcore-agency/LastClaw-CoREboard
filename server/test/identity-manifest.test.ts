import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadInstallationManifest, defaultSixSquadManifest, InstallationManifest } from '../config/manifest.js';
import { OpenClawAdapter } from '../runtime/OpenClawAdapter.js';

describe('Identity Manifest', () => {
  const tmpDir = path.join(os.tmpdir(), 'lastclaw-tests-' + Date.now());
  const customManifestPath = path.join(tmpDir, 'installation.json');
  let originalEnv: string | undefined;

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    originalEnv = process.env.LASTCLAW_INSTALLATION_PATH;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.env.LASTCLAW_INSTALLATION_PATH = originalEnv;
  });

  it('Default manifest loads when no installation file exists', () => {
    process.env.LASTCLAW_INSTALLATION_PATH = customManifestPath; // file doesn't exist
    const manifest = loadInstallationManifest();
    expect(manifest).toEqual(defaultSixSquadManifest);
  });

  it('A configured installation manifest overrides the default', () => {
    const custom: InstallationManifest = {
      schemaVersion: 1,
      installationId: 'test-custom',
      runtimeTarget: 'test-target',
      teamPack: 'test-pack',
      agents: {
        'custom-canon': { runtimeAgentId: 'custom-runtime' }
      }
    };
    fs.writeFileSync(customManifestPath, JSON.stringify(custom));
    process.env.LASTCLAW_INSTALLATION_PATH = customManifestPath;

    const manifest = loadInstallationManifest();
    expect(manifest.installationId).toBe('test-custom');
    expect(manifest.agents['custom-canon']).toBeDefined();
  });

  it('six-squad runtime main resolves to canonical sirius', () => {
    // using default manifest
    process.env.LASTCLAW_INSTALLATION_PATH = customManifestPath; // file doesn't exist
    const adapter = new OpenClawAdapter();
    const rawAgents = [{ id: 'main', availability: 'ONLINE' }];
    const canonical = adapter['mapToCanonicalAgents'](rawAgents);
    
    expect(canonical[0].id).toBe('sirius');
    expect(canonical[0].canonicalId).toBe('sirius');
    expect(canonical[0].runtimeAgentId).toBe('main');
  });

  it('API preserves runtimeAgentId main', () => {
    const adapter = new OpenClawAdapter();
    const rawAgents = [{ id: 'main', availability: 'WORKING' }];
    const canonical = adapter['mapToCanonicalAgents'](rawAgents);
    expect(canonical[0].runtimeAgentId).toBe('main');
  });

  it('runtime key equals six-squad:main', () => {
    const adapter = new OpenClawAdapter();
    const rawAgents = [{ id: 'main' }];
    const canonical = adapter['mapToCanonicalAgents'](rawAgents);
    expect(canonical[0].runtimeKey).toBe('six-squad:main');
  });

  it('main on another runtime target does not automatically become Sirius', () => {
    const custom: InstallationManifest = {
      schemaVersion: 1,
      installationId: 'other',
      runtimeTarget: 'other-target',
      teamPack: 'other-pack',
      agents: {
        'some-other': { runtimeAgentId: 'main' }
      }
    };
    fs.writeFileSync(customManifestPath, JSON.stringify(custom));
    process.env.LASTCLAW_INSTALLATION_PATH = customManifestPath;

    const adapter = new OpenClawAdapter();
    const rawAgents = [{ id: 'main' }];
    const canonical = adapter['mapToCanonicalAgents'](rawAgents);
    
    expect(canonical[0].id).toBe('some-other');
    expect(canonical[0].runtimeKey).toBe('other-target:main');
  });

  it('missing availability remains UNKNOWN on the server', () => {
    const adapter = new OpenClawAdapter();
    const rawAgents = [{ id: 'main' }]; // no availability
    const canonical = adapter['mapToCanonicalAgents'](rawAgents);
    expect(canonical[0].availability).toBe('UNKNOWN');
  });

  it('UNKNOWN maps to offline in the UI (Server side is UNKNOWN)', () => {
    const adapter = new OpenClawAdapter();
    const rawAgents = [{ id: 'main', availability: 'BOGUS' }];
    const canonical = adapter['mapToCanonicalAgents'](rawAgents);
    expect(canonical[0].availability).toBe('UNKNOWN');
  });

  it('known SiX-SQUAD runtime data produces exactly six canonical Agents', () => {
    const adapter = new OpenClawAdapter();
    const rawAgents = [
      { id: 'main' }, { id: 'altair' }, { id: 'antares' }, 
      { id: 'capella' }, { id: 'draco' }, { id: 'polaris' }
    ];
    process.env.LASTCLAW_INSTALLATION_PATH = '';
    const canonical = adapter['mapToCanonicalAgents'](rawAgents);
    
    expect(canonical).toHaveLength(6);
    const ids = canonical.map((a: any) => a.id).sort();
    expect(ids).toEqual(['altair', 'antares', 'capella', 'draco', 'polaris', 'sirius']);
  });

  it('an unmapped runtime Agent remains neutral', () => {
    const adapter = new OpenClawAdapter();
    const rawAgents = [{ id: 'unmapped-agent' }];
    process.env.LASTCLAW_INSTALLATION_PATH = '';
    const canonical = adapter['mapToCanonicalAgents'](rawAgents);
    
    expect(canonical[0].id).toBe('unmapped-agent');
    expect(canonical[0].canonicalId).toBe('unmapped-agent');
    expect(canonical[0].runtimeAgentId).toBe('unmapped-agent');
  });

  it('workspace ~ expansion works without hard-coding /home/lastcore', () => {
    const adapter = new OpenClawAdapter();
    const rawAgents = [{ id: 'main', workspace: '~/some/path' }];
    const canonical = adapter['mapToCanonicalAgents'](rawAgents);
    
    expect(canonical[0].workspace).toBe(path.join(os.homedir(), 'some/path'));
  });

  it('malformed installation manifest fails safely without exposing credentials', () => {
    fs.writeFileSync(customManifestPath, '{ malformed json');
    process.env.LASTCLAW_INSTALLATION_PATH = customManifestPath;

    const manifest = loadInstallationManifest();
    expect(manifest).toEqual(defaultSixSquadManifest);
  });
});
