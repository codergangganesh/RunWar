// InsForge Edge Function: send-push-notification
// Sends a Web Push notification to all active subscriptions for a user.
// Called by process-alarms (server-side) or directly for test notifications.
// Uses pure Deno Web Crypto VAPID — no npm dependencies.
// Self-contained: includes inlined VAPID + Web Push helpers.

declare const Deno: any;

// ══════════════════════════════════════════════════════════════════════════════
// INLINED: _shared/vapid.ts — VAPID + Web Push (RFC 8030 / RFC 8188)
// ══════════════════════════════════════════════════════════════════════════════

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
  audience: string,
  subject: string,
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

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );

  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);

  const receiverPublicKey = await crypto.subtle.importKey(
    'raw',
    receiverPublicKeyBytes as any,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPublicKey },
    serverKeyPair.privateKey,
    256,
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prk = await deriveHKDF(
    new Uint8Array(sharedSecret as ArrayBuffer),
    authSecret,
    concat(new TextEncoder().encode('WebPush: info\x00'), receiverPublicKeyBytes, new Uint8Array(serverPublicKeyRaw)),
    32,
  );

  const cek = await deriveHKDF(prk, salt, new TextEncoder().encode('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = await deriveHKDF(prk, salt, new TextEncoder().encode('Content-Encoding: nonce\x00'), 12);

  const cekKey = await crypto.subtle.importKey('raw', cek as any, 'AES-GCM', false, ['encrypt']);

  const plaintextBytes = new TextEncoder().encode(plaintext);
  const padded = new Uint8Array(plaintextBytes.length + 1);
  padded.set(plaintextBytes);
  padded[plaintextBytes.length] = 2;

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as any, tagLength: 128 },
    cekKey,
    padded,
  );

  const recordSize = 4096;
  const keyIdLen = serverPublicKeyRaw.byteLength;
  const header = new Uint8Array(16 + 4 + 1 + keyIdLen);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = keyIdLen;
  header.set(new Uint8Array(serverPublicKeyRaw), 21);

  const body = concat(header, new Uint8Array(ciphertext));

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
  const key = await crypto.subtle.importKey('raw', ikm as any, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as any, info: info as any },
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

interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface VapidConfig {
  privateKeyJwk: object;
  publicKeyBase64: string;
  subject: string;
}

async function sendWebPush(
  subscription: PushSub,
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
    body: body as any,
  });

  const expired = res.status === 404 || res.status === 410;
  if (!res.ok && !expired) {
    const text = await res.text().catch(() => '');
    console.error(`[vapid] Push failed ${res.status}:`, text);
  }

  return { status: res.status, ok: res.ok, expired };
}

function getVapidConfig(): VapidConfig {
  const privateKeyJwkRaw = Deno.env.get('VAPID_PRIVATE_KEY_JWK') ?? '';
  const privateKeyRaw = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const publicKeyBase64 = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@runwar.app';

  if (!publicKeyBase64 || (!privateKeyJwkRaw && !privateKeyRaw)) {
    throw new Error('VAPID secrets not configured');
  }

  let privateKeyJwk: object;
  if (privateKeyJwkRaw) {
    try {
      privateKeyJwk = JSON.parse(privateKeyJwkRaw);
    } catch {
      throw new Error('VAPID_PRIVATE_KEY_JWK is not valid JSON');
    }
  } else {
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

// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: send-push-notification
// ══════════════════════════════════════════════════════════════════════════════

const INSFORGE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? 'https://7p7ewmvi.us-east.insforge.app';
const SERVICE_ROLE_KEY = Deno.env.get('API_KEY') ?? Deno.env.get('ANON_KEY') ?? 'ik_9d2a844d3d742c432e4c93745a27c78d';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

async function dbQuery(
  table: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  params?: string,
  body?: any,
) {
  const url = `${INSFORGE_URL}/api/database/records/${table}${params ? '?' + params : ''}`;
  const bodyPayload = method === 'POST' && body && !Array.isArray(body) ? [body] : body;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Prefer': method === 'POST' ? 'return=representation' : (method === 'PATCH' ? 'return=representation' : 'return=minimal'),
    },
    body: bodyPayload ? JSON.stringify(bodyPayload) : undefined,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`DB ${method} ${table} failed (${res.status}): ${err}`);
  }
  return method === 'DELETE' ? null : res.json().catch(() => null);
}

