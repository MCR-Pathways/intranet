-- ============================================================================
-- Migration: 00034_comment_notifications_and_polls.sql
-- Description: Phase 3 of the intranet overhaul.
--   - notify_post_comment RPC for comment/reply notifications
--   - Deduplication index on notifications for comments
--   - Poll tables (poll_options, poll_votes) with RLS
--   - Poll columns on posts table (poll_question, poll_closes_at)
-- ============================================================================

-- ============================================================================
-- 1. COMMENT NOTIFICATION RPC
-- ============================================================================

-- Deduplication index: prevent duplicate notifications for the same comment
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_comment
  ON public.notifications (user_id, (metadata->>'comment_id'))
  WHERE metadata->>'comment_id' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_post_comment(
  p_comment_id UUID,
  p_post_id UUID,
  p_actor_id UUID,
  p_parent_comment_id UUID DEFAULT NULL,
  p_comment_preview TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id UUID;
  v_parent_comment_author_id UUID;
  v_actor_name TEXT;
  v_count INTEGER := 0;
  v_preview TEXT;
  v_already_mentioned BOOLEAN;
BEGIN
  -- Authorization: only active staff/coordinators can trigger notifications
  IF NOT public.can_create_posts() THEN
    RAISE EXCEPTION 'Unauthorised: only active users can send comment notifications';
  END IF;

  -- Get actor display name
  SELECT COALESCE(preferred_name, full_name, 'Someone')
    INTO v_actor_name
    FROM public.profiles
    WHERE id = p_actor_id;

  -- Truncate preview to 100 chars
  v_preview := LEFT(COALESCE(p_comment_preview, ''), 100);

  -- Get post author
  SELECT author_id INTO v_post_author_id
    FROM public.posts
    WHERE id = p_post_id;

  -- 1. Notify post author (if not the commenter)
  IF v_post_author_id IS NOT NULL
     AND v_post_author_id != p_actor_id THEN

    -- Check if a mention notification already exists for this comment + user
    -- (mention is more specific, so skip the comment notification)
    SELECT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = v_post_author_id
        AND type = 'mention'
        AND metadata->>'entity_id' = p_comment_id::TEXT
    ) INTO v_already_mentioned;

    IF NOT v_already_mentioned THEN
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
      VALUES (
        v_post_author_id,
        'post_comment',
        v_actor_name || ' commented on your post',
        v_preview,
        '/intranet',
        jsonb_build_object(
          'post_id', p_post_id,
          'comment_id', p_comment_id,
          'actor_id', p_actor_id
        )
      )
      ON CONFLICT DO NOTHING;

      GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;
  END IF;

  -- 2. Notify parent comment author (if this is a reply)
  IF p_parent_comment_id IS NOT NULL THEN
    SELECT author_id INTO v_parent_comment_author_id
      FROM public.post_comments
      WHERE id = p_parent_comment_id;

    IF v_parent_comment_author_id IS NOT NULL
       AND v_parent_comment_author_id != p_actor_id
       AND v_parent_comment_author_id != COALESCE(v_post_author_id, '00000000-0000-0000-0000-000000000000'::UUID) THEN
       -- ^ avoid double-notifying if post author IS the parent comment author

      -- Check mention dedup for reply target too
      SELECT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_parent_comment_author_id
          AND type = 'mention'
          AND metadata->>'entity_id' = p_comment_id::TEXT
      ) INTO v_already_mentioned;

      IF NOT v_already_mentioned THEN
        INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
        VALUES (
          v_parent_comment_author_id,
          'comment_reply',
          v_actor_name || ' replied to your comment',
          v_preview,
          '/intranet',
          jsonb_build_object(
            'post_id', p_post_id,
            'comment_id', p_comment_id,
            'parent_comment_id', p_parent_comment_id,
            'actor_id', p_actor_id
          )
        )
        ON CONFLICT DO NOTHING;

        v_count := v_count + 1;
      END IF;
    END IF;
  END IF;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- 2. POLL COLUMNS ON POSTS
-- ============================================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS poll_question TEXT;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS poll_closes_at TIMESTAMPTZ;

-- ============================================================================
-- 3. POLL OPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL CHECK (char_length(option_text) BETWEEN 1 AND 100),
  display_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poll_options_post
  ON public.poll_options(post_id);

-- ============================================================================
-- 4. POLL VOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_option
  ON public.poll_votes(option_id);

CREATE INDEX IF NOT EXISTS idx_poll_votes_post_user
  ON public.poll_votes(post_id, user_id);

-- ============================================================================
-- 5. RLS POLICIES FOR POLL TABLES
-- ============================================================================

ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Poll options: all authenticated users can read
CREATE POLICY "Authenticated users can read poll options"
  ON public.poll_options FOR SELECT
  TO authenticated
  USING (true);

-- Poll options: insert handled server-side during createPost (permissive for server actions)
CREATE POLICY "Authenticated users can insert poll options"
  ON public.poll_options FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Poll votes: all authenticated users can read
CREATE POLICY "Authenticated users can read poll votes"
  ON public.poll_votes FOR SELECT
  TO authenticated
  USING (true);

-- Poll votes: users can insert their own votes
CREATE POLICY "Users can insert own poll votes"
  ON public.poll_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Poll votes: users can update their own votes (change vote)
CREATE POLICY "Users can update own poll votes"
  ON public.poll_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Poll votes: users can delete their own votes (remove vote)
CREATE POLICY "Users can delete own poll votes"
  ON public.poll_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
