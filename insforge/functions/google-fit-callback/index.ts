// InsForge Edge Function: google-fit-callback
// Handles Google OAuth redirect, exchanges code for access_token + refresh_token,
// stores them in the database, and smoothly returns user to the RunWar app.

declare const Deno: any;

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '532781220302-rkkhr06ocgnm7p7o5je3cs8oel5qms0l.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const REDIRECT_URI = 'https://7p7ewmvi.function2.insforge.app/google-fit-callback';
const FALLBACK_APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173';

export default async function (req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state') ?? '';
  const error = url.searchParams.get('error');

  // Decode state: { userId, returnUrl }
  let userId = '';
  let returnUrl = FALLBACK_APP_URL;

  try {
    const parsedState = JSON.parse(atob(stateRaw));
    userId = parsedState.userId ?? '';
    if (parsedState.returnUrl) {
      returnUrl = parsedState.returnUrl;
    }
  } catch {
    userId = stateRaw;
  }

  const baseUrlForRedirect = returnUrl.replace(/\/$/, '');

  if (error) {
    return Response.redirect(`${baseUrlForRedirect}?google_error=${encodeURIComponent(error)}`, 302);
  }

  if (!code || !userId) {
    return Response.redirect(`${baseUrlForRedirect}?google_error=missing_code_or_user`, 302);
  }

  if (!GOOGLE_CLIENT_SECRET) {
    console.error('GOOGLE_CLIENT_SECRET is missing from secrets');
    return Response.redirect(`${baseUrlForRedirect}?google_error=missing_client_secret`, 302);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Token exchange failed:', tokenRes.status, errBody);
      return Response.redirect(`${baseUrlForRedirect}?google_error=${encodeURIComponent('fail_' + tokenRes.status + '_' + errBody)}`, 302);
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in, scope } = tokens;

    // Fetch user's Google email for display
    let accountEmail = '';
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        accountEmail = profile.email ?? '';
      }
    } catch { /* ignore */ }

    // Calculate expiry (subtract 60s safety buffer)
    const expiresAt = new Date(Date.now() + (Number(expires_in || 3600) - 60) * 1000).toISOString();

    const insforgeUrl = Deno.env.get('INSFORGE_BASE_URL') ?? 'https://7p7ewmvi.us-east.insforge.app';
    const apiKey = Deno.env.get('API_KEY') ?? Deno.env.get('ANON_KEY') ?? 'ik_9d2a844d3d742c432e4c93745a27c78d';

    // If refresh_token is missing, check if one already exists in DB
    let finalRefreshToken = refresh_token;
    if (!finalRefreshToken) {
      const existingRes = await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?user_id=eq.${encodeURIComponent(userId)}&select=refresh_token`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      if (existingRes.ok) {
        const existingData = await existingRes.json();
        if (existingData?.[0]?.refresh_token) {
          finalRefreshToken = existingData[0].refresh_token;
        }
      }
    }

    if (!finalRefreshToken) {
      console.warn('No refresh_token received and none found in DB');
      return Response.redirect(`${baseUrlForRedirect}?google_error=no_refresh_token`, 302);
    }

    // Upsert tokens into DB
    const upsertPayload = {
      user_id: userId,
      access_token,
      refresh_token: finalRefreshToken,
      expires_at: expiresAt,
      scope: scope ?? '',
      account_email: accountEmail,
      updated_at: new Date().toISOString(),
    };

    const dbRes = await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify([upsertPayload]),
    });

    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error('DB token upsert error:', dbRes.status, dbErr);
      return Response.redirect(`${baseUrlForRedirect}?google_error=db_error`, 302);
    }

    // If an authenticated user profile exists with this email, also link the token to their profile user_id
    if (accountEmail) {
      try {
        const profRes = await fetch(`${insforgeUrl}/api/database/records/profiles?email=eq.${encodeURIComponent(accountEmail)}&select=user_id`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (profRes.ok) {
          const profRows = await profRes.json();
          const profUserId = profRows?.[0]?.user_id;
          if (profUserId && profUserId !== userId) {
            await fetch(`${insforgeUrl}/api/database/records/google_oauth_tokens?on_conflict=user_id`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates',
              },
              body: JSON.stringify([{ ...upsertPayload, user_id: profUserId }]),
            });
            console.log(`Also linked Google tokens to profile user_id: ${profUserId}`);
          }
        }
      } catch (linkErr) {
        console.warn('Profile token link notice:', linkErr);
      }
    }

    console.log(`Successfully stored Google tokens for user: ${userId}, email: ${accountEmail}`);

    // Build return redirect URL with connection status and tokens
    let redirectUrlObj: URL;
    try {
      redirectUrlObj = new URL(returnUrl);
    } catch {
      redirectUrlObj = new URL(FALLBACK_APP_URL);
    }

    redirectUrlObj.searchParams.set('google_connected', 'true');
    if (accountEmail) redirectUrlObj.searchParams.set('email', accountEmail);
    if (access_token) redirectUrlObj.searchParams.set('access_token', access_token);
    if (expires_in) redirectUrlObj.searchParams.set('expires_in', String(expires_in));

    const finalRedirectUrl = redirectUrlObj.toString();
    console.log(`Redirecting back to app: ${finalRedirectUrl}`);
    return Response.redirect(finalRedirectUrl, 302);

  } catch (err) {
    console.error('google-fit-callback exception:', err);
    return Response.redirect(`${baseUrlForRedirect}?google_error=${encodeURIComponent(String(err))}`, 302);
  }
}
