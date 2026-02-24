-- Extend staff_leaving_forms to support multi-step offboarding workflow.
-- The table was created in migration 00024 but lacked workflow columns.
-- All changes are idempotent (safe to re-run).

-- 1. Add status column with CHECK constraint (TEXT, not ENUM — per project convention)
DO $$ BEGIN
  ALTER TABLE public.staff_leaving_forms ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'in_progress', 'completed', 'cancelled'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Add initiated_by (who started the form — manager or HR admin)
DO $$ BEGIN
  ALTER TABLE public.staff_leaving_forms ADD COLUMN initiated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Add last_working_date (may differ from leaving_date, e.g. garden leave)
DO $$ BEGIN
  ALTER TABLE public.staff_leaving_forms ADD COLUMN last_working_date DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 4. Make completed_by nullable (not known at draft creation time)
ALTER TABLE public.staff_leaving_forms ALTER COLUMN completed_by DROP NOT NULL;

-- 5. Make completed_at nullable and remove DEFAULT (should be NULL until form is completed)
ALTER TABLE public.staff_leaving_forms ALTER COLUMN completed_at DROP NOT NULL;
ALTER TABLE public.staff_leaving_forms ALTER COLUMN completed_at DROP DEFAULT;

-- 6. Partial unique index: one active leaving form per employee
-- Allows rehired employees (completed form) and cancelled forms to coexist
DROP INDEX IF EXISTS idx_staff_leaving_active_per_profile;
CREATE UNIQUE INDEX idx_staff_leaving_active_per_profile
  ON public.staff_leaving_forms(profile_id)
  WHERE status NOT IN ('completed', 'cancelled');

-- 7. Index on status for dashboard queries
CREATE INDEX IF NOT EXISTS idx_staff_leaving_status
  ON public.staff_leaving_forms(status);

-- 8. Backfill initiated_by from completed_by for any existing rows
UPDATE public.staff_leaving_forms
  SET initiated_by = completed_by
  WHERE initiated_by IS NULL AND completed_by IS NOT NULL;
