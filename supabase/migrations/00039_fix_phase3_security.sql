-- ============================================================================
-- Migration: 00036_fix_phase3_security.sql
-- Description: Security fixes for Phase 3 (PR #48 review feedback).
--   1. Remove p_actor_id from notify_post_comment, use auth.uid() instead
--   2. Tighten poll_options INSERT RLS to post-author ownership check
-- ============================================================================

-- ============================================================================
-- 1. FIX notify_post_comment: use auth.uid() instead of p_actor_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_post_comment(
  p_comment_id UUID,
  p_post_id UUID,
  p_parent_comment_id UUID DEFAULT NULL,
  p_comment_preview TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
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

  -- Get actor display name (always use auth.uid(), never trust parameters)
  SELECT COALESCE(preferred_name, full_name, 'Someone')
    INTO v_actor_name
    FROM public.profiles
    WHERE id = v_actor_id;

  -- Truncate preview to 100 chars
  v_preview := LEFT(COALESCE(p_comment_preview, ''), 100);

  -- Get post author
  SELECT author_id INTO v_post_author_id
    FROM public.posts
    WHERE id = p_post_id;

  -- 1. Notify post author (if not the commenter)
  IF v_post_author_id IS NOT NULL
     AND v_post_author_id != v_actor_id THEN

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
          'actor_id', v_actor_id
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
       AND v_parent_comment_author_id != v_actor_id
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
            'actor_id', v_actor_id
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
-- 2. TIGHTEN poll_options INSERT RLS
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can insert poll options" ON public.poll_options;

-- Replace with ownership check: only post author can insert poll options
CREATE POLICY "Users can insert poll options for their own posts"
  ON public.poll_options FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE id = post_id AND author_id = auth.uid()
    )
  );
