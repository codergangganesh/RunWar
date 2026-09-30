-- Migration: Virtual Tethered Running & Real-Time Walkie-Talkie Feature for InsForge
-- Enables long-distance pair running, telemetry synchronization, and audio push-to-talk messaging.

CREATE TABLE IF NOT EXISTS public.tether_sessions (
    id TEXT PRIMARY KEY,
    room_code VARCHAR(16) NOT NULL UNIQUE,
    host_user_id TEXT NOT NULL,
    host_name TEXT NOT NULL,
    host_avatar TEXT,
    peer_user_id TEXT,
    peer_name TEXT,
    peer_avatar TEXT,
    status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'active', 'completed', 'ended'
    target_distance_meters NUMERIC,
    communication_mode TEXT NOT NULL DEFAULT 'push_to_talk',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for room lookup and status
CREATE INDEX IF NOT EXISTS idx_tether_sessions_room_code ON public.tether_sessions (room_code);
CREATE INDEX IF NOT EXISTS idx_tether_sessions_status ON public.tether_sessions (status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.tether_sessions ENABLE ROW LEVEL SECURITY;

-- 1. Anyone can read a tether session by room code
DROP POLICY IF EXISTS "Public read tether sessions" ON public.tether_sessions;
CREATE POLICY "Public read tether sessions"
    ON public.tether_sessions FOR SELECT
    USING (true);

-- 2. Anyone can create or join a tether session
DROP POLICY IF EXISTS "Public insert tether sessions" ON public.tether_sessions;
CREATE POLICY "Public insert tether sessions"
    ON public.tether_sessions FOR INSERT
    WITH CHECK (true);

-- 3. Anyone can update a tether session
DROP POLICY IF EXISTS "Public update tether sessions" ON public.tether_sessions;
CREATE POLICY "Public update tether sessions"
    ON public.tether_sessions FOR UPDATE
    USING (true);
