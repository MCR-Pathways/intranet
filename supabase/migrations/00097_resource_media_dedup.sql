-- Resource media: cross-article deduplication
--
-- Background. The original `resource_media` schema (00077) was one-row-per-
-- file with a single `article_id` foreign key. That model can't represent
-- the same Drive file referenced by multiple articles — the second article
-- to use it would either re-upload (Drive duplication) or skip uploading
-- and break the proxy whitelist for the second article. The WordPress
-- migration surfaces this immediately: pc-support and people-services
-- both reference the same Interim Child Protection PDF.
--
-- Resolution. A junction table (`resource_media_articles`) carries the
-- many-to-many relationship. Each `resource_media` row remains the
-- canonical record for a single Drive file (still UNIQUE on `file_id`)
-- and grows an `original_url` column so the WP migration can dedupe
-- uploads by source URL across articles. The legacy `article_id` column
-- on `resource_media` stays in place pointing at the FIRST article that
-- referenced the file — both for backward compat with reads that still
-- use it and as a non-null breadcrumb for the original uploader.
--
-- Backfill. Every existing `resource_media` row with a non-null
-- `article_id` gets a matching junction row, so no read path loses
-- visibility into the file's association.

-- 1. Original-URL column on resource_media.
ALTER TABLE public.resource_media
  ADD COLUMN IF NOT EXISTS original_url text;

CREATE INDEX IF NOT EXISTS idx_resource_media_original_url
  ON public.resource_media(original_url)
  WHERE original_url IS NOT NULL;

-- 2. Junction table.
CREATE TABLE IF NOT EXISTS public.resource_media_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.resource_media(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.resource_articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_media_articles_media_id
  ON public.resource_media_articles(media_id);

CREATE INDEX IF NOT EXISTS idx_resource_media_articles_article_id
  ON public.resource_media_articles(article_id);

-- 3. Backfill from the legacy `resource_media.article_id` column.
-- Idempotent via ON CONFLICT DO NOTHING (the UNIQUE constraint above).
INSERT INTO public.resource_media_articles (media_id, article_id, created_at)
SELECT rm.id, rm.article_id, rm.created_at
FROM public.resource_media rm
WHERE rm.article_id IS NOT NULL
ON CONFLICT (media_id, article_id) DO NOTHING;

-- 4. RLS for the junction.
ALTER TABLE public.resource_media_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view media articles"
  ON public.resource_media_articles;
CREATE POLICY "Authenticated users can view media articles"
  ON public.resource_media_articles FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Content editors can insert media articles"
  ON public.resource_media_articles;
CREATE POLICY "Content editors can insert media articles"
  ON public.resource_media_articles FOR INSERT
  WITH CHECK (
    public.is_content_editor_effective(auth.uid())
    OR public.is_hr_admin_effective(auth.uid())
  );

DROP POLICY IF EXISTS "Content editors can delete media articles"
  ON public.resource_media_articles;
CREATE POLICY "Content editors can delete media articles"
  ON public.resource_media_articles FOR DELETE
  USING (
    public.is_content_editor_effective(auth.uid())
    OR public.is_hr_admin_effective(auth.uid())
  );
