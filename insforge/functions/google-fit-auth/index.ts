// InsForge Edge Function: google-fit-auth
// Returns the Google OAuth authorization URL for the code flow.
// Frontend redirects user to this URL.

declare const Deno: any;

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '532781220302-rkkhr06ocgnm7p7o5je3cs8oel5qms0l.apps.googleusercontent.com';
const REDIRECT_URI = Deno.env.get('GOOGLE_FIT_REDIRECT_URI') ?? 'https://9r3q7vvs.function2.insforge.app/google-fit-callback';

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.location.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
].join(' ');

function isAllowedReturnUrl(candidate: string): boolean {
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host === 'run-war-chi.vercel.app') return true;
    const configured = Deno.env.get('APP_URL');
    if (configured) {
      const cfgHost = new URL(configured).hostname.toLowerCase();
      if (host === cfgHost) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

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

    const safeReturnUrl = isAllowedReturnUrl(returnUrl)
      ? returnUrl
      : (Deno.env.get('APP_URL') ?? 'https://run-war-chi.vercel.app');

    // Pack userId and validated returnUrl into state (UTF-8 safe)
    const statePayload = JSON.stringify({ userId, returnUrl: safeReturnUrl });
    const state = encodeBase64Utf8(statePayload);

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
