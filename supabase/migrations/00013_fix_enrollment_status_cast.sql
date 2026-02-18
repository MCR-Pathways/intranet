-- Migration 00013: Fix enrollment_status type cast in complete_lesson_and_update_progress RPC
-- The status column on course_enrollments uses the enrollment_status ENUM type,
-- so text literals must be explicitly cast.

CREATE OR REPLACE FUNCTION public.complete_lesson_and_update_progress(
  p_user_id UUID,
  p_lesson_id UUID,
  p_course_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_total_lessons INTEGER;
  v_completed_lessons INTEGER;
  v_progress_percent INTEGER;
  v_is_completed BOOLEAN;
  v_current_started_at TIMESTAMPTZ;
  v_lesson_type TEXT;
  v_has_passing_attempt BOOLEAN;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Check lesson type and verify it belongs to the course
  SELECT lesson_type INTO v_lesson_type
  FROM public.course_lessons
  WHERE id = p_lesson_id AND course_id = p_course_id AND is_active = TRUE;

  IF v_lesson_type IS NULL THEN
    RAISE EXCEPTION 'Lesson not found or not active';
  END IF;

  -- For quiz lessons, verify there is a passing attempt
  IF v_lesson_type = 'quiz' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.quiz_attempts
      WHERE user_id = p_user_id AND lesson_id = p_lesson_id AND passed = TRUE
    ) INTO v_has_passing_attempt;

    IF NOT v_has_passing_attempt THEN
      RAISE EXCEPTION 'Quiz lesson requires a passing attempt before completion';
    END IF;
  END IF;

  -- Insert lesson completion (idempotent — ON CONFLICT DO NOTHING)
  INSERT INTO public.lesson_completions (user_id, lesson_id)
  VALUES (p_user_id, p_lesson_id)
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  -- Count total active lessons for the course
  SELECT COUNT(*)
  INTO v_total_lessons
  FROM public.course_lessons
  WHERE course_id = p_course_id AND is_active = TRUE;

  -- Count user's completed lessons for this course
  SELECT COUNT(*)
  INTO v_completed_lessons
  FROM public.lesson_completions lc
  JOIN public.course_lessons cl ON cl.id = lc.lesson_id
  WHERE lc.user_id = p_user_id
    AND cl.course_id = p_course_id
    AND cl.is_active = TRUE;

  -- Calculate progress
  IF v_total_lessons > 0 THEN
    v_progress_percent := ROUND((v_completed_lessons::NUMERIC / v_total_lessons) * 100);
  ELSE
    v_progress_percent := 0;
  END IF;

  v_is_completed := (v_progress_percent = 100);

  -- Get current started_at to preserve it if already set
  SELECT started_at
  INTO v_current_started_at
  FROM public.course_enrollments
  WHERE user_id = p_user_id AND course_id = p_course_id;

  -- Update enrollment progress atomically
  -- Cast text literals to enrollment_status enum type
  UPDATE public.course_enrollments
  SET
    progress_percent = v_progress_percent,
    status = CASE
      WHEN v_is_completed THEN 'completed'::enrollment_status
      WHEN v_progress_percent > 0 THEN 'in_progress'::enrollment_status
      ELSE 'enrolled'::enrollment_status
    END,
    started_at = COALESCE(v_current_started_at, v_now),
    completed_at = CASE
      WHEN v_is_completed THEN v_now
      ELSE completed_at
    END
  WHERE user_id = p_user_id AND course_id = p_course_id;

  RETURN v_progress_percent;
END;
$$;
