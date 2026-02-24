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
CREATE OR REPLACE FUNCTION public.restrict_rtw_employee_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only restrict non-admin employees (HR admins/managers use service role or have separate policies)
  IF NEW.employee_id = auth.uid() THEN
    -- Employees may only change confirmation-related fields
    IF NEW.manager_id IS DISTINCT FROM OLD.manager_id
      OR NEW.absence_record_id IS DISTINCT FROM OLD.absence_record_id
      OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
      OR NEW.absence_start_date IS DISTINCT FROM OLD.absence_start_date
      OR NEW.absence_end_date IS DISTINCT FROM OLD.absence_end_date
      OR NEW.total_days_absent IS DISTINCT FROM OLD.total_days_absent
      OR NEW.absence_reason IS DISTINCT FROM OLD.absence_reason
      OR NEW.absence_details IS DISTINCT FROM OLD.absence_details
      OR NEW.fit_to_return IS DISTINCT FROM OLD.fit_to_return
      OR NEW.return_restrictions IS DISTINCT FROM OLD.return_restrictions
      OR NEW.workplace_changes_needed IS DISTINCT FROM OLD.workplace_changes_needed
      OR NEW.wellbeing_discussion IS DISTINCT FROM OLD.wellbeing_discussion
      OR NEW.medical_advice_sought IS DISTINCT FROM OLD.medical_advice_sought
      OR NEW.medical_advice_details IS DISTINCT FROM OLD.medical_advice_details
      OR NEW.trigger_point_reached IS DISTINCT FROM OLD.trigger_point_reached
      OR NEW.trigger_point_details IS DISTINCT FROM OLD.trigger_point_details
      OR NEW.manager_notes IS DISTINCT FROM OLD.manager_notes
      OR NEW.manager_confirmed IS DISTINCT FROM OLD.manager_confirmed
      OR NEW.manager_confirmed_at IS DISTINCT FROM OLD.manager_confirmed_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
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
