-- Migration 00022: Fix notification RPC security
-- Changes notify_course_published from SECURITY INVOKER to SECURITY DEFINER.
--
-- Bug: The RPC ran as the calling user (admin), but the notifications table
-- has no INSERT RLS policy for authenticated users. This caused notification
-- inserts to be silently blocked by RLS. SECURITY DEFINER makes the function
-- run with the DB owner's privileges, bypassing RLS — the standard pattern
-- for system-level operations like creating notifications for other users.
--
-- Additional hardening (addresses review feedback):
-- 1. Authorization: Only L&D admins can call this function (is_ld_admin() check)
-- 2. Performance: Replaced FOREACH loop with single INSERT...SELECT + RETURNING
--    for O(1) round-trips and accurate inserted-row count

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
  -- Uses INSERT...SELECT instead of a FOREACH loop for better performance.
  -- RETURNING + count(*) gives the accurate number of rows actually inserted
  -- (excluding duplicates skipped by ON CONFLICT DO NOTHING).
  WITH new_notifications AS (
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    SELECT DISTINCT
      p.id,
      v_notification_type,
      v_title,
      v_message,
      '/learning/courses/' || p_course_id,
      jsonb_build_object('course_id', p_course_id)
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
