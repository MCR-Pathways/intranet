-- Learning Reconciliation Migration
-- Bridges our production schema (00060-00064) to support learner UI features:
-- 1. Adds slides + rich_text lesson types with content columns
-- 2. Adds denormalised section_id + course_id to quiz attempts
-- 3. Simplifies certificates table (drop snapshot columns)
-- 4. Simplifies email_notifications (drop queue columns)
-- 5. Rewrites RPCs: separate recalculate_course_progress + auth.uid() enforcement
-- 6. Adds UNIQUE constraint on course_sections sort order

-- ===========================================
-- 1. EXPAND LESSON TYPES
-- ===========================================

-- Drop old constraint and add expanded one
DO $$
DECLARE
  conname TEXT;
BEGIN
  SELECT constraint_name INTO conname
  FROM information_schema.constraint_column_usage
  WHERE table_schema = 'public'
    AND table_name = 'course_lessons'
    AND column_name = 'lesson_type';

  IF conname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.course_lessons DROP CONSTRAINT ' || quote_ident(conname);
  END IF;
END $$;

ALTER TABLE public.course_lessons
ADD CONSTRAINT course_lessons_lesson_type_check
CHECK (lesson_type IN ('text', 'video', 'slides', 'rich_text'));

-- Add content columns for rich lesson types
ALTER TABLE public.course_lessons
ADD COLUMN IF NOT EXISTS content_json JSONB,
ADD COLUMN IF NOT EXISTS slides_url TEXT;

-- ===========================================
-- 2. DENORMALISE QUIZ ATTEMPTS
-- ===========================================

