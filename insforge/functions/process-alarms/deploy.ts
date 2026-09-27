// InsForge Edge Function: process-alarms
// Called by InsForge Cron (every minute).
// Finds due alarms, creates notification records (idempotently),
// and triggers send-push-notification for each.
// Self-contained: no external imports.

declare const Deno: any;

const INSFORGE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? 'https://7p7ewmvi.us-east.insforge.app';
const SERVICE_ROLE_KEY = Deno.env.get('API_KEY') ?? Deno.env.get('ANON_KEY') ?? 'ik_9d2a844d3d742c432e4c93745a27c78d';
const FUNCTIONS_HOST = Deno.env.get('INSFORGE_FUNCTIONS_URL') ?? 'https://7p7ewmvi.function2.insforge.app';
const SEND_PUSH_URL = `${FUNCTIONS_HOST}/send-push-notification`;

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// ── DB helper ─────────────────────────────────────────────────────────────────

async function db(
  table: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  params?: string,
  body?: any,
): Promise<any[]> {
  const url = `${INSFORGE_URL}/api/database/records/${table}${params ? '?' + params : ''}`;
  const bodyPayload = method === 'POST' && body && !Array.isArray(body) ? [body] : body;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Prefer': 'return=representation',
    },
    body: bodyPayload ? JSON.stringify(bodyPayload) : undefined,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`DB ${method} ${table}: ${res.status} ${err}`);
  }
  return res.json().catch(() => []);
}

// ── Timezone-aware next trigger calculation ───────────────────────────────────

function calculateNextTrigger(
  scheduledTime: string,
  timezone: string,
  recurrence: string,
  recurrenceDays: number[] | null,
  fromDate: Date,
): Date | null {
  const [hours, minutes] = scheduledTime.split(':').map(Number);

  if (recurrence === 'once') return null;

  if (recurrence === 'daily') {
    const tomorrow = new Date(fromDate);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return buildUtcFromLocal(
      tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(),
      hours, minutes, timezone,
    );
  }

  if (recurrence === 'weekly' || recurrence === 'custom') {
    const days = recurrenceDays && recurrenceDays.length > 0 ? recurrenceDays : [1];
    return findNextWeekdayServer(fromDate, days, hours, minutes, timezone);
  }

  return null;
}

function buildUtcFromLocal(
  year: number, month: number, day: number,
  hours: number, minutes: number, tz: string,
): Date {
  try {
    const targetUtc = new Date(Date.UTC(year, month, day, hours, minutes, 0));
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(targetUtc);
    const partMap: Record<string, string> = {};
    for (const p of parts) partMap[p.type] = p.value;
    const tzHour = parseInt(partMap.hour === '24' ? '0' : partMap.hour, 10);
    const tzMin = parseInt(partMap.minute, 10);
    const tzDay = parseInt(partMap.day, 10);
    const asTzUtc = Date.UTC(parseInt(partMap.year, 10), parseInt(partMap.month, 10) - 1, tzDay, tzHour, tzMin, 0);
    const offsetMs = asTzUtc - targetUtc.getTime();
    return new Date(targetUtc.getTime() - offsetMs);
  } catch {
    return new Date(Date.UTC(year, month, day, hours, minutes, 0));
  }
}

function getWeekdayInTz(date: Date, tz: string): number {
  try {
    const str = date.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(str);
  } catch { return date.getUTCDay(); }
}

function findNextWeekdayServer(
  from: Date, days: number[], hours: number, minutes: number, tz: string,
): Date {
  const sorted = [...days].sort((a, b) => a - b);
  for (let i = 1; i <= 7; i++) {
    const candidate = new Date(from);
    candidate.setUTCDate(from.getUTCDate() + i);
    const wd = getWeekdayInTz(candidate, tz);
    if (sorted.includes(wd)) {
      const target = buildUtcFromLocal(
        candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate(),
        hours, minutes, tz,
      );
      if (target > from) return target;
    }
  }
  const fallback = new Date(from);
  fallback.setUTCDate(from.getUTCDate() + 7);
  return buildUtcFromLocal(
    fallback.getUTCFullYear(), fallback.getUTCMonth(), fallback.getUTCDate(),
    hours, minutes, tz,
  );
}

function getAlarmRouteUrl(alarmType: string): string {
  switch (alarmType) {
    case 'morning_run': case 'evening_run': case 'workout': return '/?tab=home&action=start_run';
    case 'stretch': case 'hydration': return '/?tab=home';
    default: return '/?tab=home';
  }
}

