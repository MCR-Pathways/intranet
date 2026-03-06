-- MCR Pathways Intranet — Working Location V2
-- Replaces the daily sign-in model with a schedule-based working location system.
-- Supports: weekly planning, split-day (morning/afternoon), Google Calendar sync,
-- kiosk check-in confirmation, and leave integration.
-- Uses IF NOT EXISTS / DROP IF EXISTS for idempotent execution.

-- ===========================================
-- DROP OLD SIGN-IN SYSTEM
-- ===========================================

DROP TABLE IF EXISTS public.sign_ins CASCADE;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS last_sign_in_date;

-- ===========================================
-- WORKING LOCATIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.working_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_slot TEXT NOT NULL CHECK (time_slot IN ('full_day', 'morning', 'afternoon')),
  location TEXT NOT NULL CHECK (location IN ('home', 'glasgow_office', 'stevenage_office', 'other', 'on_leave')),
  other_location TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'calendar', 'pattern', 'leave')),
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  google_event_id TEXT,
  leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Upsert model: one entry per user per day per time slot
  CONSTRAINT working_locations_user_date_slot_unique UNIQUE (user_id, date, time_slot)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_working_locations_user_date
  ON public.working_locations(user_id, date);
CREATE INDEX IF NOT EXISTS idx_working_locations_date
  ON public.working_locations(date);
CREATE INDEX IF NOT EXISTS idx_working_locations_google_event
  ON public.working_locations(google_event_id) WHERE google_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_working_locations_office_headcount
  ON public.working_locations(date, location)
  WHERE location IN ('glasgow_office', 'stevenage_office');
CREATE INDEX IF NOT EXISTS idx_working_locations_leave_request
  ON public.working_locations(leave_request_id) WHERE leave_request_id IS NOT NULL;

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.update_working_locations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_working_locations_updated_at ON public.working_locations;
CREATE TRIGGER trg_working_locations_updated_at
  BEFORE UPDATE ON public.working_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_working_locations_updated_at();

-- ===========================================
-- WEEKLY PATTERNS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.weekly_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_slot TEXT NOT NULL DEFAULT 'full_day' CHECK (time_slot IN ('full_day', 'morning', 'afternoon')),
  location TEXT NOT NULL CHECK (location IN ('home', 'glasgow_office', 'stevenage_office', 'other')),
  other_location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One pattern per user per day per time slot
  CONSTRAINT weekly_patterns_user_day_slot_unique UNIQUE (user_id, day_of_week, time_slot)
);

-- ===========================================
-- CALENDAR SYNC COLUMNS ON PROFILES
-- ===========================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendar_sync_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendar_last_synced_at TIMESTAMPTZ;

-- ===========================================
-- ROW LEVEL SECURITY — WORKING LOCATIONS
-- ===========================================

ALTER TABLE public.working_locations ENABLE ROW LEVEL SECURITY;

-- Users can view their own entries
DROP POLICY IF EXISTS "Users can view own working locations" ON public.working_locations;
CREATE POLICY "Users can view own working locations"
  ON public.working_locations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own entries
DROP POLICY IF EXISTS "Users can insert own working locations" ON public.working_locations;
CREATE POLICY "Users can insert own working locations"
  ON public.working_locations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own entries
DROP POLICY IF EXISTS "Users can update own working locations" ON public.working_locations;
CREATE POLICY "Users can update own working locations"
  ON public.working_locations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own entries
DROP POLICY IF EXISTS "Users can delete own working locations" ON public.working_locations;
CREATE POLICY "Users can delete own working locations"
  ON public.working_locations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Line managers can view their direct reports' entries
DROP POLICY IF EXISTS "Managers can view reports working locations" ON public.working_locations;
CREATE POLICY "Managers can view reports working locations"
  ON public.working_locations FOR SELECT
  TO authenticated
  USING (public.manages_user(user_id));

-- HR admins can view all entries
DROP POLICY IF EXISTS "HR admins can view all working locations" ON public.working_locations;
CREATE POLICY "HR admins can view all working locations"
  ON public.working_locations FOR SELECT
  TO authenticated
  USING (public.is_hr_admin());

-- Service role can insert for leave integration + calendar sync
-- (service_role bypasses RLS by default — no explicit policy needed)

-- ===========================================
-- ROW LEVEL SECURITY — WEEKLY PATTERNS
-- ===========================================

ALTER TABLE public.weekly_patterns ENABLE ROW LEVEL SECURITY;

-- Users can manage their own patterns
DROP POLICY IF EXISTS "Users can manage own weekly patterns" ON public.weekly_patterns;
CREATE POLICY "Users can manage own weekly patterns"
  ON public.weekly_patterns FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Line managers can view their direct reports' patterns
DROP POLICY IF EXISTS "Managers can view reports weekly patterns" ON public.weekly_patterns;
CREATE POLICY "Managers can view reports weekly patterns"
  ON public.weekly_patterns FOR SELECT
  TO authenticated
  USING (public.manages_user(user_id));

-- HR admins can view all patterns
DROP POLICY IF EXISTS "HR admins can view all weekly patterns" ON public.weekly_patterns;
CREATE POLICY "HR admins can view all weekly patterns"
  ON public.weekly_patterns FOR SELECT
  TO authenticated
  USING (public.is_hr_admin());
