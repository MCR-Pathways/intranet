-- Allow HR admins to delete induction progress (used when resetting a user's induction)

DROP POLICY IF EXISTS "HR admins can delete induction progress" ON public.induction_progress;
CREATE POLICY "HR admins can delete induction progress"
ON public.induction_progress FOR DELETE
TO authenticated
USING (public.is_hr_admin());
