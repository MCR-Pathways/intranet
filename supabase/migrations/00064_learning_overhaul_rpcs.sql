-- Migration 00064: Learning Overhaul — RPCs & RLS Policies
-- Creates submit_section_quiz_attempt and recalculate_course_progress functions,
-- and enables RLS with policies on all new learning tables.
-- Already applied to production — added to repo for completeness.

-- ===========================================
-- RPC: recalculate_course_progress
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
-- RPC: submit_section_quiz_attempt
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
  -- Get passing score
  SELECT passing_score INTO v_passing_score
  FROM public.section_quizzes
  WHERE id = p_quiz_id AND section_id = p_section_id;

  IF v_passing_score IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
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

-- ===========================================
-- RLS: COURSE SECTIONS
-- ===========================================

ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view course sections" ON public.course_sections;
CREATE POLICY "Authenticated users can view course sections"
  ON public.course_sections FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "LD admins can manage course sections" ON public.course_sections;
CREATE POLICY "LD admins can manage course sections"
  ON public.course_sections FOR ALL
  TO authenticated
  USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can manage course sections" ON public.course_sections;
CREATE POLICY "HR admins can manage course sections"
  ON public.course_sections FOR ALL
  TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- RLS: SECTION QUIZZES
-- ===========================================

ALTER TABLE public.section_quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view section quizzes" ON public.section_quizzes;
CREATE POLICY "Authenticated users can view section quizzes"
  ON public.section_quizzes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "LD admins can manage section quizzes" ON public.section_quizzes;
CREATE POLICY "LD admins can manage section quizzes"
  ON public.section_quizzes FOR ALL
  TO authenticated
  USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can manage section quizzes" ON public.section_quizzes;
CREATE POLICY "HR admins can manage section quizzes"
  ON public.section_quizzes FOR ALL
  TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- RLS: SECTION QUIZ QUESTIONS
-- ===========================================

ALTER TABLE public.section_quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quiz questions" ON public.section_quiz_questions;
CREATE POLICY "Authenticated users can view quiz questions"
  ON public.section_quiz_questions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "LD admins can manage quiz questions" ON public.section_quiz_questions;
CREATE POLICY "LD admins can manage quiz questions"
  ON public.section_quiz_questions FOR ALL
  TO authenticated
  USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can manage quiz questions" ON public.section_quiz_questions;
CREATE POLICY "HR admins can manage quiz questions"
  ON public.section_quiz_questions FOR ALL
  TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- RLS: SECTION QUIZ OPTIONS
-- ===========================================

ALTER TABLE public.section_quiz_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quiz options" ON public.section_quiz_options;
CREATE POLICY "Authenticated users can view quiz options"
  ON public.section_quiz_options FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "LD admins can manage quiz options" ON public.section_quiz_options;
CREATE POLICY "LD admins can manage quiz options"
  ON public.section_quiz_options FOR ALL
  TO authenticated
  USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can manage quiz options" ON public.section_quiz_options;
CREATE POLICY "HR admins can manage quiz options"
  ON public.section_quiz_options FOR ALL
  TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- RLS: SECTION QUIZ ATTEMPTS
-- ===========================================

ALTER TABLE public.section_quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quiz attempts" ON public.section_quiz_attempts;
CREATE POLICY "Users can view own quiz attempts"
  ON public.section_quiz_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own quiz attempts" ON public.section_quiz_attempts;
CREATE POLICY "Users can insert own quiz attempts"
  ON public.section_quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "LD admins can view all quiz attempts" ON public.section_quiz_attempts;
CREATE POLICY "LD admins can view all quiz attempts"
  ON public.section_quiz_attempts FOR SELECT
  TO authenticated
  USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can view all quiz attempts" ON public.section_quiz_attempts;
CREATE POLICY "HR admins can view all quiz attempts"
  ON public.section_quiz_attempts FOR SELECT
  TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- RLS: CERTIFICATES
-- ===========================================

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own certificates" ON public.certificates;
CREATE POLICY "Users can view own certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "LD admins can manage certificates" ON public.certificates;
CREATE POLICY "LD admins can manage certificates"
  ON public.certificates FOR ALL
  TO authenticated
  USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can manage certificates" ON public.certificates;
CREATE POLICY "HR admins can manage certificates"
  ON public.certificates FOR ALL
  TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- RLS: COURSE FEEDBACK
-- ===========================================

ALTER TABLE public.course_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own feedback" ON public.course_feedback;
CREATE POLICY "Users can view own feedback"
  ON public.course_feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.course_feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.course_feedback FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "LD admins can view all feedback" ON public.course_feedback;
CREATE POLICY "LD admins can view all feedback"
  ON public.course_feedback FOR SELECT
  TO authenticated
  USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can view all feedback" ON public.course_feedback;
CREATE POLICY "HR admins can view all feedback"
  ON public.course_feedback FOR SELECT
  TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- RLS: TOOL SHED ENTRIES
-- ===========================================

ALTER TABLE public.tool_shed_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tool shed entries" ON public.tool_shed_entries;
CREATE POLICY "Users can view own tool shed entries"
  ON public.tool_shed_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own tool shed entries" ON public.tool_shed_entries;
CREATE POLICY "Users can insert own tool shed entries"
  ON public.tool_shed_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own tool shed entries" ON public.tool_shed_entries;
CREATE POLICY "Users can update own tool shed entries"
  ON public.tool_shed_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "LD admins can view all tool shed entries" ON public.tool_shed_entries;
CREATE POLICY "LD admins can view all tool shed entries"
  ON public.tool_shed_entries FOR SELECT
  TO authenticated
  USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can view all tool shed entries" ON public.tool_shed_entries;
CREATE POLICY "HR admins can view all tool shed entries"
  ON public.tool_shed_entries FOR SELECT
  TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- RLS: EMAIL NOTIFICATIONS
-- ===========================================

ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email notifications" ON public.email_notifications;
CREATE POLICY "Users can view own email notifications"
  ON public.email_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "LD admins can manage email notifications" ON public.email_notifications;
CREATE POLICY "LD admins can manage email notifications"
  ON public.email_notifications FOR ALL
  TO authenticated
  USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can manage email notifications" ON public.email_notifications;
CREATE POLICY "HR admins can manage email notifications"
  ON public.email_notifications FOR ALL
  TO authenticated
  USING (public.is_hr_admin());
