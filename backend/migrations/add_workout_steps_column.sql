-- ==============================================================================
-- RUNWAR DATABASE MIGRATION: WORKOUT STEPS & CADENCE FEATURE
-- Adds columns to public.workouts to persist session steps and running cadence
-- Fully non-destructive and backward compatible with existing workouts
-- ==============================================================================

-- 1. Add steps column (stores accumulated physical steps during the session)
ALTER TABLE public.workouts 
ADD COLUMN IF NOT EXISTS steps INTEGER DEFAULT 0;

-- 2. Add average_cadence column (stores average steps per minute / SPM during active moving time)
ALTER TABLE public.workouts 
ADD COLUMN IF NOT EXISTS average_cadence INTEGER DEFAULT 0;

-- 3. Create index for performance when aggregating or filtering by steps
CREATE INDEX IF NOT EXISTS idx_workouts_user_steps_started 
ON public.workouts(user_id, started_at DESC) 
WHERE steps > 0;

-- 4. Document columns
COMMENT ON COLUMN public.workouts.steps IS 'Accumulated physical steps tracked specifically during this workout session';
COMMENT ON COLUMN public.workouts.average_cadence IS 'Average steps per minute (SPM) during active workout moving duration';
