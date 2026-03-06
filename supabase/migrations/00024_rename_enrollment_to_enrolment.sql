-- Migration 00023: Rename enrollment → enrolment for British English consistency
-- Renames enum type, table, indexes, trigger, RLS policies, and recreates
-- all functions that reference the old names.
-- All operations use IF EXISTS / DO blocks for idempotency.

-- ===========================================
-- 1. RENAME THE ENUM TYPE
-- ===========================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
    ALTER TYPE enrollment_status RENAME TO enrolment_status;
  END IF;
END $$;

-- ===========================================
-- 2. RENAME THE TABLE
-- ===========================================

ALTER TABLE IF EXISTS public.course_enrollments RENAME TO course_enrolments;

-- ===========================================
-- 3. RENAME INDEXES
-- ===========================================

ALTER INDEX IF EXISTS idx_enrollments_user_id RENAME TO idx_enrolments_user_id;
ALTER INDEX IF EXISTS idx_enrollments_course_id RENAME TO idx_enrolments_course_id;
ALTER INDEX IF EXISTS idx_enrollments_status RENAME TO idx_enrolments_status;
ALTER INDEX IF EXISTS idx_enrollments_due_date RENAME TO idx_enrolments_due_date;
ALTER INDEX IF EXISTS idx_enrollments_user_status RENAME TO idx_enrolments_user_status;

-- ===========================================
-- 4. RENAME THE TRIGGER
-- ===========================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_course_enrollments_updated_at'
  ) THEN
    ALTER TRIGGER update_course_enrollments_updated_at ON public.course_enrolments
      RENAME TO update_course_enrolments_updated_at;
  END IF;
END $$;

-- ===========================================
-- 5. RENAME RLS POLICIES (DROP + CREATE)
-- PostgreSQL doesn't support renaming policies directly.
-- ===========================================

-- 5a. "Users can view own enrollments" → "Users can view own enrolments"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own enrollments' AND tablename = 'course_enrolments'
  ) THEN
    DROP POLICY "Users can view own enrollments" ON public.course_enrolments;
    CREATE POLICY "Users can view own enrolments"
      ON public.course_enrolments FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5b. "Users can enroll themselves" → "Users can enrol themselves"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can enroll themselves' AND tablename = 'course_enrolments'
  ) THEN
    DROP POLICY "Users can enroll themselves" ON public.course_enrolments;
    CREATE POLICY "Users can enrol themselves"
      ON public.course_enrolments FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 5c. "Users can update own enrollment progress" → "Users can update own enrolment progress"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own enrollment progress' AND tablename = 'course_enrolments'
  ) THEN
    DROP POLICY "Users can update own enrollment progress" ON public.course_enrolments;
    CREATE POLICY "Users can update own enrolment progress"
      ON public.course_enrolments FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5d. "HR admins can view all enrollments" → "HR admins can view all enrolments"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'HR admins can view all enrollments' AND tablename = 'course_enrolments'
  ) THEN
    DROP POLICY "HR admins can view all enrollments" ON public.course_enrolments;
    CREATE POLICY "HR admins can view all enrolments"
      ON public.course_enrolments FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_hr_admin = true OR profiles.is_ld_admin = true)
        )
      );
  END IF;
END $$;

-- 5e. "Managers can view team enrollments" → "Managers can view team enrolments"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Managers can view team enrollments' AND tablename = 'course_enrolments'
  ) THEN
    DROP POLICY "Managers can view team enrollments" ON public.course_enrolments;
    CREATE POLICY "Managers can view team enrolments"
      ON public.course_enrolments FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_line_manager = true
        )
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = course_enrolments.user_id
          AND profiles.line_manager_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 5f. "LD admins can view all enrollments" → "LD admins can view all enrolments"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'LD admins can view all enrollments' AND tablename = 'course_enrolments'
  ) THEN
    DROP POLICY "LD admins can view all enrollments" ON public.course_enrolments;
    CREATE POLICY "LD admins can view all enrolments"
      ON public.course_enrolments FOR SELECT
      TO authenticated
      USING (public.is_ld_admin());
  END IF;
