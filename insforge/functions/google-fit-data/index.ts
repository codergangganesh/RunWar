// InsForge Edge Function: google-fit-data
// Fetches Google Fit step, calorie, and distance data using stored tokens.
// Auto-refreshes the access token using the stored refresh token when expired.
// Also supports disconnection: DELETE / or POST with { action: 'disconnect' }.

declare const Deno: any;

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '532781220302-rkkhr06ocgnm7p7o5je3cs8oel5qms0l.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

interface HourlyBucket {
  hour: number;
  label: string;
  steps: number;
  isActive: boolean;
}

/** Refresh expired access token via Google OAuth */
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!res.ok) {
      console.error('Token refresh failed:', res.status, await res.text());
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('Token refresh error:', err);
    return null;
  }
}

/** Aggregate data from Google Fit API */
async function fetchGoogleFitData(accessToken: string, startMs: number, endMs: number, tz: string = 'UTC') {
  const [totalRes, hourlyRes] = await Promise.all([
    // Daily totals
    fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: 'com.google.step_count.delta' },
          { dataTypeName: 'com.google.calories.expended' },
          { dataTypeName: 'com.google.distance.delta' },
          { dataTypeName: 'com.google.active_minutes' },
        ],
        bucketByTime: { durationMillis: Math.max(endMs - startMs, 1000) },
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    }),
    // Hourly buckets for bar chart
    fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
        bucketByTime: { durationMillis: 3600000 },
        startTimeMillis: startMs,
        endTimeMillis: startMs + 86400000,
      }),
    }),
  ]);

  let steps = 0, calories = 0, distanceMeters = 0, activeMinutes = 0;

  if (totalRes.ok) {
    const data = await totalRes.json();
    for (const b of data.bucket ?? []) {
      for (const ds of b.dataset ?? []) {
        const dtId = (ds.dataSourceId ?? '').toLowerCase();
        for (const pt of ds.point ?? []) {
          const ptType = (pt.dataTypeName ?? '').toLowerCase();
          const match = ptType || dtId;
          for (const val of pt.value ?? []) {
            if (match.includes('step_count')) steps += val.intVal ?? Math.round(val.fpVal ?? 0);
            else if (match.includes('calories')) calories += val.fpVal ?? val.intVal ?? 0;
            else if (match.includes('distance')) distanceMeters += val.fpVal ?? val.intVal ?? 0;
            else if (match.includes('active_minutes') || match.includes('move_minutes')) {
              activeMinutes += val.intVal ?? Math.round(val.fpVal ?? 0);
            }
          }
        }
      }
    }
  } else {
    console.warn('Google Fit totalRes error:', totalRes.status, await totalRes.text());
  }

  // Hourly buckets
  const hourlyBuckets: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`,
    steps: 0,
    isActive: false,
  }));

  if (hourlyRes.ok) {
    const hourlyData = await hourlyRes.json();
    for (const b of hourlyData.bucket ?? []) {
      let bucketHour = 0;
      try {
        const hourStr = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: 'numeric',
          hour12: false,
        }).format(new Date(Number(b.startTimeMillis)));
        bucketHour = parseInt(hourStr === '24' ? '0' : hourStr, 10) % 24;
      } catch {
        bucketHour = new Date(Number(b.startTimeMillis)).getUTCHours();
      }
      let bucketSteps = 0;
      for (const ds of b.dataset ?? []) {
        for (const pt of ds.point ?? []) {
          for (const val of pt.value ?? []) {
            bucketSteps += val.intVal ?? Math.round(val.fpVal ?? 0);
          }
        }
      }
      if (hourlyBuckets[bucketHour]) {
        hourlyBuckets[bucketHour].steps = bucketSteps;
        hourlyBuckets[bucketHour].isActive = bucketSteps >= 250;
      }
    }
  }

  return {
    steps: Math.round(steps),
    calories: Math.round(calories),
    distanceMeters: Math.round(distanceMeters),
    activeMinutes: Math.round(activeMinutes),
    hourlyBuckets,
  };
}

export default async function (req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      },
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const insforgeUrl = Deno.env.get('INSFORGE_BASE_URL') ?? 'https://9r3q7vvs.us-east.insforge.app';
  const apiKey = Deno.env.get('API_KEY') ?? Deno.env.get('ANON_KEY') ?? 'ik_3f6a564a8b2a7de0a8e58110051ed7a8';
  const anonKey = Deno.env.get('ANON_KEY') ?? '';

  try {
    let body: any = {};
    if (req.method === 'POST' || req.method === 'DELETE') {
      body = await req.json().catch(() => ({}));
    } else {
      const url = new URL(req.url);
      body.user_id = url.searchParams.get('user_id');
      body.action = url.searchParams.get('action');
      body.email = url.searchParams.get('email');
      body.device_id = url.searchParams.get('device_id');
      body.timezone = url.searchParams.get('timezone');
    }

    const userId = body.user_id ? String(body.user_id).trim() : '';
    const requestDeviceId = body.device_id ? String(body.device_id).trim() : '';
    const requestEmail = body.email ? String(body.email).trim() : '';

    if (!userId && !requestEmail && !requestDeviceId) {
      return new Response(JSON.stringify({ error: 'user_id or email required' }), { status: 400, headers: corsHeaders });
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuidUser = Boolean(userId && UUID_RE.test(userId));
    const isGuestUser = Boolean(userId && userId.startsWith('usr_'));
    const isGuestDevice = Boolean(requestDeviceId && requestDeviceId.startsWith('usr_'));

    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    let verifiedAuthUserId: string | null = null;
    if (bearerToken && bearerToken !== anonKey && bearerToken !== apiKey) {
      try {
        const meRes = await fetch(`${insforgeUrl}/api/auth/current-user`, {
          headers: { 'Authorization': `Bearer ${bearerToken}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          verifiedAuthUserId = meData?.user?.id || meData?.id || null;
        }
      } catch {}
    }

    // Reject spoofed/unauthorized access:
    // - Registered UUID user_id requires matching InsForge JWT.
    // - Non-guest requests without verified JWT (e.g. raw email or non-usr_ device_id) require InsForge JWT.
    if (isUuidUser) {
      if (!verifiedAuthUserId || verifiedAuthUserId.toLowerCase() !== userId.toLowerCase()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
    } else if (!isGuestUser && !isGuestDevice && !verifiedAuthUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Handle Disconnect action
    if (req.method === 'DELETE' || body.action === 'disconnect') {
      const targetUserId = userId || verifiedAuthUserId || (isGuestDevice ? requestDeviceId : '');
      if (targetUserId) {
        await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?user_id=eq.${encodeURIComponent(targetUserId)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
      }
      if (requestEmail && verifiedAuthUserId) {
        await fetch(
          `${insforgeUrl}/api/database/records/google_oauth_tokens?account_email=eq.${encodeURIComponent(requestEmail)}&user_id=eq.${encodeURIComponent(verifiedAuthUserId)}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${apiKey}` },
          }
        );
      }
      return new Response(JSON.stringify({ ok: true, disconnected: true }), { status: 200, headers: corsHeaders });
    }

    // Query tokens for user: by user_id first, then email (owner-scoped), then guest device_id
    let tokenRow: any = null;

    if (userId && (verifiedAuthUserId || isGuestUser)) {
      const dbRes = await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,access_token,refresh_token,expires_at,account_email`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (dbRes.ok) {
        const rows = await dbRes.json();
        tokenRow = rows?.[0];
      }
    }

    if (!tokenRow && requestEmail && verifiedAuthUserId) {
      const emailRes = await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?account_email=eq.${encodeURIComponent(requestEmail)}&select=id,user_id,access_token,refresh_token,expires_at,account_email`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (emailRes.ok) {
        const rows = await emailRes.json();
        const candidate = rows?.[0];
        if (
          candidate &&
          candidate.user_id?.toLowerCase() === verifiedAuthUserId.toLowerCase()
        ) {
          tokenRow = candidate;
        }
      }
    }

    if (!tokenRow && isGuestDevice) {
      const devRes = await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?user_id=eq.${encodeURIComponent(requestDeviceId)}&select=id,user_id,access_token,refresh_token,expires_at,account_email`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (devRes.ok) {
        const rows = await devRes.json();
        tokenRow = rows?.[0];
      }
    }

    if (!tokenRow || !tokenRow.refresh_token) {
      return new Response(JSON.stringify({ error: 'not_connected', message: 'Google Fit not connected' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    let accessToken = tokenRow.access_token;
    const tokenExpired = tokenRow.expires_at
      ? new Date(tokenRow.expires_at).getTime() < Date.now()
      : true;

    // Refresh access token if expired
    if (tokenExpired || !accessToken) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: 'token_refresh_failed', message: 'Token refresh failed' }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      accessToken = refreshed.access_token;
      const newExpiresAt = new Date(Date.now() + (Number(refreshed.expires_in || 3600) - 60) * 1000).toISOString();
      tokenRow.expires_at = newExpiresAt;

      // Update new access_token in DB
      await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?id=eq.${encodeURIComponent(tokenRow.id)}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        }),
      });
    }

    // Link user_id if tokenRow.user_id differed from requested userId
    if (userId && tokenRow.user_id !== userId) {
      try {
        await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?on_conflict=user_id`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify([{
            user_id: userId,
            access_token: accessToken,
            refresh_token: tokenRow.refresh_token,
            expires_at: tokenRow.expires_at,
            account_email: tokenRow.account_email,
            updated_at: new Date().toISOString(),
          }]),
        });
      } catch { /* ignore */ }
    }

    const remainingExpiresIn = tokenRow.expires_at
      ? Math.max(60, Math.floor((new Date(tokenRow.expires_at).getTime() - Date.now()) / 1000))
      : 3600;

    // Return token directly if requested
    if (body.action === 'get_token') {
      return new Response(
        JSON.stringify({
          ok: true,
          connected: true,
          access_token: accessToken,
          expires_in: remainingExpiresIn,
          accountEmail: tokenRow.account_email ?? '',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const tz = typeof body.timezone === 'string' && body.timezone ? body.timezone : 'UTC';
    const now = Date.now();
    // Compute midnight in requested timezone (fallback UTC)
    let defaultStartMs = new Date().setUTCHours(0, 0, 0, 0);
    try {
      const p = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false,
      }).formatToParts(new Date(now));
      const m: Record<string, string> = {};
      for (const part of p) m[part.type] = part.value;
      const h = parseInt(m.hour === '24' ? '0' : m.hour, 10);
      const min = parseInt(m.minute, 10);
      const sec = parseInt(m.second, 10);
      defaultStartMs = now - ((h * 3600 + min * 60 + sec) * 1000);
    } catch {}

    const startMs = Number(body.start_ms) || defaultStartMs;
    const endMs = Number(body.end_ms) || now;

    const fitData = await fetchGoogleFitData(accessToken, startMs, endMs, tz);

    return new Response(
      JSON.stringify({
        ...fitData,
        access_token: accessToken,
        expires_in: remainingExpiresIn,
        accountEmail: tokenRow.account_email ?? '',
        source: 'google_health',
        fetched_at: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('google-fit-data error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
}
