-- Migration 00066: Auto-issue certificates on course completion
-- Creates a trigger on course_enrolments that inserts a certificate
-- when a learner's status changes to 'completed'.

-- ===========================================
-- FUNCTION: auto_issue_certificate
-- ===========================================

CREATE OR REPLACE FUNCTION public.auto_issue_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cert_number TEXT;
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Generate certificate number: MCR-YYYY-XXXXXXXX
    v_cert_number := 'MCR-' || EXTRACT(YEAR FROM now())::text || '-' || upper(substr(gen_random_uuid()::text, 1, 8));

    -- Insert certificate (ignore if already exists via unique constraint)
    INSERT INTO public.certificates (user_id, course_id, certificate_number, issued_at)
    VALUES (NEW.user_id, NEW.course_id, v_cert_number, now())
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ===========================================
-- TRIGGER: on course_enrolments update
-- ===========================================

DROP TRIGGER IF EXISTS trg_auto_issue_certificate ON public.course_enrolments;
CREATE TRIGGER trg_auto_issue_certificate
  AFTER INSERT OR UPDATE OF status ON public.course_enrolments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_issue_certificate();

-- ===========================================
-- BACKFILL: Issue certificates for already-completed enrolments
-- ===========================================

INSERT INTO public.certificates (user_id, course_id, certificate_number, issued_at)
SELECT
  ce.user_id,
  ce.course_id,
  'MCR-' || EXTRACT(YEAR FROM COALESCE(ce.completed_at, now()))::text || '-' || upper(substr(gen_random_uuid()::text, 1, 8)),
  COALESCE(ce.completed_at, now())
FROM public.course_enrolments ce
WHERE ce.status = 'completed'
ON CONFLICT (user_id, course_id) DO NOTHING;
