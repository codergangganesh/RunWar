// InsForge Edge Function: google-fit-setup
// ONE-TIME setup function — creates the google_oauth_tokens table.
// Call this once via POST with the service role key, then delete/disable it.

import { createClient } from 'https://esm.sh/@insforge/sdk@latest';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const insforge = createClient(
    Deno.env.get('INSFORGE_URL') ?? '',
    Deno.env.get('INSFORGE_SERVICE_ROLE_KEY') ?? '',
  );

  // Create the table via raw SQL using the Postgres REST API
  const sql = `
    CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      access_token text,
      refresh_token text NOT NULL,
      expires_at timestamptz,
      scope text,
      account_email text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS google_oauth_tokens_self ON public.google_oauth_tokens;
    CREATE POLICY google_oauth_tokens_self
      ON public.google_oauth_tokens FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS google_oauth_tokens_service ON public.google_oauth_tokens;
    CREATE POLICY google_oauth_tokens_service
      ON public.google_oauth_tokens FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  `;

  const { error } = await insforge.rpc('exec_sql', { sql_query: sql });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response(JSON.stringify({ ok: true, message: 'google_oauth_tokens table created successfully' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
