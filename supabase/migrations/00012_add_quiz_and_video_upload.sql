-- Migration 00012: Add quiz lesson type, video upload support, and quiz assessment tables
-- Supports quiz/test lessons with scoring + blocking progression,
-- direct video file uploads to Supabase Storage, and lesson type differentiation.

-- ===========================================
-- ALTER course_lessons: ADD lesson_type, passing_score, video_storage_path
-- ===========================================

DO $$ BEGIN
  ALTER TABLE public.course_lessons
    ADD COLUMN lesson_type TEXT NOT NULL DEFAULT 'text'
    CHECK (lesson_type IN ('video', 'text', 'quiz'));
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.course_lessons
    ADD COLUMN passing_score INTEGER DEFAULT NULL
    CHECK (passing_score IS NULL OR (passing_score >= 0 AND passing_score <= 100));
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.course_lessons
    ADD COLUMN video_storage_path TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Backfill existing lessons to set lesson_type based on content
UPDATE public.course_lessons
SET lesson_type = 'video'
WHERE lesson_type = 'text'
  AND video_url IS NOT NULL
  AND video_url != '';

-- ===========================================
-- QUIZ QUESTIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson_id
  ON public.quiz_questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_sort_order
  ON public.quiz_questions(lesson_id, sort_order);

DROP TRIGGER IF EXISTS update_quiz_questions_updated_at ON public.quiz_questions;
CREATE TRIGGER update_quiz_questions_updated_at
  BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- QUIZ OPTIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_options_question_id
  ON public.quiz_options(question_id);

-- ===========================================
-- QUIZ ATTEMPTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  answers JSONB,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id
  ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_lesson_id
  ON public.quiz_attempts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson
  ON public.quiz_attempts(user_id, lesson_id);

-- ===========================================
-- RLS: QUIZ QUESTIONS
-- ===========================================

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view quiz questions for active lessons" ON public.quiz_questions;
CREATE POLICY "Anyone can view quiz questions for active lessons"
ON public.quiz_questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_lessons cl
    JOIN public.courses c ON c.id = cl.course_id
    WHERE cl.id = quiz_questions.lesson_id
      AND cl.is_active = TRUE
      AND c.is_active = TRUE
  )
);

DROP POLICY IF EXISTS "LD admins can manage quiz questions" ON public.quiz_questions;
CREATE POLICY "LD admins can manage quiz questions"
ON public.quiz_questions FOR ALL
TO authenticated
USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can manage quiz questions" ON public.quiz_questions;
CREATE POLICY "HR admins can manage quiz questions"
ON public.quiz_questions FOR ALL
TO authenticated
USING (public.is_hr_admin());

-- ===========================================
-- RLS: QUIZ OPTIONS
-- ===========================================

ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view quiz options for active lessons" ON public.quiz_options;
CREATE POLICY "Anyone can view quiz options for active lessons"
ON public.quiz_options FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    JOIN public.course_lessons cl ON cl.id = qq.lesson_id
    JOIN public.courses c ON c.id = cl.course_id
    WHERE qq.id = quiz_options.question_id
      AND cl.is_active = TRUE
      AND c.is_active = TRUE
  )
);

DROP POLICY IF EXISTS "LD admins can manage quiz options" ON public.quiz_options;
CREATE POLICY "LD admins can manage quiz options"
ON public.quiz_options FOR ALL
TO authenticated
USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can manage quiz options" ON public.quiz_options;
CREATE POLICY "HR admins can manage quiz options"
ON public.quiz_options FOR ALL
TO authenticated
USING (public.is_hr_admin());

-- ===========================================
-- RLS: QUIZ ATTEMPTS
-- ===========================================

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can view own quiz attempts"
ON public.quiz_attempts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can insert own quiz attempts"
ON public.quiz_attempts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "LD admins can view all quiz attempts" ON public.quiz_attempts;
CREATE POLICY "LD admins can view all quiz attempts"
ON public.quiz_attempts FOR SELECT
TO authenticated
USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can view all quiz attempts" ON public.quiz_attempts;
CREATE POLICY "HR admins can view all quiz attempts"
ON public.quiz_attempts FOR SELECT
TO authenticated
USING (public.is_hr_admin());

-- ===========================================
-- STORAGE BUCKET: course-videos
-- ===========================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-videos',
  'course-videos',
  TRUE,
  1073741824,
  ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: LD admins can upload
DROP POLICY IF EXISTS "LD admins can upload course videos" ON storage.objects;
CREATE POLICY "LD admins can upload course videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-videos' AND public.is_ld_admin()
);

-- Storage RLS: HR admins can also upload
DROP POLICY IF EXISTS "HR admins can upload course videos" ON storage.objects;
CREATE POLICY "HR admins can upload course videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-videos' AND public.is_hr_admin()
);

-- Storage RLS: LD admins can delete course videos
DROP POLICY IF EXISTS "LD admins can delete course videos" ON storage.objects;
CREATE POLICY "LD admins can delete course videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-videos' AND public.is_ld_admin()
);

-- Storage RLS: HR admins can delete course videos
DROP POLICY IF EXISTS "HR admins can delete course videos" ON storage.objects;
CREATE POLICY "HR admins can delete course videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-videos' AND public.is_hr_admin()
);

-- Storage RLS: Any authenticated user can read course videos
DROP POLICY IF EXISTS "Authenticated users can read course videos" ON storage.objects;
CREATE POLICY "Authenticated users can read course videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'course-videos');

-- ===========================================
-- UPDATED RPC: complete_lesson_and_update_progress
-- Now includes quiz guard: quiz lessons require a passing attempt
-- ===========================================

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
  UPDATE public.course_enrollments
  SET
    progress_percent = v_progress_percent,
    status = CASE
      WHEN v_is_completed THEN 'completed'
      WHEN v_progress_percent > 0 THEN 'in_progress'
      ELSE 'enrolled'
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

-- ===========================================
-- NEW RPC: submit_quiz_attempt
-- Atomic scoring + attempt recording + conditional completion
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
    SELECT qq.id AS question_id
    FROM public.quiz_questions qq
    WHERE qq.lesson_id = p_lesson_id
  LOOP
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
