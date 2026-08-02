/* ────────────────────────────────────────────────────────────
   Gateway device identity — stable device ID + keypair
   ──────────────────────────────────────────────────────────── */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface DeviceIdentity {
  deviceId: string;
  publicKey: string;
  privateKeyPem: string;
}

let _cached: DeviceIdentity | null = null;

export function getOrCreateDeviceIdentity(lastclawHome: string): DeviceIdentity {
  if (_cached) return _cached;

  const identityDir = path.join(lastclawHome, '.gateway-identity');
  const identityFile = path.join(identityDir, 'device.json');

  try {
    if (fs.existsSync(identityFile)) {
      const raw = JSON.parse(fs.readFileSync(identityFile, 'utf-8'));
      if (raw.deviceId && raw.publicKey && raw.privateKeyPem) {
        _cached = raw as DeviceIdentity;
        return _cached;
      }
    }
  } catch {
    // corrupt identity, regenerate
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const deviceId = `lastclaw-${crypto.randomBytes(8).toString('hex')}`;
  const identity: DeviceIdentity = {
    deviceId,
    publicKey,
    privateKeyPem: privateKey,
  };

  try {
    fs.mkdirSync(identityDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(identityFile, JSON.stringify(identity, null, 2), { mode: 0o600 });
  } catch {
    // non-fatal — in-memory identity only
  }

  _cached = identity;
  return _cached;
}

export function signNonce(identity: DeviceIdentity, nonce: string): string {
  const key = crypto.createPrivateKey(identity.privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(nonce), key);
  return sig.toString('base64');
}
