-- ==============================================================================
-- RunWar: Security & RLS Hardening Migration
-- Fixes:
--   1. Lock down password management RPCs (revoke anon, enforce auth.uid())
--   2. Enable RLS on google_oauth_tokens, daily_steps, community_*
--   3. Replace wide-open true policies on ai_generated_routes, live_beacons, tether_sessions
--   4. Restrict profiles anonymous PII exposure & enforce username immutability
--   5. Allow post authors to reply in community_comments (align with UI/service)
--   6. Add WITH CHECK clauses on UPDATE policies and missing indexes
-- ==============================================================================

-- 1. LOCK DOWN PASSWORD MANAGEMENT RPCS
REVOKE ALL ON FUNCTION public.check_user_has_password(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_account_password(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_account_password(text, text, uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.check_user_has_password(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id uuid;
    v_has_auth_pw boolean := false;
    v_profile_configured boolean := false;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;
    IF p_user_id IS NOT NULL AND p_user_id <> v_user_id THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    BEGIN
        SELECT (password IS NOT NULL AND password != '')
        INTO v_has_auth_pw
        FROM auth.users
        WHERE id = v_user_id;
    EXCEPTION
        WHEN OTHERS THEN
            v_has_auth_pw := false;
    END;

    SELECT password_configured
    INTO v_profile_configured
    FROM public.profiles
    WHERE user_id = v_user_id;

    RETURN COALESCE(v_has_auth_pw, false) OR COALESCE(v_profile_configured, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_has_password(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_account_password(p_new_password text, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated. Please sign in again.';
    END IF;
    IF p_user_id IS NOT NULL AND p_user_id <> v_user_id THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    IF length(p_new_password) < 8 THEN
        RAISE EXCEPTION 'Password must be at least 8 characters.';
    END IF;
    IF p_new_password !~ '[A-Z]' THEN
        RAISE EXCEPTION 'Password must contain at least one uppercase letter.';
    END IF;
    IF p_new_password !~ '[a-z]' THEN
        RAISE EXCEPTION 'Password must contain at least one lowercase letter.';
    END IF;
    IF p_new_password !~ '[0-9]' THEN
        RAISE EXCEPTION 'Password must contain at least one number.';
    END IF;

    UPDATE auth.users
    SET
        password = crypt(p_new_password, gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = v_user_id;

    UPDATE public.profiles
    SET
        password_configured = true,
        updated_at = now()
    WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'message', 'Password created successfully'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_account_password(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.change_account_password(p_current_password text, p_new_password text, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id uuid;
    v_hashed text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated. Please sign in again.';
    END IF;
    IF p_user_id IS NOT NULL AND p_user_id <> v_user_id THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    SELECT password INTO v_hashed
    FROM auth.users
    WHERE id = v_user_id;

    IF v_hashed IS NOT NULL AND v_hashed != '' THEN
        IF crypt(p_current_password, v_hashed) != v_hashed THEN
            RAISE EXCEPTION 'Current password is incorrect';
        END IF;
    END IF;

    IF length(p_new_password) < 8 THEN
        RAISE EXCEPTION 'Password must be at least 8 characters.';
    END IF;
    IF p_new_password !~ '[A-Z]' THEN
        RAISE EXCEPTION 'Password must contain at least one uppercase letter.';
    END IF;
    IF p_new_password !~ '[a-z]' THEN
        RAISE EXCEPTION 'Password must contain at least one lowercase letter.';
    END IF;
    IF p_new_password !~ '[0-9]' THEN
        RAISE EXCEPTION 'Password must contain at least one number.';
    END IF;

    IF p_current_password = p_new_password THEN
        RAISE EXCEPTION 'Your new password must be different from your current password.';
    END IF;

    UPDATE auth.users
    SET
        password = crypt(p_new_password, gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = v_user_id;

    UPDATE public.profiles
    SET
        password_configured = true,
        updated_at = now()
    WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'message', 'Password updated successfully'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_account_password(text, text, uuid) TO authenticated;

-- 2. GOOGLE_OAUTH_TOKENS RLS (edge functions use API_KEY service role)
ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "google_oauth_tokens_own" ON public.google_oauth_tokens;
CREATE POLICY "google_oauth_tokens_own"
    ON public.google_oauth_tokens FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

-- 3. DAILY_STEPS RLS
ALTER TABLE public.daily_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_steps_own" ON public.daily_steps;
CREATE POLICY "daily_steps_own"
    ON public.daily_steps FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 4. COMMUNITY POSTS, COMMENTS & REACTIONS RLS
-- Drop self-comment block trigger so post authors can reply as supported in UI
DROP TRIGGER IF EXISTS trg_prevent_self_comment ON public.community_comments;
DROP FUNCTION IF EXISTS public.fn_prevent_self_comment();

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view public community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Authenticated athletes can publish posts" ON public.community_posts;
DROP POLICY IF EXISTS "Allow athletes to interact with posts" ON public.community_posts;
DROP POLICY IF EXISTS "Authors can update their own posts" ON public.community_posts;
DROP POLICY IF EXISTS "Authors can delete their own posts" ON public.community_posts;

CREATE POLICY "View public, friends (auth), or own community posts"
    ON public.community_posts FOR SELECT
    USING (
        visibility = 'public'
        OR (visibility = 'friends' AND auth.uid() IS NOT NULL)
        OR user_id = auth.uid()
    );

CREATE POLICY "Authenticated athletes can publish posts"
    ON public.community_posts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can update their own posts"
    ON public.community_posts FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can delete their own posts"
    ON public.community_posts FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view comments" ON public.community_comments;
DROP POLICY IF EXISTS "Authenticated athletes can add comments" ON public.community_comments;
DROP POLICY IF EXISTS "Authors and comment owners can delete comments" ON public.community_comments;

CREATE POLICY "View comments on visible posts"
    ON public.community_comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.community_posts p
            WHERE p.id = post_id
              AND (
                p.visibility = 'public'
                OR (p.visibility = 'friends' AND auth.uid() IS NOT NULL)
                OR p.user_id = auth.uid()
              )
        )
    );

CREATE POLICY "Authenticated athletes can add comments"
    ON public.community_comments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors and comment owners can delete comments"
    ON public.community_comments FOR DELETE
    TO authenticated
    USING (
        auth.uid() = user_id
        OR auth.uid() = (SELECT user_id FROM public.community_posts WHERE id = post_id)
    );

ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.community_reactions;
DROP POLICY IF EXISTS "Users can add own reactions" ON public.community_reactions;
DROP POLICY IF EXISTS "Users can delete own reactions" ON public.community_reactions;

CREATE POLICY "Anyone can view reactions"
    ON public.community_reactions FOR SELECT
    USING (true);

CREATE POLICY "Users can add own reactions"
    ON public.community_reactions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
    ON public.community_reactions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. AI GENERATED ROUTES RLS
ALTER TABLE public.ai_generated_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for AI routes" ON public.ai_generated_routes;
DROP POLICY IF EXISTS "Users can insert AI routes" ON public.ai_generated_routes;
DROP POLICY IF EXISTS "Users can update their AI routes" ON public.ai_generated_routes;
DROP POLICY IF EXISTS "Users can delete their AI routes" ON public.ai_generated_routes;

CREATE POLICY "Users can view own or public preset AI routes"
    ON public.ai_generated_routes FOR SELECT
    USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert own AI routes"
    ON public.ai_generated_routes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI routes"
    ON public.ai_generated_routes FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI routes"
    ON public.ai_generated_routes FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 6. LIVE BEACONS RLS (Spectators read by code & cheer via SECURITY DEFINER RPC)
ALTER TABLE public.live_beacons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public anonymous read by beacon_code" ON public.live_beacons;
DROP POLICY IF EXISTS "Runners can create beacons" ON public.live_beacons;
DROP POLICY IF EXISTS "Runners and spectators can update beacon" ON public.live_beacons;

CREATE POLICY "Public anonymous read by beacon_code"
    ON public.live_beacons FOR SELECT
    USING (true);

CREATE POLICY "Authenticated runners can create own beacons"
    ON public.live_beacons FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Runners can update own beacons"
    ON public.live_beacons FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

GRANT EXECUTE ON FUNCTION public.increment_beacon_cheers(text) TO anon, authenticated;

-- 7. TETHER SESSIONS RLS
ALTER TABLE public.tether_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read tether sessions" ON public.tether_sessions;
DROP POLICY IF EXISTS "Public insert tether sessions" ON public.tether_sessions;
DROP POLICY IF EXISTS "Public update tether sessions" ON public.tether_sessions;

CREATE POLICY "Authenticated users can read tether sessions"
    ON public.tether_sessions FOR SELECT
    TO authenticated
    USING (
        host_user_id = auth.uid()::text
        OR peer_user_id = auth.uid()::text
        OR status = 'waiting'
    );

CREATE POLICY "Authenticated hosts can create tether sessions"
    ON public.tether_sessions FOR INSERT
    TO authenticated
    WITH CHECK (host_user_id = auth.uid()::text);

CREATE POLICY "Participants or joining peers can update tether sessions"
    ON public.tether_sessions FOR UPDATE
    TO authenticated
    USING (
        host_user_id = auth.uid()::text
        OR peer_user_id = auth.uid()::text
        OR (status = 'waiting' AND peer_user_id IS NULL)
    )
    WITH CHECK (
        host_user_id = auth.uid()::text
        OR peer_user_id = auth.uid()::text
    );

-- 8. PROFILES ANON READ REMOVAL & IMMUTABLE USERNAME GUARD
DROP POLICY IF EXISTS "Public profile search by username" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.fn_enforce_immutable_username()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.username IS NOT NULL AND length(trim(OLD.username)) > 0
       AND NEW.username IS DISTINCT FROM OLD.username THEN
        RAISE EXCEPTION 'Username cannot be changed once set.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_immutable_username ON public.profiles;
CREATE TRIGGER trg_enforce_immutable_username
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_immutable_username();

-- 9. TIGHTEN UPDATE POLICIES WITH WITH CHECK
DROP POLICY IF EXISTS "Users can update own workouts" ON public.workouts;
CREATE POLICY "Users can update own workouts" ON public.workouts
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON public.goals;
CREATE POLICY "Users can update own goals" ON public.goals
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own records" ON public.personal_records;
CREATE POLICY "Users can update own records" ON public.personal_records
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own gear" ON public.user_gear;
CREATE POLICY "Users can update own gear" ON public.user_gear
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own integrations" ON public.user_integrations;
CREATE POLICY "Users can update own integrations" ON public.user_integrations
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own participant record" ON public.challenge_participants;
CREATE POLICY "Users can update own participant record" ON public.challenge_participants
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own challenge notifications" ON public.challenge_notifications;
CREATE POLICY "Users update own challenge notifications" ON public.challenge_notifications
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 10. MISSING PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_challenge_invitations_challenge_id ON public.challenge_invitations (challenge_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_external_record ON public.workouts (user_id, source_provider, external_record_id);
CREATE INDEX IF NOT EXISTS idx_tether_sessions_host_user_id ON public.tether_sessions (host_user_id);
