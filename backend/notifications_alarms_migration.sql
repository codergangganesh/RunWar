-- ==============================================================================
-- RunWar: Notifications, Alarms, and Push Subscriptions Migration
-- Database: PostgreSQL (InsForge)
-- ==============================================================================

-- 1. ALARMS TABLE
-- Stores user-configured recurring and one-time workout reminders & alarms
CREATE TABLE IF NOT EXISTS public.alarms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    scheduled_time TIME NOT NULL, -- e.g. '06:00:00'
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    enabled BOOLEAN NOT NULL DEFAULT true,
    recurrence TEXT NOT NULL DEFAULT 'once', -- 'once' | 'daily' | 'weekly' | 'custom'
    recurrence_days INTEGER[], -- array of 0=Sun..6=Sat, NULL for once/daily
    scheduled_date DATE, -- 'YYYY-MM-DD' for 'once' type
    next_trigger_at TIMESTAMPTZ, -- UTC timestamp when next alarm will fire
    last_triggered_at TIMESTAMPTZ,
    alarm_type TEXT NOT NULL DEFAULT 'custom', -- 'morning_run' | 'evening_run' | 'stretch' | 'hydration' | 'workout' | 'custom'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alarms Indexes
CREATE INDEX IF NOT EXISTS idx_alarms_user_id ON public.alarms(user_id);
CREATE INDEX IF NOT EXISTS idx_alarms_next_trigger ON public.alarms(next_trigger_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_alarms_enabled ON public.alarms(enabled, next_trigger_at);

-- Alarms RLS Policies
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alarms_own" ON public.alarms;
CREATE POLICY "alarms_own" ON public.alarms
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- 2. NOTIFICATIONS TABLE
-- General notification center and push queue table for all notification types
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'alarm' | 'goal' | 'challenge' | 'social' | 'workout' | 'achievement' | 'system'
    subtype TEXT, -- e.g. 'morning_run', 'goal_achieved', 'badge_unlocked'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb, -- extra payload: { url, alarm_id, ... }
    alarm_id UUID REFERENCES public.alarms(id) ON DELETE SET NULL,
    scheduled_for TIMESTAMPTZ, -- intended UTC trigger time
    occurrence_key TEXT UNIQUE, -- idempotency key: '${alarm_id}:${scheduled_for_iso}'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON public.notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_status_scheduled ON public.notifications(status, scheduled_for)
    WHERE status IN ('pending', 'processing');

-- Notifications RLS Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- 3. PUSH_SUBSCRIPTIONS TABLE
-- Stores Web Push API subscriptions per device/browser for each user
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_info JSONB DEFAULT '{}'::jsonb, -- { browser, platform, language }
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    CONSTRAINT uq_push_subscriptions_user_endpoint UNIQUE (user_id, endpoint)
);

-- Push Subscriptions Indexes
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id)
    WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- Push Subscriptions RLS Policies
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_own" ON public.push_subscriptions;
CREATE POLICY "push_subs_own" ON public.push_subscriptions
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- 4. USER_SETTINGS GRANULAR PREFERENCE EXTENSIONS
-- Add notification channel columns to user_settings table
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notif_running_reminders BOOLEAN DEFAULT true;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notif_goals BOOLEAN DEFAULT true;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notif_challenges BOOLEAN DEFAULT true;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notif_social BOOLEAN DEFAULT true;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notif_achievements BOOLEAN DEFAULT true;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notif_system BOOLEAN DEFAULT true;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS quiet_hours_start VARCHAR(5) DEFAULT '22:00';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS quiet_hours_end VARCHAR(5) DEFAULT '06:00';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS quiet_hours_allow_alarms BOOLEAN DEFAULT true;

-- 5. REALTIME PUBLICATION
-- Enable realtime updates on notifications table for instant UI badge updates
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'insforge_realtime') THEN
        ALTER PUBLICATION insforge_realtime ADD TABLE public.notifications;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- If table is already in publication or publication doesn't exist, ignore
    NULL;
END $$;
