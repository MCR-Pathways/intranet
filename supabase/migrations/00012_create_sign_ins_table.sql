-- MCR Pathways Intranet - Sign-Ins Table
-- Tracks working location entries for staff users
-- Supports multiple entries per day (e.g. morning at home, afternoon at office)
-- Uses IF NOT EXISTS / DROP IF EXISTS for idempotent execution

-- ===========================================
-- SIGN-INS TABLE
-- ===========================================

-- Drop the old version if it exists (this migration has not shipped to production)
DROP TABLE IF EXISTS public.sign_ins CASCADE;

CREATE TABLE public.sign_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sign_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT NOT NULL CHECK (location IN ('home', 'glasgow_office', 'stevenage_office', 'other')),
  other_location TEXT,
  signed_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: No UNIQUE(user_id, sign_in_date) — multiple entries per user per day are allowed

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sign_ins_user_date ON public.sign_ins(user_id, sign_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_sign_ins_date ON public.sign_ins(sign_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_sign_ins_user_date_time ON public.sign_ins(user_id, sign_in_date, signed_in_at);

-- ===========================================
-- ADD last_sign_in_date TO PROFILES
-- ===========================================

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN last_sign_in_date DATE;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE public.sign_ins ENABLE ROW LEVEL SECURITY;

-- Users can view their own sign-ins
DROP POLICY IF EXISTS "Users can view own sign-ins" ON public.sign_ins;
CREATE POLICY "Users can view own sign-ins"
  ON public.sign_ins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own sign-ins
DROP POLICY IF EXISTS "Users can insert own sign-ins" ON public.sign_ins;
CREATE POLICY "Users can insert own sign-ins"
  ON public.sign_ins FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own sign-ins (for correcting erroneous entries)
DROP POLICY IF EXISTS "Users can delete own sign-ins" ON public.sign_ins;
CREATE POLICY "Users can delete own sign-ins"
  ON public.sign_ins FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Line managers can view their direct reports' sign-ins
DROP POLICY IF EXISTS "Managers can view reports sign-ins" ON public.sign_ins;
CREATE POLICY "Managers can view reports sign-ins"
  ON public.sign_ins FOR SELECT
  TO authenticated
  USING (public.manages_user(user_id));

-- HR admins can view all sign-ins
DROP POLICY IF EXISTS "HR admins can view all sign-ins" ON public.sign_ins;
CREATE POLICY "HR admins can view all sign-ins"
  ON public.sign_ins FOR SELECT
  TO authenticated
  USING (public.is_hr_admin());
