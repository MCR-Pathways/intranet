-- ===========================================
-- Migration 00030: Extend RTW forms & absence records for Phase 2
-- ===========================================
-- Adds missing fields from MCR's paper Return to Work Discussion Form,
-- a generated `is_long_term` column on absence_records, and a notification
-- INSERT policy so managers/HR can send RTW confirmation notifications.
--
-- All column additions are idempotent (DO $$ ... EXCEPTION WHEN duplicate_column).

-- ===========================================
-- 1. ALTER return_to_work_forms — add new columns
-- ===========================================

-- Discussion date (separate from completed_at — when the meeting took place)
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN discussion_date DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Pregnancy-related absence (Paper form Part 2)
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN is_pregnancy_related BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Underlying cause (Paper form Part 2)
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN has_underlying_cause BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- "How are you feeling?" discussion notes (Paper form Part 2)
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN wellbeing_discussion TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Medical advice sought/shared (Paper form Part 2)
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN medical_advice_details TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Trigger point reached (auto-calculated, manager can override)
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN trigger_point_reached BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Trigger point details (auto-filled reason or manager override text)
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN trigger_point_details TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Were absence reporting/certification procedures followed?
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN procedures_followed BOOLEAN DEFAULT TRUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Reason procedures were not followed
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN procedures_not_followed_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Employee confirmed the form is accurate (authenticated button click)
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN employee_confirmed BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- When the employee confirmed
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN employee_confirmed_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Form lifecycle status: draft → submitted → confirmed → locked
DO $$ BEGIN
  ALTER TABLE public.return_to_work_forms ADD COLUMN status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'confirmed', 'locked'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ===========================================
-- 2. Make reason_for_absence nullable for draft support
-- ===========================================
-- The original schema has `reason_for_absence TEXT NOT NULL` but drafts
-- won't have this filled yet. Drop the NOT NULL constraint.
ALTER TABLE public.return_to_work_forms ALTER COLUMN reason_for_absence DROP NOT NULL;

-- ===========================================
-- 3. Index on status for pending RTW dashboard queries
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_rtw_forms_status
  ON public.return_to_work_forms(status)
  WHERE status IN ('draft', 'submitted');

-- ===========================================
-- 4. ALTER absence_records — add generated is_long_term column
-- ===========================================
-- MCR policy: absences of 28+ calendar days are classified as long-term.
-- This generated column avoids repeating the calculation in every query.
DO $$ BEGIN
  ALTER TABLE public.absence_records ADD COLUMN is_long_term BOOLEAN
    GENERATED ALWAYS AS (end_date - start_date >= 28) STORED;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Index for filtering long-term absences
CREATE INDEX IF NOT EXISTS idx_absence_records_long_term
  ON public.absence_records(profile_id)
  WHERE is_long_term = TRUE;

-- ===========================================
-- 5. Notification INSERT policy for managers and HR admins
-- ===========================================
-- The notifications table only has SELECT/UPDATE/DELETE policies.
-- Managers need to insert notifications when submitting RTW forms.
DROP POLICY IF EXISTS "Managers and HR can insert notifications" ON public.notifications;
CREATE POLICY "Managers and HR can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.is_hr_admin()
    OR public.manages_user(user_id)
  );
