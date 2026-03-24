-- Add 'user' assign_type for individual user course assignment.
-- Also fix a bug from migration 00063 where the auto_enroll_from_assignment()
-- trigger was recreated WITHOUT the 'is_external' branch (added in 00053).
--
-- Current CHECK constraint (from 00053): ('team', 'user_type', 'is_external')
-- New CHECK constraint: ('team', 'user_type', 'is_external', 'user')

-- ===========================================
-- 1. UPDATE CHECK CONSTRAINT
-- ===========================================

ALTER TABLE public.course_assignments
  DROP CONSTRAINT IF EXISTS course_assignments_assign_type_check;

ALTER TABLE public.course_assignments
  ADD CONSTRAINT course_assignments_assign_type_check
  CHECK (assign_type IN ('team', 'user_type', 'is_external', 'user'));

-- ===========================================
-- 2. FIX auto_enroll_from_assignment() TRIGGER
--    Restore 'is_external' branch (lost in 00063) + add 'user' branch.
-- ===========================================

CREATE OR REPLACE FUNCTION public.auto_enroll_from_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_due_days INTEGER;
  v_user_record RECORD;
BEGIN
  -- Get course due_days_from_start
  SELECT due_days_from_start INTO v_due_days
  FROM public.courses WHERE id = NEW.course_id;

  -- Find matching users based on assign_type
  FOR v_user_record IN
    SELECT p.id AS user_id, p.start_date
    FROM public.profiles p
    WHERE p.status != 'inactive'
    AND (
      (NEW.assign_type = 'team' AND p.team_id = NEW.assign_value::UUID)
      OR (NEW.assign_type = 'user_type' AND p.user_type = NEW.assign_value)
      OR (NEW.assign_type = 'is_external' AND p.is_external = (NEW.assign_value = 'true'))
      OR (NEW.assign_type = 'user' AND p.id = NEW.assign_value::UUID)
    )
  LOOP
    INSERT INTO public.course_enrolments (user_id, course_id, status, progress_percent, due_date)
    VALUES (
      v_user_record.user_id,
      NEW.course_id,
      'enrolled'::public.enrolment_status,
      0,
      CASE
        WHEN v_due_days IS NOT NULL AND v_user_record.start_date IS NOT NULL
        THEN v_user_record.start_date + v_due_days
        ELSE NULL
      END
    )
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recreate trigger to use the updated function
DROP TRIGGER IF EXISTS on_course_assignment_created ON public.course_assignments;
CREATE TRIGGER on_course_assignment_created
  AFTER INSERT ON public.course_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enroll_from_assignment();
