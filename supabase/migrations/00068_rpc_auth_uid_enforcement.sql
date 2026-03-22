-- Migration 00068: Enforce auth.uid() in SECURITY DEFINER RPCs
-- Prevents impersonation by validating that p_user_id matches the
-- authenticated caller. Previously, a caller could pass any UUID
-- and the function would operate on that user's data.

-- ===========================================
-- RPC: recalculate_course_progress (hardened)
-- ===========================================

CREATE OR REPLACE FUNCTION public.recalculate_course_progress(
  p_user_id UUID,
  p_course_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_lessons INTEGER;
  v_completed_lessons INTEGER;
  v_progress INTEGER;
BEGIN
  -- Enforce that the caller can only recalculate their own progress.
  -- auth.uid() is available in PostgREST/RPC context and in nested
  -- calls within the same transaction.
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s progress';
  END IF;

  -- Count total active lessons
  SELECT COUNT(*) INTO v_total_lessons
  FROM public.course_lessons
  WHERE course_id = p_course_id AND is_active = true;

  -- Count completed lessons
  SELECT COUNT(*) INTO v_completed_lessons
  FROM public.lesson_completions lc
  JOIN public.course_lessons cl ON cl.id = lc.lesson_id
  WHERE cl.course_id = p_course_id
    AND cl.is_active = true
    AND lc.user_id = p_user_id;

  -- Calculate percentage
  IF v_total_lessons > 0 THEN
    v_progress := ROUND((v_completed_lessons::numeric / v_total_lessons::numeric) * 100);
  ELSE
    v_progress := 0;
  END IF;

  -- Update enrolment
  UPDATE public.course_enrolments
  SET progress_percent = v_progress,
      status = CASE
        WHEN v_progress >= 100 THEN 'completed'::text
        WHEN v_progress > 0 THEN 'in_progress'::text
        ELSE status
      END,
      completed_at = CASE
        WHEN v_progress >= 100 AND completed_at IS NULL THEN now()
        ELSE completed_at
      END,
      started_at = CASE
        WHEN started_at IS NULL AND v_progress > 0 THEN now()
        ELSE started_at
      END,
      updated_at = now()
  WHERE user_id = p_user_id AND course_id = p_course_id;

  RETURN v_progress;
END;
$$;

-- ===========================================
-- RPC: submit_section_quiz_attempt (hardened)
-- ===========================================

CREATE OR REPLACE FUNCTION public.submit_section_quiz_attempt(
  p_user_id UUID,
  p_quiz_id UUID,
  p_section_id UUID,
  p_course_id UUID,
  p_answers JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_score INTEGER;
  v_passed BOOLEAN;
  v_correct INTEGER := 0;
  v_total INTEGER := 0;
  v_passing_score INTEGER;
  v_question RECORD;
  v_user_answer JSONB;
  v_correct_options UUID[];
  v_user_options UUID[];
BEGIN
  -- Enforce that the caller can only submit attempts as themselves.
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot submit quiz attempt as another user';
  END IF;

  -- Validate that the quiz belongs to the specified section and course
  SELECT sq.passing_score INTO v_passing_score
  FROM public.section_quizzes sq
  JOIN public.course_sections cs ON cs.id = sq.section_id
  WHERE sq.id = p_quiz_id
    AND sq.section_id = p_section_id
    AND cs.course_id = p_course_id;

  IF v_passing_score IS NULL THEN
    RAISE EXCEPTION 'Quiz not found or does not belong to the specified section/course';
  END IF;

  -- Score each question
  FOR v_question IN
    SELECT q.id, q.question_type
    FROM public.section_quiz_questions q
    WHERE q.quiz_id = p_quiz_id
    ORDER BY q.sort_order
  LOOP
    v_total := v_total + 1;

    -- Get correct options for this question
    SELECT array_agg(o.id ORDER BY o.sort_order)
    INTO v_correct_options
    FROM public.section_quiz_options o
    WHERE o.question_id = v_question.id AND o.is_correct = true;

    -- Get user's answer(s) for this question
    v_user_answer := p_answers->v_question.id::text;

    IF v_question.question_type = 'single' THEN
      -- Single: compare single UUID
      IF v_user_answer IS NOT NULL
        AND v_user_answer #>> '{}' = v_correct_options[1]::text THEN
        v_correct := v_correct + 1;
      END IF;
    ELSE
      -- Multi: compare arrays
      IF v_user_answer IS NOT NULL THEN
        SELECT array_agg(elem::uuid ORDER BY elem)
        INTO v_user_options
        FROM jsonb_array_elements_text(v_user_answer) elem;

        IF v_user_options IS NOT NULL AND v_user_options = (
          SELECT array_agg(o.id ORDER BY o.id)
          FROM public.section_quiz_options o
          WHERE o.question_id = v_question.id AND o.is_correct = true
        ) THEN
          v_correct := v_correct + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Calculate score
  IF v_total > 0 THEN
    v_score := ROUND((v_correct::numeric / v_total::numeric) * 100);
  ELSE
    v_score := 0;
  END IF;

  v_passed := v_score >= v_passing_score;

  -- Insert attempt record
  INSERT INTO public.section_quiz_attempts (user_id, quiz_id, section_id, course_id, score, passed, answers)
  VALUES (p_user_id, p_quiz_id, p_section_id, p_course_id, v_score, v_passed, p_answers);

  -- If passed, recalculate course progress
  IF v_passed THEN
    PERFORM public.recalculate_course_progress(p_user_id, p_course_id);
  END IF;

  RETURN jsonb_build_object(
    'score', v_score,
    'passed', v_passed,
    'correct_answers', v_correct,
    'total_questions', v_total,
    'passing_score', v_passing_score
  );
END;
$$;
