-- ============================================================================
-- RUNWAR DATABASE MIGRATION: SECURE PASSWORD MANAGEMENT FEATURE
-- Author: RunWar Engineering
-- Database Platform: InsForge PostgreSQL Backend (https://7p7ewmvi.us-east.insforge.app)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: ADD password_configured COLUMN TO public.profiles
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'password_configured'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN password_configured BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_password_configured ON public.profiles(user_id, password_configured);

-- ----------------------------------------------------------------------------
-- STEP 2: BACKFILL EXISTING EMAIL/PASSWORD PROFILES
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    BEGIN
        UPDATE public.profiles p
        SET password_configured = true
        FROM auth.users u
        WHERE p.user_id = u.id
          AND u.password IS NOT NULL
          AND u.password != '';
    EXCEPTION
        WHEN OTHERS THEN
            NULL;
    END;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 3: RPC FUNCTION - check_user_has_password
-- ----------------------------------------------------------------------------

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
    v_user_id := COALESCE(auth.uid(), p_user_id);
    IF v_user_id IS NULL THEN
        RETURN false;
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

GRANT EXECUTE ON FUNCTION public.check_user_has_password(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- STEP 4: RPC FUNCTION - set_account_password
-- Attaches a bcrypt-hashed password to auth.users.password and updates profiles
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_account_password(p_new_password text, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := COALESCE(auth.uid(), p_user_id);
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated. Please sign in again.';
    END IF;

    -- Validate requirements: min 8 chars, 1 uppercase, 1 lowercase, 1 number
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

    -- Update auth.users password using bcrypt
    UPDATE auth.users
    SET 
        password = crypt(p_new_password, gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = v_user_id;

    -- Update public.profiles metadata flag
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

GRANT EXECUTE ON FUNCTION public.set_account_password(text, uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- STEP 5: RPC FUNCTION - change_account_password
-- ----------------------------------------------------------------------------

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
    v_user_id := COALESCE(auth.uid(), p_user_id);
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated. Please sign in again.';
    END IF;

    -- Fetch current password hash from auth.users
    SELECT password INTO v_hashed
    FROM auth.users
    WHERE id = v_user_id;

    -- Verify current password with crypt
    IF v_hashed IS NOT NULL AND v_hashed != '' THEN
        IF crypt(p_current_password, v_hashed) != v_hashed THEN
            RAISE EXCEPTION 'Current password is incorrect';
        END IF;
    END IF;

    -- Validate new password requirements
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

    -- Update auth.users password using bcrypt
    UPDATE auth.users
    SET 
        password = crypt(p_new_password, gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = v_user_id;

    -- Update public.profiles metadata flag
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

GRANT EXECUTE ON FUNCTION public.change_account_password(text, text, uuid) TO authenticated, anon;
