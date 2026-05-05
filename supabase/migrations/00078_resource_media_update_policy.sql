-- Allow content editors to update resource_media rows (e.g. reassign article_id).
-- Matches the INSERT policy pattern from migration 00077.
--
-- DROP/CREATE is the established idempotency pattern in this repo
-- (see 00038_create_resource_tables.sql). CREATE POLICY IF NOT EXISTS
-- would be cleaner but was added in Postgres 16; Supabase MCRP runs PG 15.

DROP POLICY IF EXISTS "Content editors can update media" ON public.resource_media;
CREATE POLICY "Content editors can update media"
  ON public.resource_media FOR UPDATE
  USING (
    public.is_content_editor_effective(auth.uid())
    OR public.is_hr_admin_effective(auth.uid())
  )
  WITH CHECK (
    public.is_content_editor_effective(auth.uid())
    OR public.is_hr_admin_effective(auth.uid())
  );
