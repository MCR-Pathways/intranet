-- ============================================================================
-- Migration: 00006_create_news_feed_tables.sql
-- Description: Create tables for the news feed feature (posts, attachments,
--              reactions, comments, weekly roundups) with RLS policies,
--              triggers, indexes, and storage bucket.
-- ============================================================================

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- 1a. posts
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 5000),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_weekly_roundup BOOLEAN NOT NULL DEFAULT FALSE,
  weekly_roundup_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1b. post_attachments
CREATE TABLE IF NOT EXISTS public.post_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('image', 'document', 'link')),
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  link_url TEXT,
  link_title TEXT,
  link_description TEXT,
  link_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1c. post_reactions
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'celebrate', 'insightful', 'curious')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 1d. post_comments
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1e. weekly_roundups
CREATE TABLE IF NOT EXISTS public.weekly_roundups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  post_ids UUID[] DEFAULT '{}',
  pinned_until TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1f. Add FK from posts.weekly_roundup_id to weekly_roundups
DO $$ BEGIN
  ALTER TABLE public.posts
    ADD CONSTRAINT fk_posts_weekly_roundup
    FOREIGN KEY (weekly_roundup_id) REFERENCES public.weekly_roundups(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_is_pinned ON public.posts (is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_posts_is_weekly_roundup ON public.posts (is_weekly_roundup) WHERE is_weekly_roundup = TRUE;

CREATE INDEX IF NOT EXISTS idx_post_attachments_post_id ON public.post_attachments (post_id);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON public.post_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON public.post_reactions (user_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON public.post_comments (created_at);

CREATE INDEX IF NOT EXISTS idx_weekly_roundups_week_start ON public.weekly_roundups (week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_roundups_pinned_until ON public.weekly_roundups (pinned_until);

-- ============================================================================
-- 3. TRIGGERS (reuse existing update_updated_at_column function)
-- ============================================================================

DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_comments_updated_at ON public.post_comments;
CREATE TRIGGER update_post_comments_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_roundups ENABLE ROW LEVEL SECURITY;

-- ---------- posts ----------

DROP POLICY IF EXISTS "Authenticated users can view posts" ON public.posts;
CREATE POLICY "Authenticated users can view posts"
  ON public.posts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff can create posts" ON public.posts;
CREATE POLICY "Staff can create posts"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Authors and HR admins can update posts" ON public.posts;
CREATE POLICY "Authors and HR admins can update posts"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id OR public.is_hr_admin());

DROP POLICY IF EXISTS "Authors and HR admins can delete posts" ON public.posts;
CREATE POLICY "Authors and HR admins can delete posts"
  ON public.posts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id OR public.is_hr_admin());

-- ---------- post_attachments ----------

DROP POLICY IF EXISTS "Authenticated users can view attachments" ON public.post_attachments;
CREATE POLICY "Authenticated users can view attachments"
  ON public.post_attachments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff can create attachments" ON public.post_attachments;
CREATE POLICY "Staff can create attachments"
  ON public.post_attachments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Post authors and HR admins can delete attachments" ON public.post_attachments;
CREATE POLICY "Post authors and HR admins can delete attachments"
  ON public.post_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_attachments.post_id
        AND (posts.author_id = auth.uid() OR public.is_hr_admin())
    )
  );

-- ---------- post_reactions ----------

DROP POLICY IF EXISTS "Authenticated users can view reactions" ON public.post_reactions;
CREATE POLICY "Authenticated users can view reactions"
  ON public.post_reactions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can add reactions" ON public.post_reactions;
CREATE POLICY "Authenticated users can add reactions"
  ON public.post_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reactions" ON public.post_reactions;
CREATE POLICY "Users can update own reactions"
  ON public.post_reactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own reactions" ON public.post_reactions;
CREATE POLICY "Users can remove own reactions"
  ON public.post_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------- post_comments ----------

DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.post_comments;
CREATE POLICY "Authenticated users can view comments"
  ON public.post_comments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can add comments" ON public.post_comments;
CREATE POLICY "Authenticated users can add comments"
  ON public.post_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Comment authors can update own comments" ON public.post_comments;
CREATE POLICY "Comment authors can update own comments"
  ON public.post_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Comment authors and HR admins can delete comments" ON public.post_comments;
CREATE POLICY "Comment authors and HR admins can delete comments"
  ON public.post_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id OR public.is_hr_admin());

-- ---------- weekly_roundups ----------

