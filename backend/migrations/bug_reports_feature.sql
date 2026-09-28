-- ============================================================================
-- RUNWAR DATABASE MIGRATION: SECURE BUG REPORTING SYSTEM
-- Platform: InsForge PostgreSQL Backend (https://7p7ewmvi.us-east.insforge.app)
-- ============================================================================

-- 1. SEQUENCE & CODE GENERATOR FOR REPORT IDs (e.g. BR-20260928-0001)
CREATE SEQUENCE IF NOT EXISTS public.bug_report_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_bug_report_code()
RETURNS TRIGGER AS $$
DECLARE
    today_str TEXT := to_char(NOW(), 'YYYYMMDD');
    seq_val INT := nextval('public.bug_report_code_seq');
BEGIN
    NEW.report_code := 'BR-' || today_str || '-' || lpad(seq_val::text, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CREATE BUG_REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_code VARCHAR(32) UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    steps_to_reproduce TEXT,
    expected_behavior TEXT,
    actual_behavior TEXT,
    screenshot_urls JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { url, key, name, size }
    app_version VARCHAR(30) DEFAULT '1.0.0',
    platform VARCHAR(50),
    os_version VARCHAR(80),
    device_info JSONB DEFAULT '{}'::jsonb,
    screen_size VARCHAR(100),
    reported_from VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    email_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
    admin_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for auto-generating human-readable report code
DROP TRIGGER IF EXISTS trg_set_bug_report_code ON public.bug_reports;
CREATE TRIGGER trg_set_bug_report_code
    BEFORE INSERT ON public.bug_reports
    FOR EACH ROW
    WHEN (NEW.report_code IS NULL)
    EXECUTE FUNCTION public.generate_bug_report_code();

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON public.bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON public.bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_code ON public.bug_reports(report_code);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current user is an authorized admin
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (
        auth.jwt() ->> 'email' = 'mannamganeshbabu8@gmail.com'
        OR EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
              AND email = 'mannamganeshbabu8@gmail.com'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies if re-running
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can create bug reports" ON public.bug_reports;
    DROP POLICY IF EXISTS "Users can view own bug reports" ON public.bug_reports;
    DROP POLICY IF EXISTS "Admins can update bug reports" ON public.bug_reports;
    DROP POLICY IF EXISTS "Admins can delete bug reports" ON public.bug_reports;
EXCEPTION WHEN undefined_object THEN null;
END $$;

-- Policy 1: Authenticated users can insert their own reports
CREATE POLICY "Users can create bug reports" ON public.bug_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy 2: Users can view only their own bug reports, Admins can view all
CREATE POLICY "Users can view own bug reports" ON public.bug_reports
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_app_admin());

-- Policy 3: Only admins can update reports (status, admin_notes, resolved_at)
CREATE POLICY "Admins can update bug reports" ON public.bug_reports
    FOR UPDATE
    TO authenticated
    USING (public.is_app_admin())
    WITH CHECK (public.is_app_admin());

-- Policy 4: Admins can delete spam or obsolete reports
CREATE POLICY "Admins can delete bug reports" ON public.bug_reports
    FOR DELETE
    TO authenticated
    USING (public.is_app_admin());
