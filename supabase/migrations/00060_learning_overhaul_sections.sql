-- Learning Overhaul: Course Sections + Section Quizzes
-- Replaces the flat course→lesson structure with course→section→lesson.
-- Quizzes move from being a lesson type to a section-level gate.
-- No real users exist, so we clean up old quiz data entirely.

-- ===========================================
-- 1. CLEAN UP OLD LEARNING DATA (no real users)
-- ===========================================

-- Delete all seed data from learning tables (reverse FK order)
DELETE FROM public.quiz_attempts;
DELETE FROM public.quiz_options;
DELETE FROM public.quiz_questions;
DELETE FROM public.lesson_completions;
DELETE FROM public.lesson_images;
DELETE FROM public.course_enrolments;
DELETE FROM public.course_assignments;
DELETE FROM public.course_lessons;
DELETE FROM public.courses;
DELETE FROM public.external_courses;

-- ===========================================
-- 2. COURSE SECTIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.course_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_sections_course_id
  ON public.course_sections(course_id);

CREATE INDEX IF NOT EXISTS idx_course_sections_sort_order
  ON public.course_sections(course_id, sort_order);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_course_sections_updated_at
  BEFORE UPDATE ON public.course_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 3. ADD section_id TO course_lessons
-- ===========================================

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_course_lessons_section_id
  ON public.course_lessons(section_id);

-- ===========================================
-- 4. UPDATE lesson_type CHECK (remove 'quiz')
-- ===========================================
-- Quizzes are now at section level, not lesson level.
-- Lessons are only 'video' or 'text'.

ALTER TABLE public.course_lessons
  DROP CONSTRAINT IF EXISTS course_lessons_lesson_type_check;

ALTER TABLE public.course_lessons
  ADD CONSTRAINT course_lessons_lesson_type_check
  CHECK (lesson_type IN ('video', 'text'));

-- Set any existing 'quiz' lessons to 'text' (safety net, table should be empty)
UPDATE public.course_lessons SET lesson_type = 'text' WHERE lesson_type = 'quiz';

-- ===========================================
-- 5. SECTION QUIZZES TABLE (replaces quiz-as-lesson)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.section_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Section Quiz',
  passing_score INTEGER NOT NULL DEFAULT 80
    CHECK (passing_score >= 1 AND passing_score <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_section_quizzes_section_id UNIQUE (section_id)
);

CREATE OR REPLACE TRIGGER update_section_quizzes_updated_at
  BEFORE UPDATE ON public.section_quizzes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 6. SECTION QUIZ QUESTIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.section_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.section_quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'single'
    CHECK (question_type IN ('single', 'multi')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_section_quiz_questions_quiz_id
  ON public.section_quiz_questions(quiz_id);

CREATE INDEX IF NOT EXISTS idx_section_quiz_questions_sort_order
  ON public.section_quiz_questions(quiz_id, sort_order);

CREATE OR REPLACE TRIGGER update_section_quiz_questions_updated_at
  BEFORE UPDATE ON public.section_quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 7. SECTION QUIZ OPTIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.section_quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.section_quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_section_quiz_options_question_id
  ON public.section_quiz_options(question_id);

-- ===========================================
-- 8. SECTION QUIZ ATTEMPTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.section_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.section_quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  answers JSONB,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_section_quiz_attempts_user_id
  ON public.section_quiz_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_section_quiz_attempts_quiz_id
  ON public.section_quiz_attempts(quiz_id);

CREATE INDEX IF NOT EXISTS idx_section_quiz_attempts_user_quiz
  ON public.section_quiz_attempts(user_id, quiz_id);

-- ===========================================
-- 9. RLS POLICIES FOR NEW TABLES
-- ===========================================

ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Course Sections: anyone can view active sections in active courses
DROP POLICY IF EXISTS "Anyone can view active sections" ON public.course_sections;
CREATE POLICY "Anyone can view active sections"
  ON public.course_sections FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "LD admins can manage sections" ON public.course_sections;
CREATE POLICY "LD admins can manage sections"
  ON public.course_sections FOR ALL
  TO authenticated
  USING (public.is_ld_admin_effective());

DROP POLICY IF EXISTS "HR admins can manage sections" ON public.course_sections;
CREATE POLICY "HR admins can manage sections"
  ON public.course_sections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_hr_admin = TRUE
    )
  );

