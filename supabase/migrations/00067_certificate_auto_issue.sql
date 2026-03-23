-- Auto-issue certificates when a course is completed.
-- Trigger on course_enrolments status → 'completed'.
-- Uses random cert number (MCR-YYYY-XXXXXXXX) — unguessable, collision-resistant.
-- Replaces the snapshot-based trigger from 00064 (dropped in 00065).

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
  IF NEW.status::TEXT = 'completed' AND (OLD.status IS NULL OR OLD.status::TEXT <> 'completed') THEN
    -- Generate random certificate number: MCR-YYYY-XXXXXXXX
    v_cert_number := 'MCR-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || UPPER(SUBSTR(gen_random_uuid()::TEXT, 1, 8));

    -- Insert certificate (skip if already exists via UNIQUE constraint)
    INSERT INTO public.certificates (user_id, course_id, certificate_number, issued_at)
    VALUES (NEW.user_id, NEW.course_id, v_cert_number, NOW())
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ===========================================
-- TRIGGER: on course_enrolments insert or update
-- ===========================================

DROP TRIGGER IF EXISTS trg_auto_issue_certificate ON public.course_enrolments;
CREATE TRIGGER trg_auto_issue_certificate
  AFTER INSERT OR UPDATE OF status ON public.course_enrolments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_issue_certificate();

-- ===========================================
-- BACKFILL: issue certificates for already-completed enrolments
-- ===========================================

INSERT INTO public.certificates (user_id, course_id, certificate_number, issued_at)
SELECT
  ce.user_id,
  ce.course_id,
  'MCR-' || EXTRACT(YEAR FROM COALESCE(ce.completed_at, NOW()))::TEXT || '-' || UPPER(SUBSTR(gen_random_uuid()::TEXT, 1, 8)),
  COALESCE(ce.completed_at, NOW())
FROM public.course_enrolments ce
WHERE ce.status = 'completed'
ON CONFLICT (user_id, course_id) DO NOTHING;
