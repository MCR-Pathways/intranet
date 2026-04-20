-- Adds the columns needed to renew Google Drive push-notification watches
-- before they hit the 7-day hard expiry. Used by /api/cron/renew-drive-watches.
--
-- `google_watch_resource_id` already exists (migration 00058). This migration
-- adds the channel id (so we can stop old channels on renewal without
-- reconstructing it) and the expiration timestamp (so the cron knows when to
-- renew). Both nullable — rows predating this migration get populated on the
-- next cron run.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resource_articles'
      AND column_name = 'google_watch_channel_id'
  ) THEN
    ALTER TABLE public.resource_articles ADD COLUMN google_watch_channel_id TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resource_articles'
      AND column_name = 'google_watch_expires_at'
  ) THEN
    ALTER TABLE public.resource_articles ADD COLUMN google_watch_expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Partial index keeps the renewal query cheap. The cron filters on
-- content_type + google_doc_id and orders/filters on google_watch_expires_at,
-- so all three columns sit in the index predicate or key.
CREATE INDEX IF NOT EXISTS resource_articles_watch_expiry_idx
  ON public.resource_articles (google_watch_expires_at)
  WHERE content_type = 'google_doc' AND google_doc_id IS NOT NULL;
