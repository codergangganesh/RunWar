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
async function fetchGoogleFitData(accessToken: string, startMs: number, endMs: number) {
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
      const bucketHour = new Date(Number(b.startTimeMillis)).getHours();
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

  const insforgeUrl = Deno.env.get('INSFORGE_BASE_URL') ?? 'https://7p7ewmvi.us-east.insforge.app';
  const apiKey = Deno.env.get('API_KEY') ?? Deno.env.get('ANON_KEY') ?? 'ik_9d2a844d3d742c432e4c93745a27c78d';

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
    }

    const userId = body.user_id;
    if (!userId && !body.email && !body.device_id) {
      return new Response(JSON.stringify({ error: 'user_id or email required' }), { status: 400, headers: corsHeaders });
    }

    // Handle Disconnect action
    if (req.method === 'DELETE' || body.action === 'disconnect') {
      if (userId) {
        await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?user_id=eq.${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
      }
      if (body.email) {
        await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?account_email=eq.${encodeURIComponent(body.email)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
      }
      return new Response(JSON.stringify({ ok: true, disconnected: true }), { status: 200, headers: corsHeaders });
    }

    // Query tokens for user: by user_id first, then email, then device_id
    let tokenRow: any = null;

    if (userId) {
      const dbRes = await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,access_token,refresh_token,expires_at,account_email`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (dbRes.ok) {
        const rows = await dbRes.json();
        tokenRow = rows?.[0];
      }
    }

    if (!tokenRow && body.email) {
      const emailRes = await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?account_email=eq.${encodeURIComponent(body.email)}&select=id,user_id,access_token,refresh_token,expires_at,account_email`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (emailRes.ok) {
        const rows = await emailRes.json();
        tokenRow = rows?.[0];
      }
    }

    if (!tokenRow && body.device_id) {
      const devRes = await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?user_id=eq.${encodeURIComponent(body.device_id)}&select=id,user_id,access_token,refresh_token,expires_at,account_email`, {
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

    // Return token directly if requested
    if (body.action === 'get_token') {
      return new Response(
        JSON.stringify({
          ok: true,
          connected: true,
          access_token: accessToken,
          expires_in: 3600,
          accountEmail: tokenRow.account_email ?? '',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Determine time range (defaults to start of today local time)
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const startMs = Number(body.start_ms) || todayStart.getTime();
    const endMs = Number(body.end_ms) || now;

    const fitData = await fetchGoogleFitData(accessToken, startMs, endMs);

    return new Response(
      JSON.stringify({
        ...fitData,
        access_token: accessToken,
        expires_in: 3600,
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
