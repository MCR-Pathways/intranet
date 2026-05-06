-- W3-rev.3: add `is_saved` + `saved_at` to `public.notifications`.
--
-- Pre-launch program; no data migration. New columns default to false / null
-- on every existing row so the Saved tab will be empty until users start
-- pinning things.
--
-- `is_saved` and `is_cleared` are independent. A row can be both saved AND
-- cleared — appears in both tabs. The 30-day Cleared retention sweep
-- (api/cron/sweep-cleared-notifications) gets a `is_saved = false` clause
-- in a follow-up code change so saved rows survive the sweep indefinitely.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS is_saved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saved_at timestamptz;

-- Saved tab query: WHERE user_id = X AND is_saved = true ORDER BY saved_at DESC.
-- Partial index keeps the on-disk size proportional to actual saved rows (~5%
-- of total in steady state) instead of indexing every row.
CREATE INDEX IF NOT EXISTS idx_notifications_user_saved
  ON public.notifications (user_id, saved_at DESC)
  WHERE is_saved = true;

-- Co-existence invariant: is_saved=true requires saved_at; is_saved=false
-- requires saved_at IS NULL. Drop-then-create so the migration is rerunnable
-- if the constraint logic ever changes.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_is_saved_consistent;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_is_saved_consistent
    CHECK (
      (is_saved = false AND saved_at IS NULL)
      OR (is_saved = true AND saved_at IS NOT NULL)
    );

COMMENT ON COLUMN public.notifications.is_saved IS
  'User pinned this notification — bypasses the 30-day Cleared retention sweep.';
COMMENT ON COLUMN public.notifications.saved_at IS
  'When the user pinned the notification. Null when is_saved=false (CHECK enforced).';
