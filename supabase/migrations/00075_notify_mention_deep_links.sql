-- Update notify_mention() to use standalone post page URLs.
-- Old links: /intranet?post=POST_ID and /intranet?post=POST_ID#comment-COMMENT_ID
-- New links: /intranet/post/POST_ID and /intranet/post/POST_ID#comment-COMMENT_ID

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

  -- Build notification content with deep links to the standalone post page
  IF p_entity_type = 'post' THEN
    v_title := 'You were mentioned in a post';
    v_message := v_mentioner_name || ' mentioned you in a post.';
    v_link := '/intranet/post/' || p_post_id;
  ELSIF p_entity_type = 'comment' THEN
    v_title := 'You were mentioned in a comment';
    v_message := v_mentioner_name || ' mentioned you in a comment.';
    v_link := '/intranet/post/' || p_post_id || '#comment-' || p_entity_id;
  ELSE
    RAISE EXCEPTION 'Invalid entity type provided: %', p_entity_type;
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
