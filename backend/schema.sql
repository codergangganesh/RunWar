-- RunWar PostgreSQL Database Schema for InsForge
-- Enables complete jogging, running, GPS tracking, analytics, goals, streaks, achievements, and PR tracking

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
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
    created_at TIMESTAMPTZ DEFAULT now(),
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

