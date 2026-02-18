-- Migration 00020: Add external course tracking
-- Users can log courses completed outside the platform.
-- Separate from internal course stats.

-- ===========================================
-- CREATE external_courses TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.external_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  provider TEXT,
  category TEXT CHECK (category IN ('compliance', 'upskilling', 'soft_skills')),
  completed_at DATE NOT NULL,
  duration_minutes INTEGER,
  certificate_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_courses_user_id
  ON public.external_courses(user_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_external_courses_updated_at ON public.external_courses;
CREATE TRIGGER update_external_courses_updated_at
  BEFORE UPDATE ON public.external_courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- RLS: external_courses
-- ===========================================

ALTER TABLE public.external_courses ENABLE ROW LEVEL SECURITY;

-- Users can view their own external courses
DROP POLICY IF EXISTS "Users can view own external courses" ON public.external_courses;
CREATE POLICY "Users can view own external courses"
ON public.external_courses FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own external courses
DROP POLICY IF EXISTS "Users can insert own external courses" ON public.external_courses;
CREATE POLICY "Users can insert own external courses"
ON public.external_courses FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own external courses
DROP POLICY IF EXISTS "Users can update own external courses" ON public.external_courses;
CREATE POLICY "Users can update own external courses"
ON public.external_courses FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own external courses
DROP POLICY IF EXISTS "Users can delete own external courses" ON public.external_courses;
CREATE POLICY "Users can delete own external courses"
ON public.external_courses FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- LD admins can view all external courses
DROP POLICY IF EXISTS "LD admins can view all external courses" ON public.external_courses;
CREATE POLICY "LD admins can view all external courses"
ON public.external_courses FOR SELECT
TO authenticated
USING (public.is_ld_admin());

-- HR admins can view all external courses
DROP POLICY IF EXISTS "HR admins can view all external courses" ON public.external_courses;
CREATE POLICY "HR admins can view all external courses"
ON public.external_courses FOR SELECT
TO authenticated
USING (public.is_hr_admin());
