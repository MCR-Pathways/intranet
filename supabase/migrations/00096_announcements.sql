-- W4b: Announcement post type — author permission flag + time-bound expiry.
--
-- The post_type discriminator already accepts 'announcement' (added in
-- migration 00095 alongside the Tool Shed types as a pre-reservation
-- for W4b). This migration adds the metadata the renderer + compose
-- flow need:
--
--   - profiles.can_post_announcements — capability flag, orthogonal to
--     is_hr_admin. Granting is gated to is_systems_admin (NOT
--     is_hr_admin) at the action level so comms authority stays
--     decoupled from HR data access.
--
--   - posts.announcement_expires_at — when the announcement chrome
--     drops back to a regular news post visually. Required for
--     announcement posts, forbidden for everything else (CHECK
--     constraint mirrors the kudos_category pattern in 00095).
--
-- Expiry handling is compute-on-read in the renderer:
--   showAsPinned = is_pinned AND (post_type != 'announcement'
--                                 OR announcement_expires_at > now())
-- No cron needed — drift impossible because expiry is a function of
-- current time on every render.

-- ─── Author capability flag ──────────────────────────────────────
-- A handful of named users (CEO, senior leadership, comms) get this
-- flag. Default false; granting requires is_systems_admin at the
-- server-action level (no DB-level RLS gate on this column because
-- the profiles table already has its own author-only update policy).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_post_announcements boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.can_post_announcements IS
  'Whether this user can post Announcement-typed posts (W4b). Orthogonal to is_hr_admin. Granted by is_systems_admin only.';

-- ─── Post expiry ──────────────────────────────────────────────────
-- Free-form timestamp per W4b design (author picks the date/time at
-- compose; no preset dropdown). NULL for everything that isn't an
-- announcement; required for announcements.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS announcement_expires_at timestamptz;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_announcement_expiry_consistent;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_announcement_expiry_consistent CHECK (
    (post_type = 'announcement' AND announcement_expires_at IS NOT NULL)
    OR (post_type != 'announcement' AND announcement_expires_at IS NULL)
  );

COMMENT ON COLUMN public.posts.announcement_expires_at IS
  'When the announcement chrome (top-strip accent + header badge + auto-pin) drops back to a regular news post visually. Compute-on-read; no cron.';

-- Partial index — most queries care about active (un-expired)
-- announcements. Pinning logic compares expires_at > now() on every
-- feed render so an index on the column under the type predicate
-- pays for itself even at MCR scale.
CREATE INDEX IF NOT EXISTS idx_posts_active_announcements
  ON public.posts (announcement_expires_at)
  WHERE post_type = 'announcement';
