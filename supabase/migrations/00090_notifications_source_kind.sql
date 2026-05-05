-- Add source-tracking + Cleared-state columns to notifications.
-- Foundation for W3-rev's auto-Clear-by-source_id and the 30-day retention sweep.
--
-- New columns:
--   source_kind  text         — categorisation (e.g. "leave_request", "post_mention")
--   source_id    text         — id of the source record; same value across all
--                               notifications generated from one source, so they
--                               can be auto-cleared together when state resolves
--   is_cleared   boolean      — true when the user has cleared the notification
--                               (auto on state resolution, navigation click on
--                               informational kinds, per-row X, or Clear all)
--   cleared_at   timestamptz  — when is_cleared flipped; powers retention sweep
--
-- The existing `is_read` column stays untouched in W3-rev.1 for legacy
-- DB-trigger compat. W3-rev.2 stops reading it; a later migration drops it
-- once nothing references it.
--
-- All operations are idempotent.

-- ============================================================================
-- 1. Columns
-- ============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS is_cleared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cleared_at timestamptz;

-- ============================================================================
-- 2. Pair-integrity constraint
-- ============================================================================
-- source_kind and source_id are either both populated or both null. Prevents
-- partial pairs from creeping in via unfamiliar callers.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_source_pair_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_source_pair_check
      CHECK (
        (source_kind IS NULL AND source_id IS NULL)
        OR (source_kind IS NOT NULL AND source_id IS NOT NULL)
      );
  END IF;
END $$;

-- ============================================================================
-- 3. Indexes
-- ============================================================================

-- Auto-Clear lookup: find every notification for a (user, source_kind, source_id)
-- tuple when the underlying source record's state resolves.
CREATE INDEX IF NOT EXISTS idx_notifications_source
  ON public.notifications (user_id, source_kind, source_id)
  WHERE source_kind IS NOT NULL;

-- Retention sweep: find Cleared rows older than 30 days for the daily cron.
CREATE INDEX IF NOT EXISTS idx_notifications_cleared_at
  ON public.notifications (cleared_at)
  WHERE is_cleared = true;