function getAlarmTitle(alarm: any): string {
  const labels: Record<string, string> = {
    morning_run: '🌅 Morning Run',
    evening_run: '🌆 Evening Run',
    stretch: '🧘 Stretch Reminder',
    hydration: '💧 Hydration Reminder',
    workout: '🏃 Workout Reminder',
    custom: '⏰ Reminder',
  };
  return alarm.title || labels[alarm.alarm_type] || '⏰ RunWar Reminder';
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

  const now = new Date();
  const nowIso = now.toISOString();

  console.log(`[process-alarms] Cron tick: ${nowIso}`);

  if (!INSFORGE_URL || !SERVICE_ROLE_KEY) {
    console.error('[process-alarms] Missing INSFORGE_URL or INSFORGE_SERVICE_ROLE_KEY');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500, headers: corsHeaders });
  }

  try {
    const dueAlarms: any[] = await db('alarms', 'GET',
      `enabled=eq.true&next_trigger_at=lte.${encodeURIComponent(nowIso)}&select=*&limit=100`
    );

    if (dueAlarms.length === 0) {
      console.log('[process-alarms] No due alarms');
      return new Response(JSON.stringify({ processed: 0 }), { status: 200, headers: corsHeaders });
    }

    console.log(`[process-alarms] Found ${dueAlarms.length} due alarm(s)`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const alarm of dueAlarms) {
      try {
        // Check user's notification preferences
        let userPref: any = null;
        try {
          const settingsList: any[] = await db(
            'user_settings',
            'GET',
            `user_id=eq.${alarm.user_id}&select=notifications_enabled,notif_running_reminders`
          );
          if (settingsList && settingsList.length > 0) {
            userPref = settingsList[0];
          }
        } catch (prefErr: any) {
          console.warn(`[process-alarms] Failed to fetch user_settings for ${alarm.user_id}:`, prefErr?.message);
        }

        if (userPref) {
          const masterDisabled = userPref.notifications_enabled === false;
          const remindersDisabled = userPref.notif_running_reminders === false;

          if (masterDisabled || remindersDisabled) {
            console.log(
              `[process-alarms] Alarm ${alarm.id} skipped due to user preference ` +
              `(master=${!masterDisabled}, running_reminders=${!remindersDisabled})`
            );
            // Advance the alarm so it schedules next time and doesn't get stuck firing
            await advanceAlarm(alarm, now);
            skipped++;
            continue;
          }
        }

        const occurrenceKey = `${alarm.id}:${alarm.next_trigger_at}`;

        const insertBody = {
          user_id: alarm.user_id,
          type: 'alarm',
          subtype: alarm.alarm_type,
          title: getAlarmTitle(alarm),
          message: alarm.message || '⏰ Your RunWar reminder.',
          data: { alarm_id: alarm.id, alarm_type: alarm.alarm_type, url: getAlarmRouteUrl(alarm.alarm_type) },
          alarm_id: alarm.id,
          scheduled_for: alarm.next_trigger_at,
          occurrence_key: occurrenceKey,
          status: 'pending',
          created_at: nowIso,
          updated_at: nowIso,
        };

        let notifId: string | null = null;
        try {
          const inserted: any[] = await db('notifications', 'POST', undefined, insertBody);
          notifId = inserted?.[0]?.id ?? null;
        } catch (insertErr: any) {
          if (String(insertErr?.message).includes('duplicate') ||
              String(insertErr?.message).includes('unique') ||
              String(insertErr?.message).includes('23505')) {
            console.log(`[process-alarms] Duplicate skipped: ${occurrenceKey}`);
            skipped++;
            await advanceAlarm(alarm, now);
            continue;
          }
          throw insertErr;
        }

        if (!notifId) {
          console.warn('[process-alarms] Insert returned no ID for alarm:', alarm.id);
          skipped++;
          continue;
        }

        const pushRes = await fetch(SEND_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            notificationId: notifId,
            userId: alarm.user_id,
            title: getAlarmTitle(alarm),
            body: alarm.message || '⏰ Your RunWar reminder.',
            url: getAlarmRouteUrl(alarm.alarm_type),
            type: 'alarm',
            data: { alarm_id: alarm.id, alarm_type: alarm.alarm_type },
          }),
        });

        if (!pushRes.ok) {
          console.warn(`[process-alarms] send-push returned ${pushRes.status} for alarm ${alarm.id}`);
        } else {
          const pushResult = await pushRes.json().catch(() => ({}));
          console.log(`[process-alarms] Push result for ${alarm.id}:`, JSON.stringify(pushResult));
        }

        await advanceAlarm(alarm, now);
        processed++;

      } catch (alarmErr: any) {
        errors++;
        console.error(`[process-alarms] Error processing alarm ${alarm.id}:`, alarmErr?.message);
      }
    }

    const streakRemindersSent = await checkStreakSavers(now);
    const summary = { processed, skipped, errors, streakRemindersSent, total: dueAlarms.length };
    console.log('[process-alarms] Complete:', JSON.stringify(summary));
    return new Response(JSON.stringify(summary), { status: 200, headers: corsHeaders });

  } catch (err: any) {
    console.error('[process-alarms] Fatal error:', err?.message);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500, headers: corsHeaders
    });
  }
}

/** 
 * 🔥 Streak Saver / Inactivity Reminders:
 * Checks users with active push subscriptions between 18:00 and 22:00 in their local timezone.
 * If user has an active streak (ran yesterday) but hasn't run today, dispatches a streak reminder.
 */
