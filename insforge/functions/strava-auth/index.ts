// InsForge Edge Function: strava-auth
// Handles Strava OAuth2 code exchange, token refresh, and URL generation.
// Keeps STRAVA_CLIENT_SECRET secure on the server side.

declare const Deno: any;

const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') ?? '';
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') ?? '';

export default async function (req: Request): Promise<Response> {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const url = new URL(req.url);

    // 1. GET Request: Generate Strava OAuth URL
    if (req.method === 'GET') {
      const redirectUri = url.searchParams.get('redirect_uri') || '';
      const state = url.searchParams.get('state') || '';

      if (!STRAVA_CLIENT_ID) {
        return new Response(
          JSON.stringify({ error: 'STRAVA_CLIENT_ID is not configured in backend secrets.' }),
          { status: 500, headers: corsHeaders }
        );
      }

      const params = new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirectUri,
        approval_prompt: 'auto',
        scope: 'read,activity:read_all,activity:write',
        state,
      });

      return new Response(
        JSON.stringify({
          url: `https://www.strava.com/oauth/authorize?${params.toString()}`,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 2. POST Request: Exchange code or refresh token
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const action = body.action || 'exchange';

      if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
        return new Response(
          JSON.stringify({
            error: 'STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET is missing from backend secrets.',
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Action A: Exchange authorization code for tokens
      if (action === 'exchange') {
        const code = body.code;
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing authorization code.' }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const tokenRes = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
          }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
          return new Response(
            JSON.stringify({ error: tokenData.message || 'Failed to exchange Strava code.' }),
            { status: tokenRes.status, headers: corsHeaders }
          );
        }

        return new Response(JSON.stringify(tokenData), {
          status: 200,
          headers: corsHeaders,
        });
      }

      // Action B: Refresh expired access token
      if (action === 'refresh') {
        const refreshToken = body.refresh_token;
        if (!refreshToken) {
          return new Response(JSON.stringify({ error: 'Missing refresh_token.' }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const refreshRes = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        });

        const refreshData = await refreshRes.json();
        if (!refreshRes.ok) {
          return new Response(
            JSON.stringify({ error: refreshData.message || 'Failed to refresh Strava token.' }),
            { status: refreshRes.status, headers: corsHeaders }
          );
        }

        return new Response(JSON.stringify(refreshData), {
          status: 200,
          headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
