-- Migration: Add profile_completed and daily_step_goal to public.profiles table
-- Ensures deterministic onboarding routing and first-time profile completion gating

-- 1. Add profile_completed boolean flag with default false
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false;

-- 2. Add daily_step_goal integer with default 10,000 steps
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS daily_step_goal INTEGER DEFAULT 10000;

-- 3. Backfill existing active profiles with an established username as completed
UPDATE public.profiles 
SET profile_completed = true 
WHERE username IS NOT NULL AND TRIM(username) != '';
