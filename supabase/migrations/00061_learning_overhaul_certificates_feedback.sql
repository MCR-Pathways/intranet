-- Learning Overhaul: Certificates + Course Feedback
-- Auto-generated certificates on course completion.
-- Private structured feedback for L&D team.

-- ===========================================
-- 1. CERTIFICATES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolment_id UUID NOT NULL REFERENCES public.course_enrolments(id) ON DELETE CASCADE,
  learner_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  score INTEGER,
  completed_at TIMESTAMPTZ NOT NULL,
  certificate_number TEXT NOT NULL,
  pdf_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_certificates_number UNIQUE (certificate_number),
  CONSTRAINT uq_certificates_user_course UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user_id
  ON public.certificates(user_id);

CREATE INDEX IF NOT EXISTS idx_certificates_course_id
  ON public.certificates(course_id);

-- ===========================================
-- 2. CERTIFICATE NUMBER GENERATOR
-- ===========================================

CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
  v_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;

  -- Get next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(certificate_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO v_seq
  FROM public.certificates
  WHERE certificate_number LIKE 'MCR-' || v_year || '-%';

  v_number := 'MCR-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');

  RETURN v_number;
END;
$$;

-- ===========================================
-- 3. COURSE FEEDBACK TABLE (private to L&D)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.course_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  relevance_rating INTEGER NOT NULL CHECK (relevance_rating >= 1 AND relevance_rating <= 5),
  clarity_rating INTEGER NOT NULL CHECK (clarity_rating >= 1 AND clarity_rating <= 5),
  duration_feedback TEXT NOT NULL CHECK (duration_feedback IN ('too_short', 'about_right', 'too_long')),
  improvement_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_feedback_user_course UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_feedback_course_id
  ON public.course_feedback(course_id);

-- ===========================================
-- 4. ADD FEEDBACK AGGREGATES TO COURSES
-- ===========================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS feedback_avg NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS feedback_count INTEGER NOT NULL DEFAULT 0;

-- ===========================================
-- 5. FEEDBACK AGGREGATE TRIGGER
-- ===========================================

CREATE OR REPLACE FUNCTION public.update_course_feedback_aggregate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course_id UUID;
BEGIN
  -- Determine affected course_id
  IF TG_OP = 'DELETE' THEN
    v_course_id := OLD.course_id;
  ELSE
    v_course_id := NEW.course_id;
  END IF;

  -- Recalculate aggregate
  UPDATE public.courses
  SET
    feedback_avg = (
      SELECT ROUND(AVG(overall_rating)::NUMERIC, 2)
      FROM public.course_feedback
      WHERE course_id = v_course_id
    ),
    feedback_count = (
      SELECT COUNT(*)
      FROM public.course_feedback
      WHERE course_id = v_course_id
    )
  WHERE id = v_course_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_course_feedback_change ON public.course_feedback;
CREATE TRIGGER on_course_feedback_change
  AFTER INSERT OR UPDATE OR DELETE ON public.course_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_course_feedback_aggregate();

-- ===========================================
-- 6. CERTIFICATE STORAGE BUCKET
-- ===========================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificates', 'certificates', TRUE, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for certificates bucket
DROP POLICY IF EXISTS "certificates_storage_read" ON storage.objects;
CREATE POLICY "certificates_storage_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'certificates');

DROP POLICY IF EXISTS "certificates_storage_insert_admin" ON storage.objects;
CREATE POLICY "certificates_storage_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'certificates'
    AND public.is_ld_admin_effective()
  );

-- ===========================================
-- 7. RLS POLICIES
-- ===========================================

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_feedback ENABLE ROW LEVEL SECURITY;

-- Certificates: users see own, admins see all
DROP POLICY IF EXISTS "Users can view own certificates" ON public.certificates;
CREATE POLICY "Users can view own certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "LD admins can view all certificates" ON public.certificates;
CREATE POLICY "LD admins can view all certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (public.is_ld_admin_effective());

DROP POLICY IF EXISTS "HR admins can view all certificates" ON public.certificates;
CREATE POLICY "HR admins can view all certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_hr_admin = TRUE
    )
  );

-- System can insert certificates (via SECURITY DEFINER functions)
DROP POLICY IF EXISTS "System can insert certificates" ON public.certificates;
CREATE POLICY "System can insert certificates"
  ON public.certificates FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Course Feedback: users can insert own, admins see feedback (NOT user_id)
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.course_feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.course_feedback FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own feedback" ON public.course_feedback;
CREATE POLICY "Users can view own feedback"
  ON public.course_feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own feedback" ON public.course_feedback;
CREATE POLICY "Users can update own feedback"
  ON public.course_feedback FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- L&D admins see all feedback (application layer hides user_id)
DROP POLICY IF EXISTS "LD admins can view all feedback" ON public.course_feedback;
CREATE POLICY "LD admins can view all feedback"
  ON public.course_feedback FOR SELECT
  TO authenticated
  USING (public.is_ld_admin_effective());

DROP POLICY IF EXISTS "HR admins can view all feedback" ON public.course_feedback;
CREATE POLICY "HR admins can view all feedback"
  ON public.course_feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_hr_admin = TRUE
    )
  );
