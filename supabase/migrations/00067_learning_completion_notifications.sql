-- Migration 00067: Learning completion & assignment notifications
-- Adds a trigger on course_enrolments that creates a notification
-- when a learner completes a course, and notifies the learner's
-- line manager.

-- ===========================================
-- FUNCTION: notify_course_completed
-- Fires on course_enrolments when status changes to 'completed'
-- ===========================================

CREATE OR REPLACE FUNCTION public.notify_course_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course_title TEXT;
  v_user_name TEXT;
  v_line_manager_id UUID;
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Fetch course title
    SELECT title INTO v_course_title
    FROM public.courses
    WHERE id = NEW.course_id;

    -- Fetch user name and line manager
    SELECT full_name, line_manager_id
    INTO v_user_name, v_line_manager_id
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- Notify the learner
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.user_id,
      'course_completed',
      'Course Completed',
      'Congratulations! You have completed "' || COALESCE(v_course_title, 'Unknown') || '".',
      '/learning/my-courses'
    );

    -- Notify the line manager (if they have one)
    IF v_line_manager_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_line_manager_id,
        'team_course_completed',
        'Course Completed by Team Member',
        COALESCE(v_user_name, 'A team member') || ' has completed "' || COALESCE(v_course_title, 'Unknown') || '".',
        '/learning/admin/reports'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ===========================================
-- TRIGGER: on course_enrolments completion
-- ===========================================

DROP TRIGGER IF EXISTS trg_notify_course_completed ON public.course_enrolments;
CREATE TRIGGER trg_notify_course_completed
  AFTER UPDATE OF status ON public.course_enrolments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_course_completed();
