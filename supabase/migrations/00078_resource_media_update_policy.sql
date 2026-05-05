-- Allow content editors to update resource_media rows (e.g. reassign article_id).
-- Matches the INSERT policy pattern from migration 00077.
--
-- Uses a DO block instead of CREATE POLICY IF NOT EXISTS because the latter
-- syntax was added in Postgres 16, and Supabase MCRP runs PG 15.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'resource_media'
      AND policyname = 'Content editors can update media'
  ) THEN
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
  END IF;
END $$;
