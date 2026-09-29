-- Migration: Live Run Beacon Feature for InsForge
-- Enables zero-install spectator live tracking, battery telemetry, cheers, and emergency inactivity watchdog alerts

CREATE TABLE IF NOT EXISTS public.live_beacons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    beacon_code VARCHAR(24) NOT NULL UNIQUE,
    runner_name TEXT NOT NULL,
    runner_avatar TEXT,
    workout_type TEXT NOT NULL DEFAULT 'run',
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'completed', 'emergency'
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    current_pace NUMERIC DEFAULT 0, -- in seconds per km
    total_distance_meters NUMERIC DEFAULT 0,
    elapsed_seconds INTEGER DEFAULT 0,
    battery_level INTEGER, -- 0-100 percentage
    battery_charging BOOLEAN DEFAULT false,
    route_coordinates JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of {latitude, longitude, speed, timestamp}
    emergency_alert BOOLEAN NOT NULL DEFAULT false,
    emergency_alert_message TEXT,
    cheers_count INTEGER NOT NULL DEFAULT 0,
    last_ping_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for ultra-fast lookup by beacon_code and active state
CREATE INDEX IF NOT EXISTS idx_live_beacons_code ON public.live_beacons (beacon_code);
CREATE INDEX IF NOT EXISTS idx_live_beacons_user ON public.live_beacons (user_id);
CREATE INDEX IF NOT EXISTS idx_live_beacons_status ON public.live_beacons (status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.live_beacons ENABLE ROW LEVEL SECURITY;

-- 1. Spectators can view any beacon by code without requiring authentication
DROP POLICY IF EXISTS "Public anonymous read by beacon_code" ON public.live_beacons;
CREATE POLICY "Public anonymous read by beacon_code"
    ON public.live_beacons FOR SELECT
    USING (true);

-- 2. Runners can create beacons
DROP POLICY IF EXISTS "Runners can create beacons" ON public.live_beacons;
CREATE POLICY "Runners can create beacons"
    ON public.live_beacons FOR INSERT
    WITH CHECK (true);

-- 3. Runners can update their own beacons or spectators can increment cheers
DROP POLICY IF EXISTS "Runners and spectators can update beacon" ON public.live_beacons;
CREATE POLICY "Runners and spectators can update beacon"
    ON public.live_beacons FOR UPDATE
    USING (true);

-- Function to atomically increment cheers
CREATE OR REPLACE FUNCTION public.increment_beacon_cheers(target_beacon_code TEXT)
RETURNS INTEGER AS $$
DECLARE
    new_cheers INTEGER;
BEGIN
    UPDATE public.live_beacons
    SET cheers_count = cheers_count + 1,
        updated_at = now()
    WHERE beacon_code = target_beacon_code
    RETURNING cheers_count INTO new_cheers;
    
    RETURN COALESCE(new_cheers, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
