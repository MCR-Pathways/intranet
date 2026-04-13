-- Allow content editors to update resource_media rows (e.g. reassign article_id).
-- Matches the INSERT policy pattern from migration 00077.

CREATE POLICY IF NOT EXISTS "Content editors can update media"
  ON public.resource_media FOR UPDATE
  USING (
    public.is_content_editor_effective(auth.uid())
    OR public.is_hr_admin_effective(auth.uid())
  )
  WITH CHECK (
    public.is_content_editor_effective(auth.uid())
    OR public.is_hr_admin_effective(auth.uid())
  );
