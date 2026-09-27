// InsForge Edge Function shared helper: VAPID + Web Push (RFC 8030 / RFC 8188)
// Pure Deno Web Crypto — no npm dependencies
declare const Deno: any;

// ── VAPID JWT ─────────────────────────────────────────────────────────────────

function base64urlEncode(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '='));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function buildVapidJWT(
  audience: string,   // e.g. "https://fcm.googleapis.com"
  subject: string,    // e.g. "mailto:admin@runwar.app"
  privateKeyJwk: object,
): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT' };
  const claims = {
    aud: audience,
    sub: subject,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    iat: Math.floor(Date.now() / 1000),
  };

  const enc = (obj: object) =>
    base64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));

  const signingInput = `${enc(header)}.${enc(claims)}`;

  const key = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64urlEncode(sig)}`;
}

// ── Message Encryption (RFC 8188 — aes128gcm) ────────────────────────────────

async function encryptPushPayload(
  endpoint: string,
  p256dhBase64: string,
  authBase64: string,
  plaintext: string,
  vapidJwt: string,
  vapidPublicKeyBase64: string,
): Promise<{ body: Uint8Array; headers: Record<string, string> }> {
  const authSecret = base64urlDecode(authBase64);
  const receiverPublicKeyBytes = base64urlDecode(p256dhBase64);

  // Generate server ephemeral key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );

  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);

  // Import receiver's public key
  const receiverPublicKey = await crypto.subtle.importKey(
    'raw',
    receiverPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // ECDH shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPublicKey },
    serverKeyPair.privateKey,
    256,
  );

  // Salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Key derivation (RFC 8188 HKDF)
  const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey', 'deriveBits']);

  // PRK
  const prk = await deriveHKDF(
    new Uint8Array(sharedSecret),
    authSecret,
    concat(new TextEncoder().encode('WebPush: info\x00'), receiverPublicKeyBytes, new Uint8Array(serverPublicKeyRaw)),
    32,
  );

  // CEK (16 bytes)
  const cek = await deriveHKDF(prk, salt, new TextEncoder().encode('Content-Encoding: aes128gcm\x00'), 16);
  // Nonce (12 bytes)
  const nonce = await deriveHKDF(prk, salt, new TextEncoder().encode('Content-Encoding: nonce\x00'), 12);

  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);

  // Pad the plaintext (RFC 8188: prepend record size header + 1 byte pad delimiter)
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const padded = new Uint8Array(plaintextBytes.length + 1);
  padded.set(plaintextBytes);
  padded[plaintextBytes.length] = 2; // padding delimiter

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    cekKey,
    padded,
  );

  // Build aes128gcm content-encoding header (86 bytes)
  const recordSize = 4096;
  const keyIdLen = serverPublicKeyRaw.byteLength;
  const header = new Uint8Array(16 + 4 + 1 + keyIdLen);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = keyIdLen;
  header.set(new Uint8Array(serverPublicKeyRaw), 21);

  const body = concat(header, new Uint8Array(ciphertext));

  const audience = new URL(endpoint).origin;
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    'Authorization': `vapid t=${vapidJwt},k=${vapidPublicKeyBase64}`,
    'TTL': '86400',
  };

  return { body, headers };
}

async function deriveHKDF(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// ── Public Interface ──────────────────────────────────────────────────────────

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidConfig {
  privateKeyJwk: object;   // VAPID private key as JWK JSON
  publicKeyBase64: string; // VAPID public key as base64url
  subject: string;         // mailto: or https: URI
}

export async function sendWebPush(
  subscription: PushSubscription,
  payload: object,
  vapid: VapidConfig,
): Promise<{ status: number; ok: boolean; expired: boolean }> {
  const audience = new URL(subscription.endpoint).origin;
  const jwt = await buildVapidJWT(audience, vapid.subject, vapid.privateKeyJwk);
  const bodyStr = JSON.stringify(payload);

  const { body, headers } = await encryptPushPayload(
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth,
    bodyStr,
    jwt,
    vapid.publicKeyBase64,
  );

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: { ...headers, 'Content-Length': String(body.byteLength) },
    body,
  });

  const expired = res.status === 404 || res.status === 410;
  if (!res.ok && !expired) {
    const text = await res.text().catch(() => '');
    console.error(`[vapid] Push failed ${res.status}:`, text);
  }

  return { status: res.status, ok: res.ok, expired };
}

// ── Parse VAPID secrets from env ─────────────────────────────────────────────

export function getVapidConfig(): VapidConfig {
  const privateKeyJwkRaw = Deno.env.get('VAPID_PRIVATE_KEY_JWK') ?? '';
  const privateKeyRaw = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const publicKeyBase64 = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@runwar.app';

  if (!publicKeyBase64 || (!privateKeyJwkRaw && !privateKeyRaw)) {
    throw new Error('VAPID secrets not configured: set VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT in InsForge secrets');
  }

  let privateKeyJwk: object;
  if (privateKeyJwkRaw) {
    try {
      privateKeyJwk = JSON.parse(privateKeyJwkRaw);
    } catch {
      throw new Error('VAPID_PRIVATE_KEY_JWK is not valid JSON');
    }
  } else {
    // Auto-construct JWK from raw public (65 bytes) and private (32 bytes) keys
    const pubBytes = base64urlDecode(publicKeyBase64);
    const xBytes = pubBytes.slice(1, 33);
    const yBytes = pubBytes.slice(33, 65);
    privateKeyJwk = {
      kty: 'EC',
      crv: 'P-256',
      x: base64urlEncode(xBytes),
      y: base64urlEncode(yBytes),
      d: privateKeyRaw.trim(),
    };
  }

  return { privateKeyJwk, publicKeyBase64, subject };
}
