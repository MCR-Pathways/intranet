-- Migration 00061: Learning Overhaul — Section Quizzes
-- Creates section_quizzes, section_quiz_questions, section_quiz_options,
-- and section_quiz_attempts tables.
-- Already applied to production — added to repo for completeness.

-- ===========================================
-- SECTION QUIZZES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.section_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Section Quiz',
  passing_score INTEGER NOT NULL DEFAULT 80
    CHECK (passing_score BETWEEN 0 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(section_id)
);

CREATE INDEX IF NOT EXISTS idx_section_quizzes_section_id
  ON public.section_quizzes(section_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_section_quizzes_updated_at ON public.section_quizzes;
CREATE TRIGGER update_section_quizzes_updated_at
  BEFORE UPDATE ON public.section_quizzes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- SECTION QUIZ QUESTIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.section_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.section_quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'single'
    CHECK (question_type IN ('single', 'multi')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_section_quiz_questions_quiz_id
  ON public.section_quiz_questions(quiz_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_section_quiz_questions_updated_at ON public.section_quiz_questions;
CREATE TRIGGER update_section_quiz_questions_updated_at
  BEFORE UPDATE ON public.section_quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- SECTION QUIZ OPTIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.section_quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.section_quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_section_quiz_options_question_id
  ON public.section_quiz_options(question_id);

-- ===========================================
-- SECTION QUIZ ATTEMPTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.section_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.section_quizzes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed BOOLEAN NOT NULL DEFAULT false,
  answers JSONB,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_section_quiz_attempts_user_id
  ON public.section_quiz_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_section_quiz_attempts_quiz_id
  ON public.section_quiz_attempts(quiz_id);

CREATE INDEX IF NOT EXISTS idx_section_quiz_attempts_user_quiz
  ON public.section_quiz_attempts(user_id, quiz_id);
