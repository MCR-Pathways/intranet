-- Migration 00019: Add course notification support
-- Creates RPC to notify users when mandatory courses are published or assigned.

-- ===========================================
-- INDEX: Fast lookup of notifications by course_id in metadata
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_notifications_metadata_course_id
  ON public.notifications ((metadata->>'course_id'));

-- ===========================================
-- RPC: notify_course_published
-- Finds users matching course assignments and creates notifications.
-- ON CONFLICT prevents duplicate notifications for the same user + course.
-- ===========================================

CREATE OR REPLACE FUNCTION public.notify_course_published(
  p_course_id UUID,
  p_published_by UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_course RECORD;
  v_user_ids UUID[];
  v_notification_count INTEGER := 0;
  v_user_id UUID;
  v_notification_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
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

  -- Collect user IDs from course assignments
  -- Assignment types: 'team' (assign_value = team UUID) or 'user_type' (assign_value = 'staff'/'pathways_coordinator')
  SELECT ARRAY_AGG(DISTINCT p.id)
  INTO v_user_ids
  FROM public.course_assignments ca
  JOIN public.profiles p ON (
    (ca.assign_type = 'team' AND p.team_id = ca.assign_value::UUID)
    OR
    (ca.assign_type = 'user_type' AND p.user_type = ca.assign_value)
  )
  WHERE ca.course_id = p_course_id
    AND p.status = 'active'
    AND p.id != p_published_by;  -- Don't notify the publisher

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Create notifications for each user (skip duplicates)
  FOREACH v_user_id IN ARRAY v_user_ids
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_user_id,
      v_notification_type,
      v_title,
      v_message,
      '/learning/courses/' || p_course_id,
      jsonb_build_object('course_id', p_course_id)
    )
    ON CONFLICT DO NOTHING;

    v_notification_count := v_notification_count + 1;
  END LOOP;

  RETURN v_notification_count;
END;
$$;
