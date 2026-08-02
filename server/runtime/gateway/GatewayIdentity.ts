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

  // Derive device ID from public key fingerprint (SHA-256 of raw Ed25519 key bytes)
  // OpenClaw strips the 12-byte SPKI prefix before hashing
  const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
  const spki = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
  const rawKey = spki.length === ED25519_SPKI_PREFIX.length + 32
    && spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
    ? spki.subarray(ED25519_SPKI_PREFIX.length)
    : spki;
  const fingerprint = crypto.createHash('sha256').update(rawKey).digest('hex');
  const deviceId = fingerprint;
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