END $$;

-- 5g. "LD admins can manage enrollments" → "LD admins can manage enrolments"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'LD admins can manage enrollments' AND tablename = 'course_enrolments'
  ) THEN
    DROP POLICY "LD admins can manage enrollments" ON public.course_enrolments;
    CREATE POLICY "LD admins can manage enrolments"
      ON public.course_enrolments FOR ALL
      TO authenticated
      USING (public.is_ld_admin());
  END IF;
END $$;

-- 5h. "LD admins can insert enrollments" → "LD admins can insert enrolments"
-- (May exist from a previous migration attempt)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'LD admins can insert enrollments' AND tablename = 'course_enrolments'
  ) THEN
    DROP POLICY "LD admins can insert enrollments" ON public.course_enrolments;
    CREATE POLICY "LD admins can insert enrolments"
      ON public.course_enrolments FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_ld_admin = true
        )
      );
  END IF;
END $$;

-- ===========================================
-- 6. RECREATE FUNCTIONS WITH NEW TABLE/ENUM NAMES
-- ===========================================

-- 6a. complete_lesson_and_update_progress
-- (Latest version from migration 00013 with enum casts)
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
  FROM public.course_enrolments
  WHERE user_id = p_user_id AND course_id = p_course_id;

  -- Update enrolment progress atomically
  -- Cast text literals to enrolment_status enum type
  UPDATE public.course_enrolments
  SET
    progress_percent = v_progress_percent,
    status = CASE
      WHEN v_is_completed THEN 'completed'::enrolment_status
      WHEN v_progress_percent > 0 THEN 'in_progress'::enrolment_status
      ELSE 'enrolled'::enrolment_status
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

-- 6b. auto_enroll_required_courses
-- (From migration 00004)
CREATE OR REPLACE FUNCTION public.auto_enroll_required_courses()
RETURNS TRIGGER AS $$
DECLARE
  required_course RECORD;
  user_start_date DATE;
BEGIN
  -- Get user's start date
  SELECT start_date INTO user_start_date FROM public.profiles WHERE id = NEW.id;

  -- Loop through all required active courses and enrol user
  FOR required_course IN
    SELECT id, due_days_from_start
    FROM public.courses
    WHERE is_required = TRUE AND is_active = TRUE
  LOOP
    INSERT INTO public.course_enrolments (
      user_id,
      course_id,
      status,
      due_date
    )
    VALUES (
      NEW.id,
      required_course.id,
      'enrolled',
      CASE
        WHEN required_course.due_days_from_start IS NOT NULL AND user_start_date IS NOT NULL
        THEN user_start_date + required_course.due_days_from_start
        ELSE NULL
      END
    )
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6c. auto_enroll_from_assignment
-- (From migration 00009)
CREATE OR REPLACE FUNCTION public.auto_enroll_from_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user RECORD;
  course_due_days INTEGER;
BEGIN
  -- Get the course's due_days_from_start
  SELECT due_days_from_start INTO course_due_days
  FROM public.courses WHERE id = NEW.course_id;

  -- Find matching users based on assign_type
  FOR target_user IN
    SELECT p.id, p.start_date
    FROM public.profiles p
    WHERE p.status != 'inactive'
      AND (
        (NEW.assign_type = 'team' AND p.team_id = NEW.assign_value::UUID)
        OR
        (NEW.assign_type = 'user_type' AND p.user_type = NEW.assign_value)
      )
  LOOP
    INSERT INTO public.course_enrolments (
      user_id, course_id, status, due_date
    ) VALUES (
      target_user.id,
      NEW.course_id,
      'enrolled',
      CASE
        WHEN course_due_days IS NOT NULL AND target_user.start_date IS NOT NULL
        THEN target_user.start_date + course_due_days
        ELSE NULL
      END
    )
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 6d. submit_quiz_attempt
-- (From migration 00017 — references course_enrollments)
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
    FROM public.course_enrolments ce
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