function isInsideQuietHours(startStr: string, endStr: string, tz: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const pMap: Record<string, string> = {};
    for (const p of parts) pMap[p.type] = p.value;
    const curHour = parseInt(pMap.hour === '24' ? '0' : pMap.hour, 10);
    const curMin = parseInt(pMap.minute, 10);
    const curTimeVal = curHour * 60 + curMin;

    const [sH, sM] = startStr.split(':').map((v) => parseInt(v, 10));
    const [eH, eM] = endStr.split(':').map((v) => parseInt(v, 10));
    const startTimeVal = sH * 60 + (sM || 0);
    const endTimeVal = eH * 60 + (eM || 0);

    if (startTimeVal > endTimeVal) {
      return curTimeVal >= startTimeVal || curTimeVal < endTimeVal;
    } else {
      return curTimeVal >= startTimeVal && curTimeVal < endTimeVal;
    }
  } catch {
    return false;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  let reqBody: any;
  try {
    reqBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
  }

  const { notificationId, userId, title, body: msgBody, url = '/', type = 'system', data = {}, delaySeconds = 0 } = reqBody;

  if (!notificationId || !userId || !title || !msgBody) {
    return new Response(
      JSON.stringify({ error: 'notificationId, userId, title, and body are required' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const safeTitle = String(title).slice(0, 100);
  const safeBody = String(msgBody).slice(0, 500);

  if (typeof delaySeconds === 'number' && delaySeconds > 0) {
    console.log(`[send-push] Waiting ${delaySeconds}s before delivering push...`);
    await new Promise((resolve) => setTimeout(resolve, Math.min(delaySeconds, 60) * 1000));
  }

  console.log(`[send-push] Processing notification ${notificationId} for user ${userId}`);

  try {
    const notifData: any[] = await dbQuery('notifications', 'GET',
      `id=eq.${notificationId}&user_id=eq.${userId}&select=id,status`
    );
    if (!notifData || notifData.length === 0) {
      return new Response(JSON.stringify({ error: 'Notification not found or does not belong to user' }), {
        status: 404, headers: corsHeaders
      });
    }
    const notif = notifData[0];
    if (notif.status === 'sent') {
      console.log(`[send-push] Already sent, skipping: ${notificationId}`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'already_sent' }), {
        status: 200, headers: corsHeaders
      });
    }

    // 1b. Check user notification preferences from user_settings
    let userPref: any = null;
    try {
      const settingsList: any[] = await dbQuery('user_settings', 'GET',
        `user_id=eq.${userId}&select=notifications_enabled,push_enabled,notif_running_reminders,notif_goals,notif_challenges,notif_social,notif_achievements,notif_system,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,quiet_hours_allow_alarms`
      );
      if (settingsList && settingsList.length > 0) {
        userPref = settingsList[0];
      }
    } catch (prefErr: any) {
      console.warn(`[send-push] Could not load user_settings for ${userId}:`, prefErr?.message);
    }

    const isTestNotification = (data && data.isTest === true) || type === 'test' || reqBody.subtype === 'test';

    if (userPref && !isTestNotification) {
      // Check master notifications switch
      if (userPref.notifications_enabled === false) {
        console.log(`[send-push] User ${userId} has master notifications disabled. Skipping push.`);
        await dbQuery('notifications', 'PATCH',
          `id=eq.${notificationId}`,
          { status: 'cancelled', updated_at: new Date().toISOString() }
        );
        return new Response(JSON.stringify({
          success: true,
          skipped: true,
          reason: 'master_notifications_disabled'
        }), { status: 200, headers: corsHeaders });
      }

      // Check category preferences
      const categoryMap: Record<string, string> = {
        alarm: 'notif_running_reminders',
        workout: 'notif_running_reminders',
        goal: 'notif_goals',
        challenge: 'notif_challenges',
        duel: 'notif_challenges',
        social: 'notif_social',
        kudos: 'notif_social',
        achievement: 'notif_achievements',
        badge: 'notif_achievements',
        streak: 'notif_achievements',
        system: 'notif_system',
      };

      const prefKey = categoryMap[type];
      if (prefKey && userPref[prefKey] === false) {
        console.log(`[send-push] User ${userId} has category '${prefKey}' disabled for type '${type}'. Skipping push.`);
        await dbQuery('notifications', 'PATCH',
          `id=eq.${notificationId}`,
          { status: 'cancelled', updated_at: new Date().toISOString() }
        );
        return new Response(JSON.stringify({
          success: true,
          skipped: true,
          reason: 'category_disabled',
          category: prefKey
        }), { status: 200, headers: corsHeaders });
      }

      // 🌙 Check Quiet Hours / Do Not Disturb window
      if (userPref.quiet_hours_enabled === true) {
        let userTz = 'Asia/Kolkata';
        try {
          const alarmList: any[] = await dbQuery('alarms', 'GET', `user_id=eq.${userId}&limit=1&select=timezone`);
          if (alarmList?.[0]?.timezone) userTz = alarmList[0].timezone;
        } catch {}

        const startStr = userPref.quiet_hours_start || '22:00';
        const endStr = userPref.quiet_hours_end || '06:00';
        const allowAlarms = userPref.quiet_hours_allow_alarms !== false;

        const inQuietHours = isInsideQuietHours(startStr, endStr, userTz);

        if (inQuietHours) {
          const isAlarm = type === 'alarm' || type === 'workout';
          if (isAlarm && allowAlarms) {
            console.log(`[send-push] Alarm overriding Quiet Hours for user ${userId}`);
          } else {
            console.log(`[send-push] Silencing push for user ${userId}: Quiet Hours active (${startStr} - ${endStr})`);
            await dbQuery('notifications', 'PATCH',
              `id=eq.${notificationId}`,
              { status: 'cancelled', updated_at: new Date().toISOString() }
            );
            return new Response(JSON.stringify({
              success: true,
              skipped: true,
              reason: 'quiet_hours_active',
              quietHours: { start: startStr, end: endStr }
            }), { status: 200, headers: corsHeaders });
          }
        }
      }
    }

    await dbQuery('notifications', 'PATCH',
      `id=eq.${notificationId}&status=eq.pending`,
      { status: 'processing', updated_at: new Date().toISOString() }
    );

    const vapid = getVapidConfig();

    const subs: any[] = await dbQuery('push_subscriptions', 'GET',
      `user_id=eq.${userId}&revoked_at=is.null&select=id,endpoint,p256dh,auth`
    ) || [];

    if (subs.length === 0) {
      console.log(`[send-push] No active subscriptions for user ${userId}`);
      await dbQuery('notifications', 'PATCH',
        `id=eq.${notificationId}`,
        { status: 'failed', updated_at: new Date().toISOString() }
      );
      return new Response(JSON.stringify({ success: false, reason: 'no_subscriptions' }), {
        status: 200, headers: corsHeaders
      });
    }

    const pushPayload = {
      title: safeTitle,
      body: safeBody,
      icon: '/logo.png',
      badge: '/logo.png',
      url,
      type,
      notificationId,
      data,
    };

    let sentCount = 0;
    let failedCount = 0;
    let revokedCount = 0;

    for (const sub of subs) {
      try {
        const result = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          pushPayload,
          vapid,
        );

        if (result.expired) {
          await dbQuery('push_subscriptions', 'PATCH',
            `id=eq.${sub.id}`,
            { revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          );
          revokedCount++;
          console.log(`[send-push] Revoked expired subscription ${sub.id}`);
        } else if (result.ok) {
          sentCount++;
          console.log(`[send-push] Sent to subscription ${sub.id} (${result.status})`);
        } else {
          failedCount++;
          console.warn(`[send-push] Failed subscription ${sub.id} status: ${result.status}`);
        }
      } catch (pushErr: any) {
        failedCount++;
        console.error(`[send-push] Error pushing to ${sub.id}:`, pushErr?.message);
      }
    }

    const finalStatus = sentCount > 0 ? 'sent' : 'failed';
    await dbQuery('notifications', 'PATCH',
      `id=eq.${notificationId}`,
      {
        status: finalStatus,
        sent_at: sentCount > 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }
    );

    console.log(`[send-push] Done: sent=${sentCount} failed=${failedCount} revoked=${revokedCount} → ${finalStatus}`);

    return new Response(JSON.stringify({
      success: finalStatus === 'sent',
      sent: sentCount,
      failed: failedCount,
      revoked: revokedCount,
      status: finalStatus,
    }), { status: 200, headers: corsHeaders });

  } catch (err: any) {
    console.error('[send-push] Unexpected error:', err?.message);
    try {
      await dbQuery('notifications', 'PATCH',
        `id=eq.${notificationId}`,
        { status: 'failed', updated_at: new Date().toISOString() }
      );
    } catch {}
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500, headers: corsHeaders
    });
  }
}
