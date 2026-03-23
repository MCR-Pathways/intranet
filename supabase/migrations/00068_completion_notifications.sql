-- Notify learner + line manager when a course is completed.
-- Fires on INSERT OR UPDATE (covers both progressive completion and admin direct-inserts).

-- ===========================================
-- FUNCTION: notify_course_completed
-- ===========================================

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
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.user_id,
      'course_completed',
      'Course Completed',
      'Congratulations! You have completed ' || COALESCE(v_course_title, 'a course') || '.',
      '/learning/my-courses'
    );

    -- Notify the line manager (if one exists)
    SELECT manager_id INTO v_manager_id
    FROM public.profiles WHERE id = NEW.user_id;

    IF v_manager_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_manager_id,
        'course_completed',
        'Team Member Completed Course',
        COALESCE(v_learner_name, 'A team member') || ' has completed ' || COALESCE(v_course_title, 'a course') || '.',
        '/learning/admin/reports'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ===========================================
-- TRIGGER: on course_enrolments insert or update
-- ===========================================

DROP TRIGGER IF EXISTS trg_notify_course_completed ON public.course_enrolments;
CREATE TRIGGER trg_notify_course_completed
  AFTER INSERT OR UPDATE OF status ON public.course_enrolments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_course_completed();
