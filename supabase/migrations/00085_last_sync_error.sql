-- Migration 00085: Record the most recent Drive sync failure per article.
-- Nullable column; written by every sync caller (linkGoogleDoc, syncArticle,
-- syncAllArticles, Drive webhook route). Cleared to NULL on the next success.
-- Truncated to ~500 chars by callers via truncateSyncError() — free-form Drive
-- API errors can be verbose, and the diagnostic surfaces only need a summary.

ALTER TABLE public.resource_articles
ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

COMMENT ON COLUMN public.resource_articles.last_sync_error IS
  'Error message from the most recent failed sync attempt. Cleared to NULL on the next successful sync. Callers should truncate to ~500 chars before writing.';
