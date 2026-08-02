/* ────────────────────────────────────────────────────────────
   Gateway device identity — stable device ID + keypair
   Matches OpenClaw's device-identity.ts fingerprint and signing.
   ──────────────────────────────────────────────────────────── */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export interface DeviceIdentity {
  deviceId: string;
  publicKey: string;
  privateKeyPem: string;
}

let _cached: DeviceIdentity | null = null;

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const spki = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  if (spki.length === ED25519_SPKI_PREFIX.length + 32
    && spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fingerprintPublicKey(publicKeyPem: string): string {
  const raw = derivePublicKeyRaw(publicKeyPem);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Return the raw 32-byte Ed25519 public key as base64url (what the Gateway expects in device.publicKey). */
export function publicKeyRawBase64Url(publicKeyPem: string): string {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

function normalizeDeviceMetadataForAuth(value: string | undefined): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 128);
}

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

  const deviceId = fingerprintPublicKey(publicKey);
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

/**
 * Build the structured device auth payload and sign it.
 * Matches OpenClaw's buildDeviceAuthPayloadV3 + signDevicePayload.
 */
export function signDevicePayload(
  identity: DeviceIdentity,
  params: {
    clientId: string;
    clientMode: string;
    role: string;
    scopes: string[];
    signedAtMs: number;
    token: string | undefined;
    nonce: string;
    platform: string;
    deviceFamily: string | undefined;
  },
): string {
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';
  const platform = normalizeDeviceMetadataForAuth(params.platform);
  const deviceFamily = normalizeDeviceMetadataForAuth(params.deviceFamily);

  const payload = [
    'v3',
    identity.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join('|');

  const key = crypto.createPrivateKey(identity.privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), key);
  return base64UrlEncode(sig);
}
