-- Resource media tracking table.
-- Whitelists Google Drive file IDs uploaded through the intranet.
-- The proxy at /api/drive-file/[fileId] checks this table before serving.

CREATE TABLE IF NOT EXISTS public.resource_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id text NOT NULL UNIQUE,
  article_id uuid REFERENCES public.resource_articles(id) ON DELETE SET NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_media_file_id
  ON public.resource_media(file_id);

CREATE INDEX IF NOT EXISTS idx_resource_media_article_id
  ON public.resource_media(article_id);

-- RLS: proxy checks the whitelist via service client (bypasses RLS).
-- These policies protect against direct Supabase REST API access.
ALTER TABLE public.resource_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view media"
  ON public.resource_media FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Content editors can insert media"
  ON public.resource_media FOR INSERT
  WITH CHECK (
    public.is_content_editor_effective(auth.uid())
    OR public.is_hr_admin_effective(auth.uid())
  );

CREATE POLICY "Uploaders can delete own media"
  ON public.resource_media FOR DELETE
  USING (uploaded_by = auth.uid());
