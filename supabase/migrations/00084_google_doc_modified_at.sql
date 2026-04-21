-- Track when the source Google Doc was last edited, alongside the existing
-- `last_synced_at` (when the intranet copy was refreshed).
--
-- Enables two things:
--  1. Drift signalling: compare source-edited vs last-synced to tell editors
--     when the intranet copy is lagging behind their recent Drive edits.
--  2. Correct content-staleness calculation: the existing 12-month "may need
--     review" warning was computed against `updated_at`, which bumps on every
--     sync. After this column lands, the warning computes against the actual
--     source-edit age so a year-old doc that re-synced last night is still
--     flagged as stale content.
--
-- Populated by src/lib/google-drive.ts#syncDocumentContent (extended to call
-- files.get with fields: "modifiedTime" in parallel with the files.export
-- call). Persisted by every sync path: linkGoogleDoc, syncArticle,
-- syncAllArticles, and the Drive webhook handler.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resource_articles'
      AND column_name = 'google_doc_modified_at'
  ) THEN
    ALTER TABLE public.resource_articles ADD COLUMN google_doc_modified_at TIMESTAMPTZ;
  END IF;
END $$;
