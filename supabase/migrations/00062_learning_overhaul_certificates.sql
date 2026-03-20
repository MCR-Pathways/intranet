-- Migration 00062: Learning Overhaul — Certificates & Feedback
-- Creates certificates and course_feedback tables, adds feedback columns to courses.
-- Already applied to production — added to repo for completeness.

-- ===========================================
-- CERTIFICATES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user_id
  ON public.certificates(user_id);

CREATE INDEX IF NOT EXISTS idx_certificates_course_id
  ON public.certificates(course_id);

CREATE INDEX IF NOT EXISTS idx_certificates_certificate_number
  ON public.certificates(certificate_number);

-- ===========================================
-- COURSE FEEDBACK TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.course_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_feedback_user_id
  ON public.course_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_course_feedback_course_id
  ON public.course_feedback(course_id);

-- ===========================================
-- ADD FEEDBACK COLUMNS TO COURSES
-- ===========================================

DO $$ BEGIN
  ALTER TABLE public.courses
    ADD COLUMN feedback_avg NUMERIC(3,2);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.courses
    ADD COLUMN feedback_count INTEGER DEFAULT 0;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