DROP POLICY IF EXISTS "Authenticated users can view weekly roundups" ON public.weekly_roundups;
CREATE POLICY "Authenticated users can view weekly roundups"
  ON public.weekly_roundups FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE for weekly_roundups is handled via service role
-- (no RLS policies for mutation — only service role key bypasses RLS)

-- ============================================================================
-- 5. STORAGE BUCKET
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-attachments',
  'post-attachments',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies

DROP POLICY IF EXISTS "Authenticated users can read post attachments" ON storage.objects;
CREATE POLICY "Authenticated users can read post attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'post-attachments');

DROP POLICY IF EXISTS "Staff can upload post attachments" ON storage.objects;
CREATE POLICY "Staff can upload post attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'post-attachments' AND public.is_staff());

DROP POLICY IF EXISTS "Staff can delete own post attachments" ON storage.objects;
CREATE POLICY "Staff can delete own post attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'post-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_hr_admin()));

-- ============================================================================
-- 6. WEEKLY ROUNDUP FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_weekly_roundup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_post_ids UUID[];
  v_roundup_id UUID;
  v_title TEXT;
  v_summary TEXT;
  v_post_count INTEGER;
  v_system_author_id UUID;
BEGIN
  -- Calculate current week boundaries (Monday to Sunday)
  v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
  v_week_end := v_week_start + INTERVAL '6 days';

  -- Check if roundup already exists for this week
  IF EXISTS (SELECT 1 FROM public.weekly_roundups WHERE week_start = v_week_start) THEN
    RETURN;
  END IF;

  -- Get all post IDs from this week (excluding roundup posts)
  SELECT ARRAY_AGG(id ORDER BY created_at DESC)
  INTO v_post_ids
  FROM public.posts
  WHERE created_at >= v_week_start::TIMESTAMPTZ
    AND created_at < (v_week_end + INTERVAL '1 day')::TIMESTAMPTZ
    AND is_weekly_roundup = FALSE;

  v_post_count := COALESCE(array_length(v_post_ids, 1), 0);

  -- Build title and summary
  v_title := 'Weekly Round Up — ' ||
    to_char(v_week_start, 'DD Mon') || ' to ' ||
    to_char(v_week_end, 'DD Mon YYYY');

  v_summary := v_post_count || ' posts shared by the team this week.';

  -- Insert the roundup record
  INSERT INTO public.weekly_roundups (week_start, week_end, title, summary, post_ids, pinned_until)
  VALUES (
    v_week_start,
    v_week_end,
    v_title,
    v_summary,
    COALESCE(v_post_ids, '{}'),
    (v_week_start + INTERVAL '10 days')::TIMESTAMPTZ  -- Pinned until following Monday
  )
  RETURNING id INTO v_roundup_id;

  -- Find a system author (first HR admin)
  SELECT id INTO v_system_author_id
  FROM public.profiles
  WHERE is_hr_admin = TRUE
  ORDER BY created_at
  LIMIT 1;

  -- Only create the pinned post if we have an author
  IF v_system_author_id IS NOT NULL THEN
    INSERT INTO public.posts (author_id, content, is_pinned, is_weekly_roundup, weekly_roundup_id)
    VALUES (
      v_system_author_id,
      v_title || E'\n\n' || v_summary || E'\n\nCheck out the full round up to see everything from this week.',
      TRUE,
      TRUE,
      v_roundup_id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpin_expired_roundups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.posts
  SET is_pinned = FALSE
  WHERE is_weekly_roundup = TRUE
    AND is_pinned = TRUE
    AND weekly_roundup_id IN (
      SELECT id FROM public.weekly_roundups
      WHERE pinned_until < NOW()
    );
END;
$$;

-- ============================================================================
-- 7. PG_CRON SCHEDULES (hosted Supabase only — fails gracefully locally)
-- ============================================================================

DO $outer$ BEGIN
  -- Generate weekly roundup every Friday at 17:00 UTC
  PERFORM cron.schedule(
    'generate-weekly-roundup',
    '0 17 * * 5',
    'SELECT public.generate_weekly_roundup()'
  );
EXCEPTION
  WHEN OTHERS THEN NULL;
END $outer$;

DO $outer$ BEGIN
  -- Unpin expired roundups every Monday at 00:05 UTC
  PERFORM cron.schedule(
    'unpin-expired-roundups',
    '5 0 * * 1',
    'SELECT public.unpin_expired_roundups()'
  );
EXCEPTION
  WHEN OTHERS THEN NULL;
END $outer$;
