-- Create google_oauth_tokens table for persistent Google Fit connections
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

-- Enable RLS
ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own token row
DROP POLICY IF EXISTS google_oauth_tokens_self ON public.google_oauth_tokens;
CREATE POLICY google_oauth_tokens_self 
  ON public.google_oauth_tokens 
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Service role bypass (edge functions use service role)
DROP POLICY IF EXISTS google_oauth_tokens_service ON public.google_oauth_tokens;
CREATE POLICY google_oauth_tokens_service
  ON public.google_oauth_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_google_oauth_tokens_updated_at ON public.google_oauth_tokens;
CREATE TRIGGER update_google_oauth_tokens_updated_at
  BEFORE UPDATE ON public.google_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