-- Section Quizzes: enrolled users can view, admins can manage
DROP POLICY IF EXISTS "Enrolled users can view section quizzes" ON public.section_quizzes;
CREATE POLICY "Enrolled users can view section quizzes"
  ON public.section_quizzes FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.course_sections cs
      JOIN public.courses c ON c.id = cs.course_id
      WHERE cs.id = section_id AND c.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "LD admins can manage section quizzes" ON public.section_quizzes;
CREATE POLICY "LD admins can manage section quizzes"
  ON public.section_quizzes FOR ALL
  TO authenticated
  USING (public.is_ld_admin_effective());

DROP POLICY IF EXISTS "HR admins can manage section quizzes" ON public.section_quizzes;
CREATE POLICY "HR admins can manage section quizzes"
  ON public.section_quizzes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_hr_admin = TRUE
    )
  );

-- Section Quiz Questions: same pattern as section quizzes
DROP POLICY IF EXISTS "Anyone can view section quiz questions" ON public.section_quiz_questions;
CREATE POLICY "Anyone can view section quiz questions"
  ON public.section_quiz_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_quizzes sq
      JOIN public.course_sections cs ON cs.id = sq.section_id
      JOIN public.courses c ON c.id = cs.course_id
      WHERE sq.id = quiz_id AND c.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "LD admins can manage section quiz questions" ON public.section_quiz_questions;
CREATE POLICY "LD admins can manage section quiz questions"
  ON public.section_quiz_questions FOR ALL
  TO authenticated
  USING (public.is_ld_admin_effective());

DROP POLICY IF EXISTS "HR admins can manage section quiz questions" ON public.section_quiz_questions;
CREATE POLICY "HR admins can manage section quiz questions"
  ON public.section_quiz_questions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_hr_admin = TRUE
    )
  );

-- Section Quiz Options: same pattern
DROP POLICY IF EXISTS "Anyone can view section quiz options" ON public.section_quiz_options;
CREATE POLICY "Anyone can view section quiz options"
  ON public.section_quiz_options FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_quiz_questions sqq
      JOIN public.section_quizzes sq ON sq.id = sqq.quiz_id
      JOIN public.course_sections cs ON cs.id = sq.section_id
      JOIN public.courses c ON c.id = cs.course_id
      WHERE sqq.id = question_id AND c.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "LD admins can manage section quiz options" ON public.section_quiz_options;
CREATE POLICY "LD admins can manage section quiz options"
  ON public.section_quiz_options FOR ALL
  TO authenticated
  USING (public.is_ld_admin_effective());

DROP POLICY IF EXISTS "HR admins can manage section quiz options" ON public.section_quiz_options;
CREATE POLICY "HR admins can manage section quiz options"
  ON public.section_quiz_options FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_hr_admin = TRUE
    )
  );

-- Section Quiz Attempts: users own data, admins see all
DROP POLICY IF EXISTS "Users can view own section quiz attempts" ON public.section_quiz_attempts;
CREATE POLICY "Users can view own section quiz attempts"
  ON public.section_quiz_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own section quiz attempts" ON public.section_quiz_attempts;
CREATE POLICY "Users can insert own section quiz attempts"
  ON public.section_quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "LD admins can view all section quiz attempts" ON public.section_quiz_attempts;
CREATE POLICY "LD admins can view all section quiz attempts"
  ON public.section_quiz_attempts FOR SELECT
  TO authenticated
  USING (public.is_ld_admin_effective());

DROP POLICY IF EXISTS "HR admins can view all section quiz attempts" ON public.section_quiz_attempts;
CREATE POLICY "HR admins can view all section quiz attempts"
  ON public.section_quiz_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_hr_admin = TRUE
    )
  );
