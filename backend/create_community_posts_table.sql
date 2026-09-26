-- ============================================================================
-- RUNWAR DATABASE MIGRATION: COMMUNITY POSTS, REACTIONS & COMMENTS SYSTEM
-- Author: RunWar Engineering
-- Database Platform: InsForge PostgreSQL Backend (https://7p7ewmvi.us-east.insforge.app)
-- 
-- Instructions:
-- Copy and paste the contents of this file directly into the SQL Editor in
-- your InsForge Dashboard and click "Run".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: CREATE OR ENHANCE COMMUNITY_POSTS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_posts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL DEFAULT 'War Runner',
    user_avatar TEXT,
    user_badge TEXT DEFAULT 'Athlete',
    workout_id UUID,
    workout_data JSONB,
    caption TEXT,
    fire_ups_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    location_name TEXT DEFAULT 'Global Sector',
    territory_claimed TEXT,
    visibility TEXT NOT NULL DEFAULT 'public', -- 'public' | 'friends' | 'private'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure comments_count column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'community_posts' 
          AND column_name = 'comments_count'
    ) THEN
        ALTER TABLE public.community_posts ADD COLUMN comments_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Ensure fire_ups_count column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'community_posts' 
          AND column_name = 'fire_ups_count'
    ) THEN
        ALTER TABLE public.community_posts ADD COLUMN fire_ups_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON public.community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_visibility ON public.community_posts(visibility);

-- Workout Deduplication Index: Prevents an athlete from publishing the exact same workout run twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_posts_unique_workout 
ON public.community_posts(user_id, workout_id) 
WHERE workout_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- STEP 2: CREATE NORMALIZED COMMUNITY_COMMENTS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL DEFAULT 'Athlete',
    user_avatar TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON public.community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_user_id ON public.community_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_created_at ON public.community_comments(created_at ASC);

-- ----------------------------------------------------------------------------
-- STEP 3: CREATE NORMALIZED COMMUNITY_REACTIONS TABLE (FIRE UPS)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL DEFAULT 'fire_up',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(post_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_community_reactions_post_id ON public.community_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_user_id ON public.community_reactions(user_id);

-- ----------------------------------------------------------------------------
-- STEP 4: SELF-INTERACTION GUARDS (INTEGRITY TRIGGERS)
-- ----------------------------------------------------------------------------

-- Guard 1: Prevent athletes from Firing Up (liking) their own post
CREATE OR REPLACE FUNCTION public.fn_prevent_self_reaction()
RETURNS TRIGGER AS $$
DECLARE
    post_author_id UUID;
BEGIN
    SELECT user_id INTO post_author_id FROM public.community_posts WHERE id = NEW.post_id;
    IF post_author_id IS NOT NULL AND post_author_id = NEW.user_id THEN
        RAISE EXCEPTION 'Athletes cannot fire up their own workouts.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_self_reaction ON public.community_reactions;
CREATE TRIGGER trg_prevent_self_reaction
BEFORE INSERT ON public.community_reactions
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_self_reaction();

-- Guard 2: Prevent post author from submitting comments on their own post
CREATE OR REPLACE FUNCTION public.fn_prevent_self_comment()
RETURNS TRIGGER AS $$
DECLARE
    post_author_id UUID;
BEGIN
    SELECT user_id INTO post_author_id FROM public.community_posts WHERE id = NEW.post_id;
    IF post_author_id IS NOT NULL AND post_author_id = NEW.user_id THEN
        RAISE EXCEPTION 'Post authors cannot comment on their own workouts.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_self_comment ON public.community_comments;
CREATE TRIGGER trg_prevent_self_comment
BEFORE INSERT ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_self_comment();

-- ----------------------------------------------------------------------------
-- STEP 5: AUTOMATED COUNTER AGGREGATION TRIGGERS
-- ----------------------------------------------------------------------------

-- Fire Ups Count Synchronizer
CREATE OR REPLACE FUNCTION public.fn_sync_fire_ups_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.community_posts
        SET fire_ups_count = fire_ups_count + 1, updated_at = now()
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.community_posts
        SET fire_ups_count = GREATEST(0, fire_ups_count - 1), updated_at = now()
        WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_fire_ups ON public.community_reactions;
CREATE TRIGGER trg_sync_fire_ups
AFTER INSERT OR DELETE ON public.community_reactions
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_fire_ups_count();

-- Comments Count Synchronizer
CREATE OR REPLACE FUNCTION public.fn_sync_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.community_posts
        SET comments_count = comments_count + 1, updated_at = now()
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.community_posts
        SET comments_count = GREATEST(0, comments_count - 1), updated_at = now()
        WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_comments ON public.community_comments;
CREATE TRIGGER trg_sync_comments
AFTER INSERT OR DELETE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_comments_count();

-- ----------------------------------------------------------------------------
-- STEP 6: DATA MIGRATION — EXTRACT EXISTING JSONB COMMENTS (IF PRESENT)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    post_row RECORD;
    comment_elem JSONB;
    c_user_id UUID;
    c_user_name TEXT;
    c_avatar TEXT;
    c_content TEXT;
    c_created_at TIMESTAMPTZ;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'community_posts' 
          AND column_name = 'comments'
    ) THEN
        FOR post_row IN SELECT id, comments FROM public.community_posts WHERE comments IS NOT NULL AND jsonb_array_length(comments) > 0 LOOP
            FOR comment_elem IN SELECT * FROM jsonb_array_elements(post_row.comments) LOOP
                BEGIN
                    c_user_id := (comment_elem->>'userId')::UUID;
                EXCEPTION WHEN OTHERS THEN
                    c_user_id := NULL;
                END;
                
                c_content := comment_elem->>'text';
                c_user_name := COALESCE(comment_elem->>'userName', 'Athlete');
                c_avatar := comment_elem->>'userAvatar';
                c_created_at := COALESCE((comment_elem->>'timestamp')::TIMESTAMPTZ, now());

                IF c_user_id IS NOT NULL AND c_content IS NOT NULL AND trim(c_content) != '' THEN
                    INSERT INTO public.community_comments (post_id, user_id, user_name, user_avatar, content, created_at)
                    VALUES (post_row.id, c_user_id, c_user_name, c_avatar, c_content, c_created_at)
                    ON CONFLICT DO NOTHING;
                END IF;
            END LOOP;
        END LOOP;
    END IF;
