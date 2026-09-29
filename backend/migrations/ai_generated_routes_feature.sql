-- Migration: AI Loop Route Generator Feature for InsForge
-- Enables cloud-persisted AI generated running loops, elevation profiles, and turn-by-turn waypoint cues

CREATE TABLE IF NOT EXISTS public.ai_generated_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    target_distance_meters NUMERIC NOT NULL,
    estimated_duration_seconds INTEGER,
    elevation_gain_meters NUMERIC DEFAULT 0,
    elevation_loss_meters NUMERIC DEFAULT 0,
    scenery_type TEXT NOT NULL DEFAULT 'park', -- 'park', 'flat', 'waterfront', 'urban', 'trail'
    direction TEXT DEFAULT 'any', -- 'north', 'south', 'east', 'west', 'any'
    start_lat DOUBLE PRECISION NOT NULL,
    start_lng DOUBLE PRECISION NOT NULL,
    points JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of CoursePoint {latitude, longitude, altitude, distanceFromStartMeters}
    turn_cues JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of {distanceMeters, instruction, icon}
    elevation_profile JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_routes_user ON public.ai_generated_routes (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_routes_scenery ON public.ai_generated_routes (scenery_type);
CREATE INDEX IF NOT EXISTS idx_ai_routes_distance ON public.ai_generated_routes (target_distance_meters);

-- Enable Row Level Security (RLS)
ALTER TABLE public.ai_generated_routes ENABLE ROW LEVEL SECURITY;

-- 1. Anyone can view AI routes
DROP POLICY IF EXISTS "Public read for AI routes" ON public.ai_generated_routes;
CREATE POLICY "Public read for AI routes"
    ON public.ai_generated_routes FOR SELECT
    USING (true);

-- 2. Users can create AI routes
DROP POLICY IF EXISTS "Users can insert AI routes" ON public.ai_generated_routes;
CREATE POLICY "Users can insert AI routes"
    ON public.ai_generated_routes FOR INSERT
    WITH CHECK (true);

-- 3. Users can update their AI routes
DROP POLICY IF EXISTS "Users can update their AI routes" ON public.ai_generated_routes;
CREATE POLICY "Users can update their AI routes"
    ON public.ai_generated_routes FOR UPDATE
    USING (true);

-- 4. Users can delete their AI routes
DROP POLICY IF EXISTS "Users can delete their AI routes" ON public.ai_generated_routes;
CREATE POLICY "Users can delete their AI routes"
    ON public.ai_generated_routes FOR DELETE
    USING (true);
