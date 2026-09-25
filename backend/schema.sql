-- RunWar PostgreSQL Database Schema for InsForge
-- Enables complete jogging, running, GPS tracking, analytics, goals, streaks, achievements, and PR tracking

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    username VARCHAR(30) UNIQUE,
    email TEXT,
    age INTEGER,
    gender TEXT,
    height NUMERIC, -- in cm
    weight NUMERIC, -- in kg
    distance_unit TEXT DEFAULT 'km', -- 'km' or 'mi'
    pace_unit TEXT DEFAULT 'min_km', -- 'min_km' or 'min_mi'
    weight_unit TEXT DEFAULT 'kg', -- 'kg' or 'lb'
    fitness_goal TEXT DEFAULT 'general_fitness',
    typical_workout_type TEXT DEFAULT 'run',
    avatar_url TEXT,
    username_updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1B. USER_SETTINGS TABLE
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

-- 2. WORKOUTS TABLE
CREATE TABLE IF NOT EXISTS public.workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'run', -- 'run', 'jog', 'walk'
    title TEXT,
    notes TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER NOT NULL,
    moving_duration_seconds INTEGER DEFAULT 0,
    paused_duration_seconds INTEGER DEFAULT 0,
    distance_meters NUMERIC NOT NULL,
    average_pace NUMERIC NOT NULL, -- in seconds per km (or min/km)
    average_speed NUMERIC NOT NULL, -- in km/h
    max_speed NUMERIC DEFAULT 0,
    calories INTEGER NOT NULL DEFAULT 0,
    elevation_gain NUMERIC DEFAULT 0, -- in meters
    elevation_loss NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'completed',
    route_coordinates JSONB, -- simplified array of [{lat, lng, alt, accuracy, speed, timestamp}]
    splits JSONB, -- array of [{split_number, distance_meters, duration_seconds, pace}]
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. WORKOUT POINTS TABLE (High precision GPS track)
CREATE TABLE IF NOT EXISTS public.workout_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    timestamp TIMESTAMPTZ NOT NULL,
    sequence_number INTEGER NOT NULL
);

-- 4. WORKOUT SPLITS TABLE (Kilometer / Mile splits)
CREATE TABLE IF NOT EXISTS public.workout_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    split_number INTEGER NOT NULL,
    distance_meters NUMERIC NOT NULL,
    duration_seconds INTEGER NOT NULL,
    pace NUMERIC NOT NULL
);

-- 5. GOALS TABLE
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_type TEXT NOT NULL, -- 'weekly_distance', 'monthly_distance', 'workout_count', 'single_run', 'duration'
    target_value NUMERIC NOT NULL,
    current_value NUMERIC DEFAULT 0,
    period TEXT NOT NULL DEFAULT 'weekly', -- 'weekly', 'monthly', 'all_time'
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. ACHIEVEMENTS TABLE (Global definitions)
CREATE TABLE IF NOT EXISTS public.achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL, -- 'distance', 'milestones', 'consistency', 'speed'
    requirement_type TEXT NOT NULL,
    requirement_value NUMERIC NOT NULL
);

-- 7. USER ACHIEVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, achievement_id)
);

-- 8. PERSONAL RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.personal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL, -- 'fastest_1k', 'fastest_5k', 'fastest_10k', 'longest_distance', 'longest_duration', 'most_weekly_distance', 'most_monthly_distance'
    value NUMERIC NOT NULL,
    workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
    achieved_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, record_type)
);