END $$;

-- Recalculate accurate baseline counts
UPDATE public.community_posts p
SET 
    comments_count = (SELECT count(*) FROM public.community_comments c WHERE c.post_id = p.id),
    fire_ups_count = (SELECT count(*) FROM public.community_reactions r WHERE r.post_id = p.id);

-- ----------------------------------------------------------------------------
-- STEP 7: ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

-- 1. COMMUNITY POSTS RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Authenticated athletes can publish posts" ON public.community_posts;
DROP POLICY IF EXISTS "Allow athletes to interact with posts" ON public.community_posts;
DROP POLICY IF EXISTS "Authors can delete their own posts" ON public.community_posts;
DROP POLICY IF EXISTS "Authors can update their own posts" ON public.community_posts;

CREATE POLICY "Anyone can view public community posts" ON public.community_posts
    FOR SELECT USING (
        visibility = 'public' 
        OR user_id = auth.uid()
        OR auth.uid() IS NOT NULL
    );

CREATE POLICY "Authenticated athletes can publish posts" ON public.community_posts
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

-- Crucial Security Fix: ONLY the post author can update post data (captions, visibility)
CREATE POLICY "Authors can update their own posts" ON public.community_posts
    FOR UPDATE USING (
        auth.uid() = user_id
    ) WITH CHECK (
        auth.uid() = user_id
    );

CREATE POLICY "Authors can delete their own posts" ON public.community_posts
    FOR DELETE USING (
        auth.uid() = user_id
    );

-- 2. COMMUNITY COMMENTS RLS
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comments" ON public.community_comments;
DROP POLICY IF EXISTS "Authenticated athletes can add comments" ON public.community_comments;
DROP POLICY IF EXISTS "Authors and comment owners can delete comments" ON public.community_comments;

CREATE POLICY "Anyone can view comments" ON public.community_comments
    FOR SELECT USING (true);

-- Athletes can add comments, but NOT on their own post
CREATE POLICY "Authenticated athletes can add comments" ON public.community_comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        AND auth.uid() != (SELECT user_id FROM public.community_posts WHERE id = post_id)
    );

-- Commenter can delete their own comment OR post author can delete ANY comment on their post (Moderation)
CREATE POLICY "Authors and comment owners can delete comments" ON public.community_comments
    FOR DELETE USING (
        auth.uid() = user_id 
        OR auth.uid() = (SELECT user_id FROM public.community_posts WHERE id = post_id)
    );

-- 3. COMMUNITY REACTIONS RLS
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reactions" ON public.community_reactions;
DROP POLICY IF EXISTS "Users can toggle own reactions" ON public.community_reactions;
DROP POLICY IF EXISTS "Users can add own reactions" ON public.community_reactions;
DROP POLICY IF EXISTS "Users can delete own reactions" ON public.community_reactions;

CREATE POLICY "Anyone can view reactions" ON public.community_reactions
    FOR SELECT USING (true);

-- Athletes can add reaction, but NOT on their own post
CREATE POLICY "Users can add own reactions" ON public.community_reactions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        AND auth.uid() != (SELECT user_id FROM public.community_posts WHERE id = post_id)
    );

CREATE POLICY "Users can delete own reactions" ON public.community_reactions
    FOR DELETE USING (
        auth.uid() = user_id
    );
