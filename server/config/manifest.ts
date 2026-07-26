import fs from 'fs';
import path from 'path';
import os from 'os';
import JSON5 from 'json5';

export interface InstallationManifest {
  schemaVersion: 1;
  installationId: string;
  runtimeTarget: string;
  teamPack: string;
  agents: Record<string, {
    runtimeAgentId: string;
    runtimeAliases?: string[];
    publicName?: string;
    workspace?: string;
  }>;
}

export const defaultSixSquadManifest: InstallationManifest = {
  schemaVersion: 1,
  installationId: 'six-squad-local',
  runtimeTarget: 'six-squad',
  teamPack: 'six-squad',
  agents: {
    sirius: {
      runtimeAgentId: 'main',
      runtimeAliases: ['sirius']
    },
    draco: { runtimeAgentId: 'draco' },
    capella: { runtimeAgentId: 'capella' },
    antares: { runtimeAgentId: 'antares' },
    polaris: { runtimeAgentId: 'polaris' },
    altair: { runtimeAgentId: 'altair' }
  }
};

export function loadInstallationManifest(): InstallationManifest {
  const envPath = process.env.LASTCLAW_INSTALLATION_PATH;
  const defaultPath = path.join(os.homedir(), '.lastclaw', 'installation.json');
  
  const searchPaths = [];
  if (envPath) searchPaths.push(envPath.replace(/^~(?=$|\/|\\)/, os.homedir()));
  searchPaths.push(defaultPath);

  for (const p of searchPaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        return JSON5.parse(content) as InstallationManifest;
      }
    } catch (err) {
      console.warn(`Failed to parse installation manifest at ${p}:`, err);
    }
  }

  return defaultSixSquadManifest;
}
