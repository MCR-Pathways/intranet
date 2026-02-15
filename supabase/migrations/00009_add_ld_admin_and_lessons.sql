-- Migration 00009: Add L&D Admin role, course lessons, lesson completions, and course assignments
-- Supports the Learning & Development admin feature for course management and reporting

-- ===========================================
-- ADD is_ld_admin TO PROFILES
-- ===========================================

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN is_ld_admin BOOLEAN DEFAULT FALSE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- ===========================================
-- HELPER FUNCTION: is_ld_admin()
-- ===========================================

CREATE OR REPLACE FUNCTION public.is_ld_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_ld_admin = TRUE
  );
$$;

-- ===========================================
-- UPDATE PROFILES SELF-UPDATE POLICY
-- Prevent users from self-promoting to L&D admin
-- ===========================================

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    COALESCE(is_hr_admin, FALSE) = (SELECT is_hr_admin FROM public.profiles WHERE id = auth.uid())
    AND COALESCE(is_line_manager, FALSE) = (SELECT is_line_manager FROM public.profiles WHERE id = auth.uid())
    AND COALESCE(is_ld_admin, FALSE) = (SELECT is_ld_admin FROM public.profiles WHERE id = auth.uid())
    AND user_type = (SELECT user_type FROM public.profiles WHERE id = auth.uid())
  )
);

-- ===========================================
-- COURSE LESSONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT, -- Rich text / markdown
  video_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_lessons_course_id ON public.course_lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_sort_order ON public.course_lessons(course_id, sort_order);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_course_lessons_updated_at ON public.course_lessons;
CREATE TRIGGER update_course_lessons_updated_at
  BEFORE UPDATE ON public.course_lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- LESSON COMPLETIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.lesson_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_completions_user_id ON public.lesson_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_lesson_id ON public.lesson_completions(lesson_id);

-- ===========================================
-- COURSE ASSIGNMENTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.course_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  assign_type TEXT NOT NULL CHECK (assign_type IN ('team', 'user_type')),
  assign_value TEXT NOT NULL, -- team UUID or user_type string
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, assign_type, assign_value)
);

CREATE INDEX IF NOT EXISTS idx_course_assignments_course_id ON public.course_assignments(course_id);

-- ===========================================
-- RLS: COURSE LESSONS
-- ===========================================

ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active lessons" ON public.course_lessons;
CREATE POLICY "Anyone can view active lessons"
ON public.course_lessons FOR SELECT
TO authenticated
USING (
  is_active = TRUE AND EXISTS (
    SELECT 1 FROM public.courses WHERE id = course_id AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "LD admins can manage lessons" ON public.course_lessons;
CREATE POLICY "LD admins can manage lessons"
ON public.course_lessons FOR ALL
TO authenticated
USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can manage lessons" ON public.course_lessons;
CREATE POLICY "HR admins can manage lessons"
ON public.course_lessons FOR ALL
TO authenticated
USING (public.is_hr_admin());

-- ===========================================
-- RLS: LESSON COMPLETIONS
-- ===========================================

ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own lesson completions" ON public.lesson_completions;
CREATE POLICY "Users can view own lesson completions"
ON public.lesson_completions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can complete own lessons" ON public.lesson_completions;
CREATE POLICY "Users can complete own lessons"
ON public.lesson_completions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "LD admins can view all lesson completions" ON public.lesson_completions;
CREATE POLICY "LD admins can view all lesson completions"
ON public.lesson_completions FOR SELECT
TO authenticated
USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can view all lesson completions" ON public.lesson_completions;
CREATE POLICY "HR admins can view all lesson completions"
ON public.lesson_completions FOR SELECT
TO authenticated
USING (public.is_hr_admin());

-- ===========================================
-- RLS: COURSE ASSIGNMENTS
-- ===========================================

ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LD admins can manage assignments" ON public.course_assignments;
CREATE POLICY "LD admins can manage assignments"
ON public.course_assignments FOR ALL
TO authenticated
USING (public.is_ld_admin());

DROP POLICY IF EXISTS "HR admins can manage assignments" ON public.course_assignments;
CREATE POLICY "HR admins can manage assignments"
ON public.course_assignments FOR ALL
TO authenticated
USING (public.is_hr_admin());

DROP POLICY IF EXISTS "Authenticated users can view assignments" ON public.course_assignments;
CREATE POLICY "Authenticated users can view assignments"
ON public.course_assignments FOR SELECT
TO authenticated
USING (true);

-- ===========================================
-- ADD L&D ADMIN POLICIES TO EXISTING TABLES
-- ===========================================

-- L&D admins can manage courses
DROP POLICY IF EXISTS "LD admins can manage courses" ON public.courses;
CREATE POLICY "LD admins can manage courses"
ON public.courses FOR ALL
TO authenticated
USING (public.is_ld_admin());

-- L&D admins can view all enrollments
DROP POLICY IF EXISTS "LD admins can view all enrollments" ON public.course_enrollments;
CREATE POLICY "LD admins can view all enrollments"
ON public.course_enrollments FOR SELECT
TO authenticated
USING (public.is_ld_admin());

-- L&D admins can manage enrollments (for assignment-based creation)
DROP POLICY IF EXISTS "LD admins can manage enrollments" ON public.course_enrollments;
CREATE POLICY "LD admins can manage enrollments"
ON public.course_enrollments FOR ALL
TO authenticated
USING (public.is_ld_admin());

-- ===========================================
-- AUTO-ENROLL TRIGGER FOR COURSE ASSIGNMENTS
-- ===========================================

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
    INSERT INTO public.course_enrollments (
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

DROP TRIGGER IF EXISTS on_course_assignment_created ON public.course_assignments;
CREATE TRIGGER on_course_assignment_created
  AFTER INSERT ON public.course_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enroll_from_assignment();
