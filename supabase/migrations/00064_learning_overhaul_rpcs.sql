-- Learning Overhaul: Updated RPCs for Section-Aware Progress
-- Rewrites complete_lesson_and_update_progress for sections.
-- Adds submit_section_quiz_attempt RPC.
-- Adds generate_certificate_on_completion trigger.

-- ===========================================
-- 1. REWRITE: complete_lesson_and_update_progress
-- ===========================================
-- Now section-aware: progress = (completed lessons + passed section quizzes)
--                              / (total active lessons + total active section quizzes)

CREATE OR REPLACE FUNCTION public.complete_lesson_and_update_progress(
  p_user_id UUID,
  p_lesson_id UUID,
  p_course_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_lesson RECORD;
  v_total_items INTEGER;
  v_completed_items INTEGER;
  v_progress INTEGER;
  v_total_lessons INTEGER;
  v_completed_lessons INTEGER;
  v_total_quizzes INTEGER;
  v_passed_quizzes INTEGER;
BEGIN
  -- Verify lesson exists, is active, and belongs to course
  SELECT cl.id, cl.lesson_type, cl.course_id
  INTO v_lesson
  FROM public.course_lessons cl
  WHERE cl.id = p_lesson_id
    AND cl.course_id = p_course_id
    AND cl.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found, inactive, or does not belong to course';
  END IF;

  -- Insert lesson completion (idempotent)
  INSERT INTO public.lesson_completions (user_id, lesson_id)
  VALUES (p_user_id, p_lesson_id)
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  -- Count total active lessons for course
  SELECT COUNT(*) INTO v_total_lessons
  FROM public.course_lessons
  WHERE course_id = p_course_id AND is_active = TRUE;

  -- Count completed lessons for user
  SELECT COUNT(*) INTO v_completed_lessons
  FROM public.lesson_completions lc
  JOIN public.course_lessons cl ON cl.id = lc.lesson_id
  WHERE cl.course_id = p_course_id
    AND cl.is_active = TRUE
    AND lc.user_id = p_user_id;

  -- Count total active section quizzes for course
  SELECT COUNT(*) INTO v_total_quizzes
  FROM public.section_quizzes sq
  JOIN public.course_sections cs ON cs.id = sq.section_id
  WHERE cs.course_id = p_course_id
    AND sq.is_active = TRUE
    AND cs.is_active = TRUE;

  -- Count passed section quizzes for user
  SELECT COUNT(DISTINCT sq.id) INTO v_passed_quizzes
  FROM public.section_quizzes sq
  JOIN public.course_sections cs ON cs.id = sq.section_id
  JOIN public.section_quiz_attempts sqa ON sqa.quiz_id = sq.id
  WHERE cs.course_id = p_course_id
    AND sq.is_active = TRUE
    AND cs.is_active = TRUE
    AND sqa.user_id = p_user_id
    AND sqa.passed = TRUE;

  -- Calculate progress
  v_total_items := v_total_lessons + v_total_quizzes;
  v_completed_items := v_completed_lessons + v_passed_quizzes;

  IF v_total_items = 0 THEN
    v_progress := 0;
  ELSE
    v_progress := ROUND((v_completed_items::NUMERIC / v_total_items) * 100);
  END IF;

  -- Update enrolment
  UPDATE public.course_enrolments
  SET
    progress_percent = v_progress,
    status = CASE
      WHEN v_progress >= 100 THEN 'completed'::public.enrolment_status
      WHEN v_progress > 0 THEN 'in_progress'::public.enrolment_status
      ELSE status
    END,
    started_at = CASE
      WHEN started_at IS NULL THEN NOW()
      ELSE started_at
    END,
    completed_at = CASE
      WHEN v_progress >= 100 AND completed_at IS NULL THEN NOW()
      ELSE completed_at
    END
  WHERE user_id = p_user_id AND course_id = p_course_id;

  RETURN v_progress;
END;
$$;

-- ===========================================
-- 2. NEW: submit_section_quiz_attempt
-- ===========================================

CREATE OR REPLACE FUNCTION public.submit_section_quiz_attempt(
  p_user_id UUID,
  p_quiz_id UUID,
  p_course_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_quiz RECORD;
  v_section RECORD;
  v_question RECORD;
  v_correct_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_score INTEGER;
  v_passed BOOLEAN;
  v_answer_value JSONB;
  v_correct_option_id UUID;
  v_selected_ids UUID[];
  v_correct_ids UUID[];
  v_progress INTEGER;
BEGIN
  -- Verify quiz exists and belongs to course
  SELECT sq.id, sq.passing_score, sq.section_id
  INTO v_quiz
  FROM public.section_quizzes sq
  JOIN public.course_sections cs ON cs.id = sq.section_id
  WHERE sq.id = p_quiz_id
    AND cs.course_id = p_course_id
    AND sq.is_active = TRUE
    AND cs.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz not found or does not belong to course';
  END IF;

  -- Score each question
  FOR v_question IN
    SELECT sqq.id, sqq.question_type
    FROM public.section_quiz_questions sqq
    WHERE sqq.quiz_id = p_quiz_id
    ORDER BY sqq.sort_order
  LOOP
    v_total_count := v_total_count + 1;
    v_answer_value := p_answers -> v_question.id::TEXT;

    IF v_question.question_type = 'single' THEN
      -- Single choice: check if selected option is correct
      SELECT sqo.id INTO v_correct_option_id
      FROM public.section_quiz_options sqo
      WHERE sqo.question_id = v_question.id AND sqo.is_correct = TRUE
      LIMIT 1;

      IF v_answer_value IS NOT NULL
        AND v_answer_value #>> '{}' = v_correct_option_id::TEXT THEN
        v_correct_count := v_correct_count + 1;
      END IF;

    ELSIF v_question.question_type = 'multi' THEN
      -- Multi choice: check if selected set matches correct set exactly
      SELECT ARRAY_AGG(sqo.id ORDER BY sqo.id) INTO v_correct_ids
      FROM public.section_quiz_options sqo
      WHERE sqo.question_id = v_question.id AND sqo.is_correct = TRUE;

      IF v_answer_value IS NOT NULL AND jsonb_typeof(v_answer_value) = 'array' THEN
        SELECT ARRAY_AGG(elem::UUID ORDER BY elem::UUID)
        INTO v_selected_ids
        FROM jsonb_array_elements_text(v_answer_value) AS elem;

        IF v_selected_ids = v_correct_ids THEN
          v_correct_count := v_correct_count + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Calculate score
  IF v_total_count = 0 THEN
    v_score := 0;
  ELSE
    v_score := ROUND((v_correct_count::NUMERIC / v_total_count) * 100);
  END IF;

  v_passed := v_score >= v_quiz.passing_score;

  -- Record attempt
  INSERT INTO public.section_quiz_attempts (user_id, quiz_id, score, passed, answers)
  VALUES (p_user_id, p_quiz_id, v_score, v_passed, p_answers);

  -- If passed, update course progress
  v_progress := 0;
  IF v_passed THEN
    -- Recalculate progress (same logic as complete_lesson_and_update_progress)
    DECLARE
      v_total_lessons INTEGER;
      v_completed_lessons INTEGER;
      v_total_quizzes INTEGER;
      v_passed_quizzes INTEGER;
      v_total_items INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_total_lessons
      FROM public.course_lessons WHERE course_id = p_course_id AND is_active = TRUE;

      SELECT COUNT(*) INTO v_completed_lessons
      FROM public.lesson_completions lc
      JOIN public.course_lessons cl ON cl.id = lc.lesson_id
      WHERE cl.course_id = p_course_id AND cl.is_active = TRUE AND lc.user_id = p_user_id;

      SELECT COUNT(*) INTO v_total_quizzes
      FROM public.section_quizzes sq
      JOIN public.course_sections cs ON cs.id = sq.section_id
      WHERE cs.course_id = p_course_id AND sq.is_active = TRUE AND cs.is_active = TRUE;

      SELECT COUNT(DISTINCT sq.id) INTO v_passed_quizzes
      FROM public.section_quizzes sq
      JOIN public.course_sections cs ON cs.id = sq.section_id
      JOIN public.section_quiz_attempts sqa ON sqa.quiz_id = sq.id
      WHERE cs.course_id = p_course_id AND sq.is_active = TRUE AND cs.is_active = TRUE
        AND sqa.user_id = p_user_id AND sqa.passed = TRUE;

      v_total_items := v_total_lessons + v_total_quizzes;
      IF v_total_items > 0 THEN
        v_progress := ROUND(((v_completed_lessons + v_passed_quizzes)::NUMERIC / v_total_items) * 100);
      END IF;

      UPDATE public.course_enrolments
      SET
        progress_percent = v_progress,
        status = CASE
          WHEN v_progress >= 100 THEN 'completed'::public.enrolment_status
          WHEN v_progress > 0 THEN 'in_progress'::public.enrolment_status
          ELSE status
        END,
        started_at = CASE WHEN started_at IS NULL THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN v_progress >= 100 AND completed_at IS NULL THEN NOW() ELSE completed_at END
      WHERE user_id = p_user_id AND course_id = p_course_id;
    END;
  END IF;

  RETURN jsonb_build_object(
    'score', v_score,
    'passed', v_passed,
    'correct_answers', v_correct_count,
    'total_questions', v_total_count,
    'progress_percent', v_progress
  );
END;
$$;

-- ===========================================
-- 3. CERTIFICATE ON COMPLETION TRIGGER
-- ===========================================

CREATE OR REPLACE FUNCTION public.generate_certificate_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cert_number TEXT;
  v_learner_name TEXT;
  v_course_title TEXT;
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status::TEXT = 'completed' AND (OLD.status IS NULL OR OLD.status::TEXT != 'completed') THEN
    -- Check if certificate already exists
    IF EXISTS (
      SELECT 1 FROM public.certificates
      WHERE user_id = NEW.user_id AND course_id = NEW.course_id
    ) THEN
      RETURN NEW;
    END IF;

    -- Get learner name
    SELECT full_name INTO v_learner_name
    FROM public.profiles WHERE id = NEW.user_id;

    -- Get course title
    SELECT title INTO v_course_title
    FROM public.courses WHERE id = NEW.course_id;

    -- Generate certificate number
    v_cert_number := public.generate_certificate_number();

    -- Insert certificate
    INSERT INTO public.certificates (
      user_id, course_id, enrolment_id, learner_name, course_title,
      score, completed_at, certificate_number
    ) VALUES (
      NEW.user_id, NEW.course_id, NEW.id, v_learner_name, v_course_title,
      NEW.score, COALESCE(NEW.completed_at, NOW()), v_cert_number
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_enrolment_completed ON public.course_enrolments;
CREATE TRIGGER on_enrolment_completed
  AFTER UPDATE ON public.course_enrolments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_certificate_on_completion();
