-- Add partial unique index on google_doc_id to:
-- 1. Speed up cross-link map queries (WHERE google_doc_id IS NOT NULL)
-- 2. Prevent duplicate google_doc_id values at the database level
--    (closes TOCTOU race in the SELECT-then-INSERT check in linkGoogleDoc)

CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_articles_google_doc_id
  ON resource_articles (google_doc_id)
  WHERE google_doc_id IS NOT NULL;
