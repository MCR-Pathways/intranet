-- Add certificate toggle to courses + extend certificate number to 12 chars.
-- Allows admins to disable certificate issuance per course.

-- ===========================================
-- 1. ADD issue_certificate COLUMN
-- ===========================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS issue_certificate BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.courses.issue_certificate IS
  'When true, a PDF certificate is auto-issued on course completion.';

-- ===========================================
-- 2. UPDATE CERTIFICATE AUTO-ISSUE TRIGGER
-- ===========================================
-- Check issue_certificate flag before issuing.
-- Extend cert number from 8 to 12 random chars (281 trillion possibilities).

CREATE OR REPLACE FUNCTION public.auto_issue_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cert_number TEXT;
  v_issue BOOLEAN;
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status::TEXT = 'completed' AND (OLD.status IS NULL OR OLD.status::TEXT <> 'completed') THEN
    -- Check if the course has certificate issuance enabled
    SELECT issue_certificate INTO v_issue
    FROM public.courses
    WHERE id = NEW.course_id;

    IF NOT COALESCE(v_issue, true) THEN
      RETURN NEW;
    END IF;

    -- Generate random certificate number: MCR-YYYY-XXXXXXXXXXXX (12 hex chars)
    v_cert_number := 'MCR-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || UPPER(SUBSTR(gen_random_uuid()::TEXT, 1, 12));

    -- Insert certificate (skip if already exists via UNIQUE constraint)
    INSERT INTO public.certificates (user_id, course_id, certificate_number, issued_at)
    VALUES (NEW.user_id, NEW.course_id, v_cert_number, NOW())
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
