-- W4: post-type taxonomy + Kudos recipient join table.
--
-- Adds a discriminator to news-feed posts so the renderer can tell
-- regular news from Kudos, Tool Shed types (W5), and Announcements
-- (W4b — same enum, separate workstream). Pre-launch program; no
-- data migration needed — existing posts default to 'news'.
--
-- Kudos recipients live in a join table so a single post can credit
-- multiple colleagues (verified via Bonusly + Lattice + Teams Praise
-- multi-recipient patterns). Notifications fan out cleanly via SELECT
-- on this table; "kudos received by user X" queries are normal joins;
-- profile deletion cascades drop dangling recipient rows.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'news',
  ADD COLUMN IF NOT EXISTS kudos_category text;

-- Whitelist enforced via CHECK rather than a Postgres ENUM (project
-- convention — enums are awkward to extend; TEXT + CHECK is preferred).
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_post_type_valid;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_post_type_valid CHECK (
    post_type IN (
      'news',
      'kudos',
      'announcement',
      'tool_shed_postcard',
      'tool_shed_three_two_one',
      'tool_shed_takeover'
    )
  );

-- Category is required for kudos and forbidden for everything else —
-- prevents drift where a "news" post accidentally has a kudos
-- category set, or a "kudos" post lacks one.
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_kudos_category_consistent;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_kudos_category_consistent CHECK (
    (post_type = 'kudos' AND kudos_category IS NOT NULL)
    OR (post_type != 'kudos' AND kudos_category IS NULL)
  );

-- Index for filtering by type. Low cardinality column; partial indexes
-- per non-default type would be more efficient at scale, but at ~80
-- staff a single composite index is simpler and fast enough.
CREATE INDEX IF NOT EXISTS idx_posts_post_type
  ON public.posts (post_type)
  WHERE post_type != 'news';

-- ─── Kudos recipients ────────────────────────────────────────────────
-- One row per (post, recipient) pair. Cap (10 max) is enforced at the
-- server-action level; CHECK constraint here would require triggers.

CREATE TABLE IF NOT EXISTS public.post_kudos_recipients (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, recipient_id)
);

-- Index on recipient_id for "kudos received by user X" queries (future
-- profile surfaces, leaderboard reports if ever wanted).
CREATE INDEX IF NOT EXISTS idx_post_kudos_recipients_recipient
  ON public.post_kudos_recipients (recipient_id, created_at DESC);

-- RLS — same model as posts: anyone can read, only the post author
-- can insert/delete. The action-level guard (only kudos posts can
-- have recipients) lives in code, not the DB.
ALTER TABLE public.post_kudos_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_kudos_recipients_select" ON public.post_kudos_recipients;
CREATE POLICY "post_kudos_recipients_select"
  ON public.post_kudos_recipients
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "post_kudos_recipients_insert" ON public.post_kudos_recipients;
CREATE POLICY "post_kudos_recipients_insert"
  ON public.post_kudos_recipients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE id = post_id AND author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "post_kudos_recipients_delete" ON public.post_kudos_recipients;
CREATE POLICY "post_kudos_recipients_delete"
  ON public.post_kudos_recipients
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE id = post_id AND author_id = auth.uid()
    )
  );

-- No UPDATE policy — recipients are insert-only (locked at publish
-- with add-only edits per W4 design). Rows can only be created or
-- deleted via cascade.

COMMENT ON COLUMN public.posts.post_type IS
  'Post type discriminator: news (default), kudos, announcement, tool_shed_postcard, tool_shed_three_two_one, tool_shed_takeover.';
COMMENT ON TABLE public.post_kudos_recipients IS
  'Recipients of a kudos post (W4). Cap of 10 enforced server-side.';