async function checkStreakSavers(now: Date): Promise<number> {
  let streakSent = 0;
  try {
    const activeSubs: any[] = await db('push_subscriptions', 'GET', 'revoked_at=is.null&select=user_id') || [];
    const userIds = Array.from(new Set(activeSubs.map((s: any) => s.user_id).filter(Boolean)));
    if (userIds.length === 0) return 0;

    for (const userId of userIds) {
      try {
        const settingsList: any[] = await db('user_settings', 'GET', `user_id=eq.${userId}&select=notifications_enabled,notif_achievements`) || [];
        const userPref = settingsList?.[0];
        if (userPref && (userPref.notifications_enabled === false || userPref.notif_achievements === false)) {
          continue;
        }

        const userAlarms: any[] = await db('alarms', 'GET', `user_id=eq.${userId}&limit=1&select=timezone`) || [];
        const tz = userAlarms?.[0]?.timezone || 'Asia/Kolkata';

        const localFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false
        });
        const parts = localFormatter.formatToParts(now);
        const pMap: Record<string, string> = {};
        for (const p of parts) pMap[p.type] = p.value;
        const localHour = parseInt(pMap.hour === '24' ? '0' : pMap.hour, 10);
        const todayKey = `${pMap.year}-${pMap.month}-${pMap.day}`;

        if (localHour < 18 || localHour >= 22) {
          continue;
        }

        const streakKey = `streak:${userId}:${todayKey}`;
        const existing: any[] = await db('notifications', 'GET', `occurrence_key=eq.${streakKey}&select=id`) || [];
        if (existing.length > 0) {
          continue;
        }

        const workouts: any[] = await db('workouts', 'GET', `user_id=eq.${userId}&order=started_at.desc&limit=15&select=started_at`) || [];
        if (workouts.length === 0) continue;

        const workoutDateKeys = new Set(
          workouts.map((w: any) => {
            try {
              return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(w.started_at));
            } catch {
              return null;
            }
          }).filter(Boolean)
        );

        if (workoutDateKeys.has(todayKey)) {
          continue;
        }

        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(yesterday);

        if (!workoutDateKeys.has(yesterdayKey)) {
          continue;
        }

        let streakDays = 0;
        for (let d = 1; d <= 30; d++) {
          const checkDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
          const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(checkDate);
          if (workoutDateKeys.has(key)) {
            streakDays++;
          } else {
            break;
          }
        }

        if (streakDays >= 1) {
          const title = streakDays > 1
            ? `🔥 Keep your ${streakDays}-day streak alive!`
            : `🔥 Keep your running streak alive!`;
          const body = `You haven't logged a run today. Complete a quick 1 km jog to maintain your streak before midnight!`;

          const notif = await db('notifications', 'POST', undefined, {
            user_id: userId,
            type: 'streak',
            subtype: 'streak_saver',
            title,
            message: body,
            data: { url: '/?tab=home&action=start_run', streakDays },
            occurrence_key: streakKey,
            status: 'pending',
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          });

          if (notif?.[0]?.id) {
            await fetch(SEND_PUSH_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'apikey': SERVICE_ROLE_KEY,
              },
              body: JSON.stringify({
                notificationId: notif[0].id,
                userId,
                title,
                body,
                url: '/?tab=home&action=start_run',
                type: 'streak',
                data: { streakDays },
              }),
            });
            streakSent++;
            console.log(`[process-alarms] Streak saver sent to user ${userId} (${streakDays} days)`);
          }
        }
      } catch (userErr: any) {
        console.warn(`[process-alarms] Streak check failed for user ${userId}:`, userErr?.message);
      }
    }
  } catch (err: any) {
    console.warn('[process-alarms] checkStreakSavers exception:', err?.message);
  }
  return streakSent;
}

async function advanceAlarm(alarm: any, processedAt: Date): Promise<void> {
  if (alarm.recurrence === 'once') {
    await db('alarms', 'PATCH',
      `id=eq.${alarm.id}`,
      {
        enabled: false,
        last_triggered_at: processedAt.toISOString(),
        next_trigger_at: null,
        updated_at: processedAt.toISOString(),
      }
    );
    console.log(`[process-alarms] One-time alarm disabled: ${alarm.id}`);
  } else {
    const next = calculateNextTrigger(
      alarm.scheduled_time,
      alarm.timezone || 'UTC',
      alarm.recurrence,
      alarm.recurrence_days,
      processedAt,
    );

    await db('alarms', 'PATCH',
      `id=eq.${alarm.id}`,
      {
        last_triggered_at: processedAt.toISOString(),
        next_trigger_at: next ? next.toISOString() : null,
        enabled: !!next,
        updated_at: processedAt.toISOString(),
      }
    );
    console.log(`[process-alarms] Alarm ${alarm.id} advanced → next: ${next?.toISOString() ?? 'null'}`);
  }
}
