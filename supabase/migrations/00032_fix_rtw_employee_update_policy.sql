-- Fix: Employees could not confirm RTW forms because no UPDATE policy existed.
-- The confirmRTWForm action updates status, employee_confirmed, employee_confirmed_at, employee_comments.
-- Scoped to: own forms only, and only when form is in "submitted" status.

DROP POLICY IF EXISTS "Employees can confirm own RTW forms" ON public.return_to_work_forms;
CREATE POLICY "Employees can confirm own RTW forms"
  ON public.return_to_work_forms FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() AND status = 'submitted')
  WITH CHECK (employee_id = auth.uid());

-- Security: Restrict which columns employees can modify during confirmation.
-- Without this, the UPDATE policy above would allow employees to modify
-- manager-only fields (e.g. wellbeing_discussion, medical_advice_details)
-- directly via the Supabase API, bypassing server action validation.
--
-- Uses JSONB allow-list approach: strips the 4 permitted employee fields from
-- both OLD and NEW records, then compares. If anything else changed, reject.
-- This protects new columns automatically — no trigger update needed when
-- the table schema changes.
CREATE OR REPLACE FUNCTION public.restrict_rtw_employee_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allowed_fields CONSTANT TEXT[] := ARRAY['status', 'employee_confirmed', 'employee_confirmed_at', 'employee_comments'];
  old_restricted JSONB;
  new_restricted JSONB;
BEGIN
  -- Only restrict non-admin employees (HR admins/managers use service role or have separate policies)
  IF NEW.employee_id = auth.uid() THEN
    -- Strip allowed fields and compare everything else
    old_restricted := to_jsonb(OLD) - allowed_fields;
    new_restricted := to_jsonb(NEW) - allowed_fields;

    IF new_restricted IS DISTINCT FROM old_restricted THEN
      RAISE EXCEPTION 'Employees may only update confirmation fields (status, employee_confirmed, employee_confirmed_at, employee_comments)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_rtw_employee_update_trigger ON public.return_to_work_forms;
CREATE TRIGGER restrict_rtw_employee_update_trigger
  BEFORE UPDATE ON public.return_to_work_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_rtw_employee_update();
