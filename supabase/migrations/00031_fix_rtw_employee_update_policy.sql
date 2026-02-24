-- Fix: Employees could not confirm RTW forms because no UPDATE policy existed.
-- The confirmRTWForm action updates status, employee_confirmed, employee_confirmed_at, employee_comments.
-- Scoped to: own forms only, and only when form is in "submitted" status.

DROP POLICY IF EXISTS "Employees can confirm own RTW forms" ON public.return_to_work_forms;
CREATE POLICY "Employees can confirm own RTW forms"
  ON public.return_to_work_forms FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() AND status = 'submitted')
  WITH CHECK (employee_id = auth.uid());
