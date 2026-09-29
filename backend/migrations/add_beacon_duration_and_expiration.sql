-- Migration: Add duration_limit and expires_at to public.live_beacons
-- Enables configurable sharing durations (15m, 30m, 1h, 2h, until_ended) and server-enforced expiration

ALTER TABLE public.live_beacons
ADD COLUMN IF NOT EXISTS duration_limit TEXT DEFAULT 'until_ended',
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_live_beacons_expires ON public.live_beacons (expires_at);
