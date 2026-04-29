-- News-feed media staging table.
--
-- Tracks Drive files uploaded via the news-feed composer BEFORE the post
-- is created. Without this, the /api/drive-file/[fileId] proxy 404s on
-- pre-post composer thumbnails because post_attachments.drive_file_id
-- isn't populated until the post is saved.
--
-- Lifecycle:
--   1. Composer upload → INSERT here (uploadPostAttachment)
--   2. Composer thumbnail renders via /api/drive-file/{id} (proxy finds
--      this row, serves the converted JPEG)
--   3a. User posts → row promoted to post_attachments, this row DELETED
--       (post_attachments is canonical post-creation)
--   3b. User clicks X on thumbnail or discards composer → row + Drive file
--       deleted eagerly (discardStagedAttachments server action)
--   3c. Browser crashes / network failure → daily pg_cron sweep deletes
--       rows older than 24h with no matching post_attachments row,
--       plus their Drive files (belt-and-braces)
--
-- Mirrors the resource_media table (00077) which solves the same problem
-- for Resources article media.

-- ============================================================================
-- 1. Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.news_feed_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  image_width integer,
  image_height integer,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Proxy whitelist lookup
CREATE INDEX IF NOT EXISTS idx_news_feed_media_file_id
  ON public.news_feed_media(file_id);

-- Cron sweep + per-user discard lookups
CREATE INDEX IF NOT EXISTS idx_news_feed_media_uploaded_by_created_at
  ON public.news_feed_media(uploaded_by, created_at);

-- ============================================================================
-- 2. RLS
-- ============================================================================
-- Proxy uses the service client (bypasses RLS) to query the whitelist.
-- These policies protect against direct Supabase REST API access.

ALTER TABLE public.news_feed_media ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can read. Matches resource_media. The proxy
-- doesn't depend on this (service client), but lets dev tooling query it.
CREATE POLICY "Authenticated users can view staged media"
  ON public.news_feed_media FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: must be a poster AND must claim themselves as uploader. Tighter
-- than resource_media's INSERT policy (which doesn't enforce uploaded_by).
CREATE POLICY "Posters can stage their own media"
  ON public.news_feed_media FOR INSERT
  WITH CHECK (
    public.can_create_posts()
    AND auth.uid() = uploaded_by
  );

-- DELETE: uploader-only. Used by the discard action when user clicks X
-- or discards the composer. Cron sweep uses service role (bypasses RLS).
CREATE POLICY "Uploaders can delete own staged media"
  ON public.news_feed_media FOR DELETE
  USING (uploaded_by = auth.uid());

-- ============================================================================
-- 3. Daily sweep cron (belt-and-braces for browser-crash orphans)
-- ============================================================================
-- Eager paths (post-creation hand-off, X-click discard, composer-discard)
-- handle 99% of cleanup. This catches edge cases: tab closed mid-post,
-- network failure between upload and post insert, server crash etc.
--
-- Schedule: daily at 03:30 UTC. After renew-drive-watches (03:00) so the
-- two cron jobs don't compete for the same Drive API quota window.
--
-- Guards mirror migration 00086.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-staged-media') THEN
      PERFORM cron.unschedule('sweep-staged-media');
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension is not enabled.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension is not enabled.';
  END IF;
END $$;

SELECT cron.schedule(
  'sweep-staged-media',
  '30 3 * * *',
  $cron$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/cron/sweep-staged-media',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    )
  );
  $cron$
);
