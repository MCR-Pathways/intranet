-- ============================================================================
-- Migration: 00034_fix_mention_security.sql
-- Description: Fix security issues in mention tables and notify_mention RPC
--   flagged in PR #45 review:
--   1. Tighten RLS policies on post_mentions / comment_mentions so only the
--      post/comment author can insert or delete mention rows.
--   2. Use auth.uid() instead of the untrusted p_mentioner_id parameter when
--      looking up the mentioner's display name in notify_mention().
-- ============================================================================

-- ============================================================================
-- 1. REPLACE OVERLY PERMISSIVE RLS POLICIES
-- ============================================================================

-- ---------- post_mentions INSERT ----------
DROP POLICY IF EXISTS "Authenticated users can insert post mentions" ON public.post_mentions;
CREATE POLICY "Authors can insert post mentions"
  ON public.post_mentions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE id = post_id AND author_id = auth.uid()
    )
  );

-- ---------- post_mentions DELETE ----------
DROP POLICY IF EXISTS "Authenticated users can delete post mentions" ON public.post_mentions;
CREATE POLICY "Authors can delete post mentions"
  ON public.post_mentions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE id = post_id AND author_id = auth.uid()
    )
  );

-- ---------- comment_mentions INSERT ----------
DROP POLICY IF EXISTS "Authenticated users can insert comment mentions" ON public.comment_mentions;
CREATE POLICY "Authors can insert comment mentions"
  ON public.comment_mentions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.post_comments
      WHERE id = comment_id AND author_id = auth.uid()
    )
  );

-- ---------- comment_mentions DELETE ----------
DROP POLICY IF EXISTS "Authenticated users can delete comment mentions" ON public.comment_mentions;
CREATE POLICY "Authors can delete comment mentions"
  ON public.comment_mentions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.post_comments
      WHERE id = comment_id AND author_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. FIX MENTIONER ID SPOOFING IN notify_mention()
-- ============================================================================

-- Drop the old function signature first (parameter list changed)
DROP FUNCTION IF EXISTS public.notify_mention(UUID[], UUID, TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION public.notify_mention(
  p_mentioned_user_ids UUID[],
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

  -- Use auth.uid() for the mentioner name lookup, not the untrusted parameter
  SELECT COALESCE(preferred_name, full_name, 'Someone')
    INTO v_mentioner_name
    FROM public.profiles
    WHERE id = auth.uid();

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
  -- Use auth.uid() for the self-mention check as well
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
        'mentioner_id', auth.uid()
      )
    WHERE unnest(p_mentioned_user_ids) != auth.uid()
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_notification_count FROM inserted;

  RETURN v_notification_count;
END;
$$;
