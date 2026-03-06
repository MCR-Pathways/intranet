-- ============================================================================
-- Migration: 00033_tiptap_mentions.sql
-- Description: Add Tiptap rich text support and @mentions to the news feed.
--   - content_json JSONB columns on posts and post_comments (nullable for
--     backward compatibility — existing plain-text posts use content TEXT)
--   - post_mentions and comment_mentions junction tables
--   - notify_mention RPC (SECURITY DEFINER) for mention notifications
--   - GIN index on posts.content for full-text search (Phase 5 prep)
-- ============================================================================

-- ============================================================================
-- 1. ADD content_json COLUMNS
-- ============================================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS content_json JSONB;

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS content_json JSONB;

-- ============================================================================
-- 2. MENTION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.post_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, mentioned_user_id)
);

CREATE TABLE IF NOT EXISTS public.comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, mentioned_user_id)
);

-- Indexes for looking up "who mentioned me?"
CREATE INDEX IF NOT EXISTS idx_post_mentions_user
  ON public.post_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_user
  ON public.comment_mentions(mentioned_user_id);

-- ============================================================================
-- 3. RLS POLICIES FOR MENTION TABLES
-- ============================================================================

ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read mentions (needed for display)
CREATE POLICY "Authenticated users can read post mentions"
  ON public.post_mentions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read comment mentions"
  ON public.comment_mentions FOR SELECT
  TO authenticated
  USING (true);

-- Post authors can insert mentions (enforced via server action, not direct client insert)
-- Using permissive policy since mentions are always inserted by the post/comment author
-- via server actions that validate ownership
CREATE POLICY "Authenticated users can insert post mentions"
  ON public.post_mentions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert comment mentions"
  ON public.comment_mentions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authors can delete mentions (for edit scenarios)
CREATE POLICY "Authenticated users can delete post mentions"
  ON public.post_mentions FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete comment mentions"
  ON public.comment_mentions FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- 4. NOTIFY_MENTION RPC (SECURITY DEFINER)
-- ============================================================================

-- Helper: check if the current user can create posts (staff or pathways_coordinator)
-- This may already exist from a previous migration; CREATE OR REPLACE is safe.
CREATE OR REPLACE FUNCTION public.can_create_posts()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND user_type IN ('staff', 'pathways_coordinator')
  );
$$;

CREATE OR REPLACE FUNCTION public.notify_mention(
  p_mentioned_user_ids UUID[],
  p_mentioner_id UUID,
  p_entity_type TEXT,  -- 'post' or 'comment'
  p_entity_id UUID,
  p_post_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mentioner_name TEXT;
  v_notification_count INTEGER := 0;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
BEGIN
  -- Authorization: only active staff/coordinators can trigger mention notifications
  IF NOT public.can_create_posts() THEN
    RAISE EXCEPTION 'Unauthorised: only active users can send mention notifications';
  END IF;

  -- Get mentioner's display name
  SELECT COALESCE(preferred_name, full_name, 'Someone')
    INTO v_mentioner_name
    FROM public.profiles
    WHERE id = p_mentioner_id;

  -- Build notification content
  IF p_entity_type = 'post' THEN
    v_title := 'You were mentioned in a post';
    v_message := v_mentioner_name || ' mentioned you in a post.';
    v_link := '/intranet';
  ELSIF p_entity_type = 'comment' THEN
    v_title := 'You were mentioned in a comment';
    v_message := v_mentioner_name || ' mentioned you in a comment.';
    v_link := '/intranet';
  ELSE
    RETURN 0;
  END IF;

  -- Insert notifications for all mentioned users (skip self-mentions)
  WITH inserted AS (
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    SELECT
      unnest(p_mentioned_user_ids),
      'mention',
      v_title,
      v_message,
      v_link,
      jsonb_build_object(
        'entity_type', p_entity_type,
        'entity_id', p_entity_id,
        'post_id', p_post_id,
        'mentioner_id', p_mentioner_id
      )
    WHERE unnest(p_mentioned_user_ids) != p_mentioner_id
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_notification_count FROM inserted;

  RETURN v_notification_count;
END;
$$;

-- ============================================================================
-- 5. FULL-TEXT SEARCH INDEX (prep for Phase 5 universal search)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_posts_content_fts
  ON public.posts
  USING gin(to_tsvector('english', content));
