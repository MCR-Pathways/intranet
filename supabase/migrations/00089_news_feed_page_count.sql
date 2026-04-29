-- News-feed media: page count column for documents.
--
-- Lets the news-feed attachment card and document lightbox toolbar render
-- "PDF · 12 pages · 230 KB" instead of the bare "PDF · 230 KB" — a
-- cheap scannability win for users deciding whether to open a document.
--
-- Populated at upload time via `unpdf` for PDFs (see uploadPostAttachment).
-- Stays NULL for non-PDFs and for any document where extraction failed
-- (corrupt or password-protected). UI falls back to size-only meta line
-- when NULL.
--
-- Both columns are nullable. Existing rows from before this migration
-- will have NULL page_count and that's fine — the UI handles it.

ALTER TABLE public.news_feed_media
  ADD COLUMN IF NOT EXISTS page_count integer;

ALTER TABLE public.post_attachments
  ADD COLUMN IF NOT EXISTS page_count integer;
