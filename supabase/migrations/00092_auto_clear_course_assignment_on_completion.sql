-- Auto-Clear: when a user completes a course, mark their outstanding
-- course_assignment notifications cleared. Implemented inline in the
-- notify_course_completed trigger (vs the JS markSourceCleared helper)
-- because completion fires DB-side and we want the same SQL transaction.
--
-- Behaviour: ONLY the completing user's notifications clear (filtered by
-- user_id). Other users with the same course_assignment:course_id source
-- are unaffected. This differs from the JS helper which clears across
-- all users — the JS-driven state resolutions (leave approve, FWR decide,
-- etc.) genuinely affect every recipient, but a course completion is
-- per-learner.
--
-- All operations idempotent — CREATE OR REPLACE FUNCTION rewrites the
-- function body atomically.

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

    -- Auto-clear: this user's outstanding course_assignment notifications
    -- for this course are now resolved (they completed it). Other users'
    -- notifications for the same course_assignment:course_id are untouched.
    UPDATE public.notifications
    SET is_cleared = TRUE,
        cleared_at = NOW()
    WHERE source_kind = 'course_assignment'
      AND source_id = NEW.course_id::TEXT
      AND user_id = NEW.user_id
      AND is_cleared = FALSE;
  END IF;

  RETURN NEW;
END;
$$;