ALTER TABLE public.section_quiz_attempts
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.course_sections(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE;

-- Backfill existing rows from quiz → section → course chain
UPDATE public.section_quiz_attempts sqa
SET
  section_id = sq.section_id,
  course_id = cs.course_id
FROM public.section_quizzes sq
JOIN public.course_sections cs ON cs.id = sq.section_id
WHERE sqa.quiz_id = sq.id
  AND sqa.section_id IS NULL;

-- ===========================================
-- 3. ADD UNIQUE CONSTRAINT ON SECTION SORT ORDER
-- ===========================================

ALTER TABLE public.course_sections
ADD CONSTRAINT uq_course_sections_sort_order
  UNIQUE(course_id, sort_order) DEFERRABLE INITIALLY DEFERRED;

-- ===========================================
-- 4. SIMPLIFY CERTIFICATES TABLE
-- ===========================================
-- Drop snapshot columns — PDF endpoint JOINs for names at generation time.
-- Keep certificate_number, user_id, course_id (the essentials).

-- Drop the existing trigger first (it references snapshot columns)
DROP TRIGGER IF EXISTS on_enrolment_completed ON public.course_enrolments;
DROP FUNCTION IF EXISTS public.generate_certificate_on_completion();

-- Drop the sequential number generator (switching to random)
DROP FUNCTION IF EXISTS public.generate_certificate_number();

-- Drop snapshot columns
ALTER TABLE public.certificates
DROP COLUMN IF EXISTS enrolment_id,
DROP COLUMN IF EXISTS learner_name,
DROP COLUMN IF EXISTS course_title,
DROP COLUMN IF EXISTS score,
DROP COLUMN IF EXISTS completed_at,
DROP COLUMN IF EXISTS pdf_storage_path;

-- Add new columns
ALTER TABLE public.certificates
ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- ===========================================
-- 5. SIMPLIFY EMAIL NOTIFICATIONS
-- ===========================================
-- Drop queue columns — Resend handles retry. Simple log is sufficient.

ALTER TABLE public.email_notifications
DROP COLUMN IF EXISTS body_html,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS error_message;

-- Drop the status-based index (no longer relevant)
DROP INDEX IF EXISTS idx_email_notifications_status_created;

-- Relax email_type CHECK (allow any type string for extensibility)
DO $$
DECLARE
  conname TEXT;
BEGIN
  SELECT constraint_name INTO conname
  FROM information_schema.check_constraints
  WHERE constraint_schema = 'public'
    AND constraint_name LIKE '%email_type%';

  IF conname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.email_notifications DROP CONSTRAINT ' || quote_ident(conname);
  END IF;
END $$;

-- Ensure sent_at defaults to now()
ALTER TABLE public.email_notifications
ALTER COLUMN sent_at SET DEFAULT NOW();

-- ===========================================
-- 6. REWRITE RPCs WITH AUTH ENFORCEMENT
-- ===========================================

-- 6a. NEW: recalculate_course_progress (standalone, replaces combined function)
CREATE OR REPLACE FUNCTION public.recalculate_course_progress(
  p_user_id UUID,
  p_course_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_lessons INTEGER;
  v_completed_lessons INTEGER;
  v_total_quizzes INTEGER;
  v_passed_quizzes INTEGER;
  v_total_items INTEGER;
  v_completed_items INTEGER;
  v_progress INTEGER;
BEGIN
  -- Enforce auth.uid() — prevent impersonation
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s progress';
  END IF;

  -- Count total active lessons
  SELECT COUNT(*) INTO v_total_lessons
  FROM public.course_lessons
  WHERE course_id = p_course_id AND is_active = TRUE;

  -- Count completed lessons
  SELECT COUNT(*) INTO v_completed_lessons
  FROM public.lesson_completions lc
  JOIN public.course_lessons cl ON cl.id = lc.lesson_id
  WHERE cl.course_id = p_course_id
    AND cl.is_active = TRUE
    AND lc.user_id = p_user_id;

  -- Count total active section quizzes
  SELECT COUNT(*) INTO v_total_quizzes
  FROM public.section_quizzes sq
  JOIN public.course_sections cs ON cs.id = sq.section_id
  WHERE cs.course_id = p_course_id
    AND sq.is_active = TRUE
    AND cs.is_active = TRUE;

  -- Count passed section quizzes
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

-- 6b. Rewrite complete_lesson_and_update_progress to use recalculate
-- Keeps the same signature for backward compatibility but delegates to recalculate
CREATE OR REPLACE FUNCTION public.complete_lesson_and_update_progress(
  p_user_id UUID,
  p_lesson_id UUID,
  p_course_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lesson RECORD;
BEGIN
  -- Enforce auth.uid() — prevent impersonation
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s progress';
  END IF;

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

  -- Delegate to recalculate_course_progress
  RETURN public.recalculate_course_progress(p_user_id, p_course_id);
END;
$$;

-- 6c. Rewrite submit_section_quiz_attempt with section_id param + auth enforcement
CREATE OR REPLACE FUNCTION public.submit_section_quiz_attempt(
  p_user_id UUID,
  p_quiz_id UUID,
  p_section_id UUID,
  p_course_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quiz RECORD;
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
  -- Enforce auth.uid() — prevent impersonation
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot modify another user''s progress';
  END IF;

  -- Verify quiz belongs to specified section + course
  SELECT sq.id, sq.passing_score, sq.section_id
  INTO v_quiz
  FROM public.section_quizzes sq
  JOIN public.course_sections cs ON cs.id = sq.section_id
  WHERE sq.id = p_quiz_id
    AND sq.section_id = p_section_id
    AND cs.course_id = p_course_id
    AND sq.is_active = TRUE
    AND cs.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz not found or does not belong to specified section/course';
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
      SELECT sqo.id INTO v_correct_option_id
      FROM public.section_quiz_options sqo
      WHERE sqo.question_id = v_question.id AND sqo.is_correct = TRUE
      LIMIT 1;

      IF v_answer_value IS NOT NULL
        AND v_answer_value #>> '{}' = v_correct_option_id::TEXT THEN
        v_correct_count := v_correct_count + 1;
      END IF;

    ELSIF v_question.question_type = 'multi' THEN
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

  -- Record attempt with denormalised section_id + course_id
  INSERT INTO public.section_quiz_attempts (
    user_id, quiz_id, section_id, course_id, score, passed, answers
  ) VALUES (
    p_user_id, p_quiz_id, p_section_id, p_course_id, v_score, v_passed, p_answers
  );

  -- If passed, recalculate course progress
  v_progress := 0;
  IF v_passed THEN
    v_progress := public.recalculate_course_progress(p_user_id, p_course_id);
  END IF;

  RETURN jsonb_build_object(
    'score', v_score,
    'passed', v_passed,
    'correct_answers', v_correct_count,
    'total_questions', v_total_count,
    'passing_score', v_quiz.passing_score,
    'progress_percent', v_progress
  );
END;
$$;
