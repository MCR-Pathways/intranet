-- Migration 00060: Learning Overhaul — Course Sections
-- Creates course_sections table and adds section_id to course_lessons.
-- Already applied to production — added to repo for completeness.

-- ===========================================
-- COURSE SECTIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.course_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, sort_order) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_course_sections_course_id
  ON public.course_sections(course_id);

CREATE INDEX IF NOT EXISTS idx_course_sections_sort_order
  ON public.course_sections(course_id, sort_order);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_course_sections_updated_at ON public.course_sections;
CREATE TRIGGER update_course_sections_updated_at
  BEFORE UPDATE ON public.course_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- ADD section_id TO course_lessons
-- ===========================================

DO $$ BEGIN
  ALTER TABLE public.course_lessons
    ADD COLUMN section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_course_lessons_section_id
  ON public.course_lessons(section_id);
