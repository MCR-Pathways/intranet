-- ============================================================================
-- Migration: 00057_poll_multi_select.sql
-- Description: Add multi-select support to polls.
--   1. Add poll_allow_multiple column to posts table
--   2. Replace UNIQUE(post_id, user_id) with UNIQUE(post_id, user_id, option_id)
--      on poll_votes to allow multiple votes per user per poll (one per option)
-- ============================================================================

-- 1. Add multi-select flag to posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS poll_allow_multiple BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Drop old unique constraint and create new one
-- The old constraint was defined inline as UNIQUE(post_id, user_id) in migration 00036,
-- which PostgreSQL auto-names as "poll_votes_post_id_user_id_key".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'poll_votes_post_id_user_id_key'
    AND conrelid = 'public.poll_votes'::regclass
  ) THEN
    ALTER TABLE public.poll_votes
      DROP CONSTRAINT poll_votes_post_id_user_id_key;
  END IF;
END $$;

-- New constraint: one vote per user per option (allows multiple options per user)
ALTER TABLE public.poll_votes
  ADD CONSTRAINT poll_votes_post_user_option_key
  UNIQUE (post_id, user_id, option_id);
