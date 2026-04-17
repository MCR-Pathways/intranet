-- Migration 00080: Resource bookmarks + featured column cleanup
--
-- Adds per-user article bookmarks (replaces the admin-curated featured system).
-- Drops is_featured / featured_sort_order columns and index since no real
-- users exist yet (pre-launch).

-- 1. Bookmarks table
CREATE TABLE IF NOT EXISTS resource_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES resource_articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, article_id)
);

ALTER TABLE resource_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks"
  ON resource_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
  ON resource_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON resource_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Drop featured system (no real users, safe to remove)
DROP INDEX IF EXISTS idx_resource_articles_featured;

ALTER TABLE resource_articles
  DROP COLUMN IF EXISTS is_featured,
  DROP COLUMN IF EXISTS featured_sort_order;
