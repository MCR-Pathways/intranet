-- Update DB-side notification-creating functions to populate source_kind +
-- source_id (added in migration 00090).
--
-- Functions updated:
--   notify_mention            — post_mention / comment_mention
--   notify_post_comment       — post_comment / comment_reply
--   notify_course_published   — course_assignment
--   notify_course_completed   — course_completion (trigger)
--
-- Behaviour preserved beyond the new columns: ON CONFLICT clauses, dedup,
-- security definer, search_path. Each function's body is reproduced in full
-- because PG functions are atomic units (no partial replace).

-- ============================================================================
-- 1. notify_mention — post_mention | comment_mention
-- ============================================================================

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
  v_source_kind TEXT;
  v_source_id TEXT;
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
    v_source_kind := 'post_mention';
    v_source_id := p_post_id::TEXT;
  ELSIF p_entity_type = 'comment' THEN
    v_title := 'You were mentioned in a comment';
    v_message := v_mentioner_name || ' mentioned you in a comment.';
    v_link := '/intranet/post/' || p_post_id || '#comment-' || p_entity_id;
    v_source_kind := 'comment_mention';
    v_source_id := p_entity_id::TEXT;
  ELSE
    RAISE EXCEPTION 'Invalid entity type provided: %', p_entity_type;
  END IF;

  -- Insert notifications for all mentioned users (skip self-mentions)
  WITH inserted AS (
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata, source_kind, source_id)
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
      ),
      v_source_kind,
      v_source_id
    WHERE unnest(p_mentioned_user_ids) != auth.uid()
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_notification_count FROM inserted;

  RETURN v_notification_count;
END;
$$;

-- ============================================================================
-- 2. notify_post_comment — post_comment | comment_reply
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
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata, source_kind, source_id)
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
        ),
        'post_comment',
        p_post_id::TEXT
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
        INSERT INTO public.notifications (user_id, type, title, message, link, metadata, source_kind, source_id)
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
          ),
          'comment_reply',
          p_parent_comment_id::TEXT
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
-- 3. notify_course_published — course_assignment
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_course_published(
  p_course_id UUID,
  p_published_by UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course RECORD;
  v_notification_count INTEGER := 0;
  v_notification_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- Authorization: only L&D admins may trigger notifications
  IF NOT public.is_ld_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only L&D admins can send course notifications';
  END IF;

  -- Get course details
  SELECT id, title, is_required INTO v_course
  FROM public.courses
  WHERE id = p_course_id;

  IF v_course.id IS NULL THEN
    RETURN 0;
  END IF;

  -- Determine notification type based on whether course is required
  IF v_course.is_required THEN
    v_notification_type := 'mandatory_course';
    v_title := 'Required Course Available';
    v_message := v_course.title || ' is now available. This course is required — please complete it before the due date.';
  ELSE
    v_notification_type := 'new_course';
    v_title := 'New Course Available';
    v_message := v_course.title || ' is now available for enrolment.';
  END IF;

  -- Insert notifications for all matching users in a single statement.
  WITH new_notifications AS (
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata, source_kind, source_id)
    SELECT DISTINCT
      p.id,
      v_notification_type,
      v_title,
      v_message,
      '/learning/courses/' || p_course_id,
      jsonb_build_object('course_id', p_course_id),
      'course_assignment',
      p_course_id::TEXT
    FROM public.course_assignments ca
    JOIN public.profiles p ON (
      (ca.assign_type = 'team' AND p.team_id = ca.assign_value::UUID)
      OR
      (ca.assign_type = 'user_type' AND p.user_type = ca.assign_value)
    )
    WHERE ca.course_id = p_course_id
      AND p.status = 'active'
      AND p.id != p_published_by  -- Don't notify the publisher
    ON CONFLICT (user_id, (metadata->>'course_id'))
    WHERE metadata->>'course_id' IS NOT NULL
    DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_notification_count FROM new_notifications;

  RETURN v_notification_count;
END;
$$;

-- ============================================================================
-- 4. notify_course_completed — course_completion (trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_course_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course_title TEXT;
  v_learner_name TEXT;
  v_manager_id UUID;
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status::TEXT = 'completed' AND (OLD.status IS NULL OR OLD.status::TEXT <> 'completed') THEN
    -- Get course title
    SELECT title INTO v_course_title
    FROM public.courses WHERE id = NEW.course_id;

    -- Get learner name
    SELECT full_name INTO v_learner_name
    FROM public.profiles WHERE id = NEW.user_id;

    -- Notify the learner
    INSERT INTO public.notifications (user_id, type, title, message, link, source_kind, source_id)
    VALUES (
      NEW.user_id,
      'course_completed',
      'Course Completed',
      'Congratulations! You have completed ' || COALESCE(v_course_title, 'a course') || '.',
      '/learning/my-courses',
      'course_completion',
      NEW.id::TEXT
    );

    -- Notify the line manager (if one exists)
    SELECT manager_id INTO v_manager_id
    FROM public.profiles WHERE id = NEW.user_id;

    IF v_manager_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, link, source_kind, source_id)
      VALUES (
        v_manager_id,
        'course_completed',
        'Team Member Completed Course',
        COALESCE(v_learner_name, 'A team member') || ' has completed ' || COALESCE(v_course_title, 'a course') || '.',
        '/learning/admin/reports',
        'course_completion',
        NEW.id::TEXT
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
