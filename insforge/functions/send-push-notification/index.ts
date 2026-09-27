// InsForge Edge Function: send-push-notification
// Sends a Web Push notification to all active subscriptions for a user.
// Called by process-alarms (server-side) or directly for test notifications.
// Uses pure Deno Web Crypto VAPID — no npm dependencies.

declare const Deno: any;
import { sendWebPush, getVapidConfig } from '../_shared/vapid.ts';

const INSFORGE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? Deno.env.get('INSFORGE_URL') ?? 'https://7p7ewmvi.us-east.insforge.app';
const SERVICE_ROLE_KEY = Deno.env.get('API_KEY') ?? Deno.env.get('ANON_KEY') ?? Deno.env.get('INSFORGE_SERVICE_ROLE_KEY') ?? 'ik_9d2a844d3d742c432e4c93745a27c78d';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// ── DB helper using service role (bypasses RLS) ───────────────────────────────

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

// ── Quiet Hours helper ───────────────────────────────────────────────────────

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

// ── Main handler ─────────────────────────────────────────────────────────────

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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
  }

  const { notificationId, userId, title, body: msgBody, url = '/', type = 'system', data = {}, delaySeconds = 0 } = body;

  // Input validation
  if (!notificationId || !userId || !title || !msgBody) {
    return new Response(
      JSON.stringify({ error: 'notificationId, userId, title, and body are required' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Sanitize text content
  const safeTitle = String(title).slice(0, 100);
  const safeBody = String(msgBody).slice(0, 500);

  if (typeof delaySeconds === 'number' && delaySeconds > 0) {
    console.log(`[send-push] Waiting ${delaySeconds}s before delivering push...`);
    await new Promise((resolve) => setTimeout(resolve, Math.min(delaySeconds, 60) * 1000));
  }

  console.log(`[send-push] Processing notification ${notificationId} for user ${userId}`);

  try {
    // 1. Idempotency check — verify notification exists and isn't already sent
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

    const isTestNotification = (data && data.isTest === true) || type === 'test' || body.subtype === 'test';

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

    // 2. Mark as processing (atomic guard)
    await dbQuery('notifications', 'PATCH',
      `id=eq.${notificationId}&status=eq.pending`,
      { status: 'processing', updated_at: new Date().toISOString() }
    );

    // 3. Get VAPID config
    const vapid = getVapidConfig();

    // 4. Fetch valid push subscriptions for user
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

    // 5. Send push to all subscriptions
    const payload = {
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
          payload,
          vapid,
        );

        if (result.expired) {
          // Endpoint is gone — revoke it
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

    // 6. Update notification status
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
    // Best-effort: mark as failed
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
