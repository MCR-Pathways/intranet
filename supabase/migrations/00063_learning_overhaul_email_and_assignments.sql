-- Learning Overhaul: Email Notifications Queue + Individual User Assignment

-- ===========================================
-- 1. EMAIL NOTIFICATIONS QUEUE TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN (
    'course_assigned',
    'course_overdue_7d',
    'course_overdue_1d',
    'certificate_earned'
  )),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_status_created
  ON public.email_notifications(status, created_at);

CREATE INDEX IF NOT EXISTS idx_email_notifications_user_id
  ON public.email_notifications(user_id);

-- RLS: only admins + system access
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LD admins can view email notifications" ON public.email_notifications;
CREATE POLICY "LD admins can view email notifications"
  ON public.email_notifications FOR SELECT
  TO authenticated
  USING (public.is_ld_admin_effective());

DROP POLICY IF EXISTS "HR admins can view email notifications" ON public.email_notifications;
CREATE POLICY "HR admins can view email notifications"
  ON public.email_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_hr_admin = TRUE
    )
  );

-- System inserts via SECURITY DEFINER functions
DROP POLICY IF EXISTS "System can insert email notifications" ON public.email_notifications;
CREATE POLICY "System can insert email notifications"
  ON public.email_notifications FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- System can update status (sent/failed)
DROP POLICY IF EXISTS "System can update email notifications" ON public.email_notifications;
CREATE POLICY "System can update email notifications"
  ON public.email_notifications FOR UPDATE
  TO authenticated
  USING (TRUE);

-- ===========================================
-- 2. UPDATE COURSE ASSIGNMENTS — ADD 'user' TYPE
-- ===========================================

-- Current CHECK only allows 'team' and 'user_type'.
-- Add 'user' for individual user assignment.

ALTER TABLE public.course_assignments
  DROP CONSTRAINT IF EXISTS course_assignments_assign_type_check;

ALTER TABLE public.course_assignments
  ADD CONSTRAINT course_assignments_assign_type_check
  CHECK (assign_type IN ('team', 'user_type', 'user'));

-- ===========================================
-- 3. UPDATE AUTO-ENROL TRIGGER FOR 'user' TYPE
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

-- Recreate trigger (DROP + CREATE ensures it uses new function)
DROP TRIGGER IF EXISTS on_course_assignment_created ON public.course_assignments;
CREATE TRIGGER on_course_assignment_created
  AFTER INSERT ON public.course_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enroll_from_assignment();
