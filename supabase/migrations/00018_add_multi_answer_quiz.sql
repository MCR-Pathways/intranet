-- Migration 00017: Add multi-answer quiz question support
-- Adds question_type to quiz_questions ('single' or 'multi')
-- Updates submit_quiz_attempt RPC to handle both answer types

-- ===========================================
-- ALTER quiz_questions: ADD question_type
-- ===========================================

DO $$ BEGIN
  ALTER TABLE public.quiz_questions
    ADD COLUMN question_type TEXT NOT NULL DEFAULT 'single'
    CHECK (question_type IN ('single', 'multi'));
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- ===========================================
-- REPLACE submit_quiz_attempt RPC
-- Now handles both single-answer (string) and multi-answer (JSON array)
-- Multi-answer scoring: correct = selected set exactly matches correct set
-- ===========================================

CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_user_id UUID,
  p_lesson_id UUID,
  p_course_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_total_questions INTEGER;
  v_correct_answers INTEGER := 0;
  v_score INTEGER;
  v_passing_score INTEGER;
  v_passed BOOLEAN;
  v_question RECORD;
  v_selected_option_id TEXT;
  v_selected_array JSONB;
  v_correct_set TEXT[];
  v_selected_set TEXT[];
  v_is_correct BOOLEAN;
  v_progress_percent INTEGER;
BEGIN
  -- Verify this is a quiz lesson belonging to the course
  SELECT passing_score INTO v_passing_score
  FROM public.course_lessons
  WHERE id = p_lesson_id
    AND course_id = p_course_id
    AND lesson_type = 'quiz'
    AND is_active = TRUE;

  IF v_passing_score IS NULL THEN
    RAISE EXCEPTION 'Not a valid quiz lesson';
  END IF;

  -- Count total questions
  SELECT COUNT(*) INTO v_total_questions
  FROM public.quiz_questions WHERE lesson_id = p_lesson_id;

  IF v_total_questions = 0 THEN
    RAISE EXCEPTION 'Quiz has no questions';
  END IF;

  -- Score the quiz by checking each question
  FOR v_question IN
    SELECT qq.id AS question_id, qq.question_type
    FROM public.quiz_questions qq
    WHERE qq.lesson_id = p_lesson_id
  LOOP
    IF v_question.question_type = 'multi' THEN
      -- Multi-answer: answer is a JSON array of option IDs
      v_selected_array := p_answers -> v_question.question_id::TEXT;

      -- Build sorted array of correct option IDs for this question
      SELECT ARRAY_AGG(qo.id::TEXT ORDER BY qo.id::TEXT)
      INTO v_correct_set
      FROM public.quiz_options qo
      WHERE qo.question_id = v_question.question_id
        AND qo.is_correct = TRUE;

      -- Build sorted array of selected option IDs
      IF v_selected_array IS NOT NULL AND jsonb_typeof(v_selected_array) = 'array' THEN
        SELECT ARRAY_AGG(elem::TEXT ORDER BY elem::TEXT)
        INTO v_selected_set
        FROM jsonb_array_elements_text(v_selected_array) AS elem;
      ELSE
        v_selected_set := ARRAY[]::TEXT[];
      END IF;

      -- Exact set match
      IF v_correct_set = v_selected_set THEN
        v_correct_answers := v_correct_answers + 1;
      END IF;

    ELSE
      -- Single-answer: existing logic (answer is one option ID string)
      v_selected_option_id := p_answers ->> v_question.question_id::TEXT;

      IF v_selected_option_id IS NOT NULL THEN
        SELECT qo.is_correct INTO v_is_correct
        FROM public.quiz_options qo
        WHERE qo.id = v_selected_option_id::UUID
          AND qo.question_id = v_question.question_id;

        IF v_is_correct IS TRUE THEN
          v_correct_answers := v_correct_answers + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Calculate score percentage
  v_score := ROUND((v_correct_answers::NUMERIC / v_total_questions) * 100);
  v_passed := (v_score >= v_passing_score);

  -- Record the attempt
  INSERT INTO public.quiz_attempts (user_id, lesson_id, score, passed, answers)
  VALUES (p_user_id, p_lesson_id, v_score, v_passed, p_answers);

  -- If passed, auto-complete the lesson via the existing RPC
  IF v_passed THEN
    SELECT public.complete_lesson_and_update_progress(p_user_id, p_lesson_id, p_course_id)
    INTO v_progress_percent;
  ELSE
    -- Return current progress without completing
    SELECT COALESCE(ce.progress_percent, 0) INTO v_progress_percent
    FROM public.course_enrollments ce
    WHERE ce.user_id = p_user_id AND ce.course_id = p_course_id;
  END IF;

  RETURN jsonb_build_object(
    'score', v_score,
    'passed', v_passed,
    'correct_answers', v_correct_answers,
    'total_questions', v_total_questions,
    'progress_percent', COALESCE(v_progress_percent, 0)
  );
END;
$$;
