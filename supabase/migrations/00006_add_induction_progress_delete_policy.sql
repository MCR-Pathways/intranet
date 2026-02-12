-- Allow HR admins to delete induction progress (used when resetting a user's induction)

DROP POLICY IF EXISTS "HR admins can delete induction progress" ON public.induction_progress;
CREATE POLICY "HR admins can delete induction progress"
ON public.induction_progress FOR DELETE
TO authenticated
USING (public.is_hr_admin());

-- Atomic function to reset a user's induction
-- Deletes all progress items and resets profile status in a single transaction
CREATE OR REPLACE FUNCTION public.reset_user_induction(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM public.induction_progress
  WHERE user_id = target_user_id;

  UPDATE public.profiles
  SET induction_completed_at = NULL,
      status = 'pending_induction'
  WHERE id = target_user_id;
END;
$$;
