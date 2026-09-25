-- ============================================================================
-- RUNWAR POSTGRESQL FEATURE MIGRATION: UNIQUE USERNAME & CHALLENGE SYSTEM
-- Author: RunWar Engineering
-- Database Platform: InsForge PostgreSQL Backend
-- 
-- Instructions:
-- Copy and paste the contents of this file directly into the SQL Editor in
-- your InsForge Dashboard (https://7p7ewmvi.us-east.insforge.app) and click "Run".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: ADD UNIQUE USERNAME COLUMNS & CONSTRAINTS TO PROFILES TABLE
-- ----------------------------------------------------------------------------

-- Add username and username_updated_at timestamp tracking columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username VARCHAR(30),
ADD COLUMN IF NOT EXISTS username_updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

-- Add Unique Constraint on username to guarantee database-level uniqueness
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_profiles_username'
    ) THEN 
        ALTER TABLE public.profiles ADD CONSTRAINT unique_profiles_username UNIQUE (username);
    END IF;
END $$;

-- Case-Insensitive B-Tree Index for sub-millisecond @username searches & live checking
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));

-- Ensure user_settings table and pocket_unlock_mode column exist
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    auto_pause BOOLEAN DEFAULT true,
    auto_pause_threshold INTEGER DEFAULT 3,
    audio_coaching BOOLEAN DEFAULT true,
    audio_frequency TEXT DEFAULT '1km',
    distance_unit TEXT DEFAULT 'km',
    pace_unit TEXT DEFAULT 'min_km',
    weight_unit TEXT DEFAULT 'kg',
    theme TEXT DEFAULT 'system',
    gps_accuracy_mode TEXT DEFAULT 'high',
    notifications_enabled BOOLEAN DEFAULT true,
    haptics_enabled BOOLEAN DEFAULT true,
    pocket_unlock_mode TEXT DEFAULT 'both',
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS pocket_unlock_mode TEXT DEFAULT 'both';


-- ----------------------------------------------------------------------------
-- STEP 2: ENSURE CHALLENGES TABLE STRUCTURE & USERNAME IDENTIFIERS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    challenge_type TEXT NOT NULL DEFAULT 'distance_race', -- 'distance_race' | 'distance_goal' | 'time_challenge'
    target_distance_meters NUMERIC NOT NULL,
    target_duration_seconds INTEGER,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'active' | 'completed' | 'rejected' | 'expired' | 'cancelled'
    start_window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    start_window_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    winner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_challenges_creator ON public.challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);

-- Participant tracking table
CREATE TABLE IF NOT EXISTS public.challenge_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'invitee', -- 'creator' | 'invitee'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected' | 'active' | 'completed' | 'abandoned'
    joined_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    current_distance_meters NUMERIC DEFAULT 0,
    current_duration_seconds INTEGER DEFAULT 0,
    current_pace NUMERIC DEFAULT 0,
    completion_distance_meters NUMERIC,
    completion_duration_seconds INTEGER,
    completion_position INTEGER,
    associated_workout_id UUID,
    last_ping_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON public.challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON public.challenge_participants(challenge_id);

-- Invitation tracking with username support
CREATE TABLE IF NOT EXISTS public.challenge_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_username TEXT,
    invite_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled'
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT now(),
    accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_challenge_invitations_token ON public.challenge_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_challenge_invitations_recipient ON public.challenge_invitations(recipient_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invitations_sender ON public.challenge_invitations(sender_id);

-- Prevent self-challenge at the database engine level
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_prevent_self_challenge'
    ) THEN 
        ALTER TABLE public.challenge_invitations 
        ADD CONSTRAINT check_prevent_self_challenge CHECK (sender_id <> recipient_id);
    END IF;
END $$;

-- Challenge Notifications Table
CREATE TABLE IF NOT EXISTS public.challenge_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_notifications_user ON public.challenge_notifications(user_id, is_read);


-- ----------------------------------------------------------------------------
-- STEP 3: ROW-LEVEL SECURITY (RLS) POLICIES FOR ATHLETE PRIVACY
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_notifications ENABLE ROW LEVEL SECURITY;

-- Allow public lookup of basic profile fields (name, username, avatar) for all authenticated athletes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public profile search by username') THEN
        CREATE POLICY "Public profile search by username" ON public.profiles
            FOR SELECT USING (is_suspended IS NOT TRUE);
    END IF;
END $$;

-- Allow user to update only their own profile
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own profile') THEN
        CREATE POLICY "Users update own profile" ON public.profiles
            FOR UPDATE USING (user_id = auth.uid());
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- FIX FOR "infinite recursion detected in policy for relation challenge_participants"
-- ----------------------------------------------------------------------------

-- Drop old recursive policies if they exist
DROP POLICY IF EXISTS "Participants can view all challenge participants" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can view challenges they participate in" ON public.challenges;
DROP POLICY IF EXISTS "Creators can update own challenges" ON public.challenges;

-- Non-recursive policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read of challenges') THEN
        CREATE POLICY "Allow authenticated read of challenges" ON public.challenges
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read of challenge_participants') THEN
        CREATE POLICY "Allow authenticated read of challenge_participants" ON public.challenge_participants
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- MIGRATION COMPLETE!
-- Your database is now configured for Unique Usernames and 1v1 Running Challenges.
-- ----------------------------------------------------------------------------
