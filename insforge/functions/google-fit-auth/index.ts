// InsForge Edge Function: google-fit-auth
// Returns the Google OAuth authorization URL for the code flow.
// Frontend redirects user to this URL.

declare const Deno: any;

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '532781220302-rkkhr06ocgnm7p7o5je3cs8oel5qms0l.apps.googleusercontent.com';
const REDIRECT_URI = 'https://7p7ewmvi.function2.insforge.app/google-fit-callback';

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.location.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
].join(' ');

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

  try {
    let userId = '';
    let returnUrl = '';

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      userId = body.user_id ?? '';
      returnUrl = body.return_url ?? '';
    } else {
      const url = new URL(req.url);
      userId = url.searchParams.get('user_id') ?? '';
      returnUrl = url.searchParams.get('return_url') ?? '';
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Pack userId and returnUrl into state
    const statePayload = JSON.stringify({ userId, returnUrl });
    const state = btoa(statePayload);

    // Build the OAuth URL with code flow + offline access (required for refresh_token)
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',       // required for refresh_token
      prompt: 'consent',            // force consent screen to get refresh_token
      state,                        // carry user_id and returnUrl through redirect
      include_granted_scopes: 'true',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(JSON.stringify({ url: authUrl, redirect_uri: REDIRECT_URI }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
