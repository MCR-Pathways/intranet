-- Hub course schema additions.
--
-- A course is either authored natively in this app ('native') or mirrored
-- from the central hub ('hub'). Hub-sourced courses carry the originating
-- hub course's id in source_course_id so the mirror can be reconciled.
--
-- No enum type: TEXT + CHECK per CLAUDE.md (enums cause transaction
-- failures and are awkward to alter in production). All steps are guarded
-- so the migration is re-runnable. RLS is left untouched.

-- 1. Provenance discriminator. Existing rows are native by default.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'native';

-- 2. Restrict source to the known values. Guarded drop keeps the ADD
--    re-runnable (a bare ADD CONSTRAINT errors on the second run).
ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_source_check;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_source_check CHECK (source IN ('native', 'hub'));

-- 3. The originating hub course id (NULL for native courses).
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS source_course_id uuid;

-- 4. A hub course may only be mirrored once. Partial so native rows
--    (source_course_id NULL) are exempt from uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS uq_courses_source_course
  ON public.courses (source_course_id)
  WHERE source = 'hub';

COMMENT ON COLUMN public.courses.source IS
  'Course provenance: ''native'' (authored in this app) or ''hub'' (mirrored from the central hub). Enforced by courses_source_check.';

COMMENT ON COLUMN public.courses.source_course_id IS
  'For hub-sourced courses, the originating hub course''s id. NULL for native courses. Unique among hub courses via uq_courses_source_course.';