-- 9. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    auto_pause BOOLEAN DEFAULT TRUE,
    auto_pause_threshold INTEGER DEFAULT 10, -- in seconds
    audio_coaching BOOLEAN DEFAULT TRUE,
    audio_frequency TEXT DEFAULT '1km', -- '0.5km', '1km', '5min', 'off'
    distance_unit TEXT DEFAULT 'km', -- 'km', 'mi'
    pace_unit TEXT DEFAULT 'min_km', -- 'min_km', 'min_mi'
    weight_unit TEXT DEFAULT 'kg', -- 'kg', 'lb'
    theme TEXT DEFAULT 'system', -- 'light', 'dark', 'system'
    gps_accuracy_mode TEXT DEFAULT 'high',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    haptics_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- CREATE INDEXES FOR OPTIMAL QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_workouts_user_started ON public.workouts(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_points_workout ON public.workout_points(workout_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_workout_splits_workout ON public.workout_splits(workout_id, split_number);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON public.goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_records_user ON public.personal_records(user_id);

-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- DROP EXISTING POLICIES TO PREVENT DUPLICATION
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

    DROP POLICY IF EXISTS "Users can view own workouts" ON public.workouts;
    DROP POLICY IF EXISTS "Users can insert own workouts" ON public.workouts;
    DROP POLICY IF EXISTS "Users can update own workouts" ON public.workouts;
    DROP POLICY IF EXISTS "Users can delete own workouts" ON public.workouts;

    DROP POLICY IF EXISTS "Users can view own workout points" ON public.workout_points;
    DROP POLICY IF EXISTS "Users can insert own workout points" ON public.workout_points;
    DROP POLICY IF EXISTS "Users can delete own workout points" ON public.workout_points;

    DROP POLICY IF EXISTS "Users can view own splits" ON public.workout_splits;
    DROP POLICY IF EXISTS "Users can insert own splits" ON public.workout_splits;
    DROP POLICY IF EXISTS "Users can delete own splits" ON public.workout_splits;

    DROP POLICY IF EXISTS "Users can view own goals" ON public.goals;
    DROP POLICY IF EXISTS "Users can insert own goals" ON public.goals;
    DROP POLICY IF EXISTS "Users can update own goals" ON public.goals;
    DROP POLICY IF EXISTS "Users can delete own goals" ON public.goals;

    DROP POLICY IF EXISTS "Anyone can view achievements" ON public.achievements;

    DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;
    DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;

    DROP POLICY IF EXISTS "Users can view own records" ON public.personal_records;
    DROP POLICY IF EXISTS "Users can insert own records" ON public.personal_records;
    DROP POLICY IF EXISTS "Users can update own records" ON public.personal_records;
    DROP POLICY IF EXISTS "Users can delete own records" ON public.personal_records;

    DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
    DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
    DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- RLS POLICIES FOR PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON public.profiles
    FOR DELETE USING (auth.uid() = user_id);

-- RLS POLICIES FOR WORKOUTS
CREATE POLICY "Users can view own workouts" ON public.workouts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workouts" ON public.workouts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workouts" ON public.workouts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON public.workouts
    FOR DELETE USING (auth.uid() = user_id);

-- RLS POLICIES FOR WORKOUT POINTS
CREATE POLICY "Users can view own workout points" ON public.workout_points
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workout points" ON public.workout_points
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own workout points" ON public.workout_points
    FOR DELETE USING (auth.uid() = user_id);

-- RLS POLICIES FOR WORKOUT SPLITS
CREATE POLICY "Users can view own splits" ON public.workout_splits
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own splits" ON public.workout_splits
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own splits" ON public.workout_splits
    FOR DELETE USING (auth.uid() = user_id);

-- RLS POLICIES FOR GOALS
CREATE POLICY "Users can view own goals" ON public.goals
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.goals
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.goals
    FOR DELETE USING (auth.uid() = user_id);

-- RLS POLICIES FOR ACHIEVEMENTS (Read-only for all authenticated users)
CREATE POLICY "Anyone can view achievements" ON public.achievements
    FOR SELECT USING (true);

-- RLS POLICIES FOR USER ACHIEVEMENTS
CREATE POLICY "Users can view own achievements" ON public.user_achievements
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievements" ON public.user_achievements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS POLICIES FOR PERSONAL RECORDS
CREATE POLICY "Users can view own records" ON public.personal_records
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own records" ON public.personal_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own records" ON public.personal_records
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own records" ON public.personal_records
    FOR DELETE USING (auth.uid() = user_id);

-- RLS POLICIES FOR USER SETTINGS
CREATE POLICY "Users can view own settings" ON public.user_settings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- SEED STANDARD ACHIEVEMENTS
INSERT INTO public.achievements (id, name, description, icon, category, requirement_type, requirement_value)
VALUES
    ('first_run', 'First Steps', 'Complete your very first workout', 'Footprints', 'milestones', 'workout_count', 1),
    ('5k_club', '5K Finisher', 'Complete a single run of at least 5 kilometers', 'Trophy', 'distance', 'single_distance', 5000),
    ('10k_club', '10K Conqueror', 'Complete a single run of at least 10 kilometers', 'Award', 'distance', 'single_distance', 10000),
    ('half_marathon', 'Half Marathoner', 'Complete a 21.1 km run', 'Medal', 'distance', 'single_distance', 21097),
    ('distance_50k', 'Road Warrior', 'Accumulate 50 km in total running distance', 'Flame', 'milestones', 'total_distance', 50000),
    ('distance_100k', 'Century Club', 'Accumulate 100 km in total running distance', 'Crown', 'milestones', 'total_distance', 100000),
    ('workouts_10', 'Dedicated Runner', 'Complete 10 total running workouts', 'CheckCircle2', 'consistency', 'workout_count', 10),
    ('workouts_25', 'Pavement Master', 'Complete 25 total running workouts', 'Zap', 'consistency', 'workout_count', 25),
    ('streak_3', 'Hat-Trick Streak', 'Run 3 consecutive days in a row', 'Sparkles', 'consistency', 'streak_days', 3),
    ('streak_7', 'Weekly Warrior', 'Run 7 consecutive days in a row', 'Target', 'consistency', 'streak_days', 7),
    ('early_bird', 'Sunrise Runner', 'Complete a workout before 7:00 AM', 'Sunrise', 'milestones', 'early_workout', 1),
    ('night_owl', 'Night Strider', 'Complete a workout after 8:00 PM', 'Moon', 'milestones', 'night_workout', 1),
    ('speed_demon', 'Speed Demon', 'Achieve an average pace faster than 5:00 min/km', 'Gauge', 'speed', 'pace_threshold', 300),
    ('calorie_burner', 'Calorie Furnace', 'Burn more than 500 estimated kcal in one workout', 'Flame', 'milestones', 'single_calories', 500)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    category = EXCLUDED.category,
    requirement_type = EXCLUDED.requirement_type,
    requirement_value = EXCLUDED.requirement_value;

-- ============================================================
-- MIGRATION: FIREBASE PHONE OTP AUTHENTICATION SUPPORT
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON public.profiles(firebase_uid);

-- ============================================================
-- MIGRATION: EXTERNAL HEALTH PROVIDERS (Strava, Google Health)
-- ============================================================
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS source_provider TEXT DEFAULT 'runwar_gps';
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS external_record_id TEXT;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS heart_rate_avg NUMERIC;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS weather JSONB;
CREATE INDEX IF NOT EXISTS idx_workouts_source_provider ON public.workouts(user_id, source_provider);

-- ============================================================
-- 10. RUNNING SHOES & GEAR TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_gear (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    max_distance_meters NUMERIC DEFAULT 500000,
    current_distance_meters NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_gear_user ON public.user_gear(user_id);
ALTER TABLE public.user_gear ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gear" ON public.user_gear
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gear" ON public.user_gear
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gear" ON public.user_gear
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gear" ON public.user_gear
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 11. USER INTEGRATIONS TABLE (Strava, Google Health, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'strava', 'google_health', 'health_connect'
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    athlete_id TEXT,
    athlete_name TEXT,
    athlete_profile_url TEXT,
    scopes TEXT,
    is_connected BOOLEAN DEFAULT TRUE,
    auto_sync BOOLEAN DEFAULT TRUE,
    auto_upload BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMPTZ,
    synced_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON public.user_integrations(user_id);
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations" ON public.user_integrations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own integrations" ON public.user_integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own integrations" ON public.user_integrations
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own integrations" ON public.user_integrations
    FOR DELETE USING (auth.uid() = user_id);



-- ============================================================
-- MIGRATION: RUN GOAL CHALLENGE / RUNNING CHALLENGE FEATURE
-- ============================================================

-- Add unique public username to profiles for user discovery
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(LOWER(username));

-- ============================================================
-- CHALLENGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    challenge_type TEXT NOT NULL DEFAULT 'distance_race',
    -- 'distance_race' = first to cross target wi ns
    -- 'distance_goal'  = both complete target within window
    -- 'time_challenge' = run for a fixed duration
    target_distance_meters NUMERIC NOT NULL DEFAULT 5000,
    target_duration_seconds INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    -- PENDING → ACCEPTED → ACTIVE → COMPLETED | REJECTED | EXPIRED | CANCELLED
    start_window_start TIMESTAMPTZ DEFAULT now(),
    start_window_end TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
    winner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_challenges_creator ON public.challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_created ON public.challenges(created_at DESC);

-- ============================================================
-- CHALLENGE PARTICIPANTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenge_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'invitee', -- 'creator' | 'invitee'
    status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'accepted' | 'rejected' | 'active' | 'completed' | 'abandoned'
    joined_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    current_distance_meters NUMERIC DEFAULT 0,
    current_duration_seconds INTEGER DEFAULT 0,
    current_pace NUMERIC DEFAULT 0, -- seconds per km
    completion_distance_meters NUMERIC,
    completion_duration_seconds INTEGER,
    completion_position INTEGER, -- 1 = Winner, 2 = Runner-up
    associated_workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
    last_ping_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_challenge_participant UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON public.challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON public.challenge_participants(challenge_id);

-- ============================================================
-- CHALLENGE INVITATIONS TABLE
-- ============================================================
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

-- ============================================================
-- CHALLENGE NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenge_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    -- 'challenge_received' | 'challenge_accepted' | 'challenge_rejected'
    -- | 'opponent_started' | 'opponent_completed' | 'challenge_completed'
    -- | 'challenge_cancelled' | 'challenge_expired'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_notifications_user ON public.challenge_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_challenge_notifications_challenge ON public.challenge_notifications(challenge_id);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing challenge policies if any (idempotent re-apply)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view challenges they participate in" ON public.challenges;
    DROP POLICY IF EXISTS "Users can insert own challenges" ON public.challenges;
    DROP POLICY IF EXISTS "Creators can update own challenges" ON public.challenges;
    DROP POLICY IF EXISTS "Participants can view all challenge participants" ON public.challenge_participants;
    DROP POLICY IF EXISTS "Users can update own participant record" ON public.challenge_participants;
    DROP POLICY IF EXISTS "Users can insert participant records" ON public.challenge_participants;
    DROP POLICY IF EXISTS "View invitations" ON public.challenge_invitations;
    DROP POLICY IF EXISTS "Sender can create invitations" ON public.challenge_invitations;
    DROP POLICY IF EXISTS "Update invitations" ON public.challenge_invitations;
    DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.challenge_invitations;
    DROP POLICY IF EXISTS "Users view own challenge notifications" ON public.challenge_notifications;
    DROP POLICY IF EXISTS "Users update own challenge notifications" ON public.challenge_notifications;
    DROP POLICY IF EXISTS "Allow authenticated users to read public profiles" ON public.profiles;
EXCEPTION WHEN undefined_object THEN null;
END $$;

-- Profiles: allow any authenticated user to read profiles for user search/discovery
-- (existing own-profile policies remain; this is an additional read policy)
CREATE POLICY "Allow authenticated users to read public profiles" ON public.profiles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Challenges: visible only to participants or creators
CREATE POLICY "Allow authenticated read of challenges" ON public.challenges
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own challenges" ON public.challenges
    FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can update own challenges" ON public.challenges
    FOR UPDATE USING (creator_id = auth.uid());

-- Participants: co-participants in same challenge can read; each user can only write their own
CREATE POLICY "Allow authenticated read of challenge_participants" ON public.challenge_participants
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own participant record" ON public.challenge_participants
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert participant records" ON public.challenge_participants
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.creator_id = auth.uid()
        )
    );

-- Invitations: sender or recipient can view; anyone with the token can read (for deep link)
CREATE POLICY "View invitations" ON public.challenge_invitations
    FOR SELECT USING (
        sender_id = auth.uid() OR
        recipient_id = auth.uid() OR
        auth.role() = 'authenticated'
    );

CREATE POLICY "Sender can create invitations" ON public.challenge_invitations
    FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Update invitations" ON public.challenge_invitations
    FOR UPDATE USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Notifications
CREATE POLICY "Users view own challenge notifications" ON public.challenge_notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users update own challenge notifications" ON public.challenge_notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert challenge notifications" ON public.challenge_notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- MIGRATION: UNIQUE USERNAME & IMMUTABLE POLICY
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username VARCHAR(30);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure unique constraint on username
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_profiles_username'
    ) THEN 
        ALTER TABLE public.profiles ADD CONSTRAINT unique_profiles_username UNIQUE (username);
    END IF;
END $$;

-- Case-insensitive B-Tree Index for sub-millisecond search & live availability lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));


