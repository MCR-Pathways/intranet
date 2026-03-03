-- Migration 00037: Flexible Working Requests
-- Digital replacement for the MCR Pathways paper-based "Request for Flexible
-- Working Form" under s.80F Employment Rights Act 1996.
--
-- Updated for the Employment Relations (Flexible Working) Act 2023 rules:
--   - Day-one right (no 26-week qualifying period)
--   - Up to 2 requests per 12-month period
--   - Employer must respond within 2 months
--   - Employer must consult before refusing
--
-- Workflow: Employee submits → Manager decides → Optional trial period → Optional appeal (HR)
--
-- Tables created:
--   flexible_working_requests — main request table
--   fwr_appeals — appeal records (one per rejected request)
--
-- All operations are idempotent (IF NOT EXISTS / DO blocks / DROP IF EXISTS).

-- ===========================================
-- 1. FLEXIBLE WORKING REQUESTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.flexible_working_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who is requesting and who decides
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Request details (from MCR paper form)
  request_type TEXT NOT NULL CHECK (request_type IN (
    'flexible_hours', 'compressed_hours', 'reduced_hours', 'job_sharing',
    'remote_hybrid', 'annualised_hours', 'staggered_hours', 'term_time', 'other'
  )),
  current_working_pattern TEXT NOT NULL,    -- free text: days/hours/times/location
  requested_working_pattern TEXT NOT NULL,  -- free text: desired pattern
  proposed_start_date DATE NOT NULL,
  reason TEXT,                              -- optional per 2024 law

  -- Workflow status
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'under_review', 'approved', 'approved_trial',
    'rejected', 'withdrawn', 'appealed', 'appeal_upheld', 'appeal_overturned'
  )),
  response_deadline DATE NOT NULL,  -- auto-calculated: created_at + 2 months

  -- Decision fields
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_notes TEXT,
  rejection_grounds TEXT[],       -- array of statutory ground keys
  rejection_explanation TEXT,     -- why refusal is reasonable on those grounds

  -- Trial period (optional, set on approval)
  trial_end_date DATE,
  trial_outcome TEXT CHECK (trial_outcome IN ('confirmed', 'extended', 'reverted')),
  trial_outcome_at TIMESTAMPTZ,
  trial_outcome_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Snapshot of the employee's work pattern before any change
  previous_work_pattern TEXT,

  -- Consultation meeting record (Acas Code requires written record)
  consultation_date DATE,
  consultation_format TEXT CHECK (consultation_format IN ('in_person', 'video', 'phone')),
  consultation_attendees TEXT,
  consultation_summary TEXT,
  consultation_alternatives TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 2. FWR APPEALS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.fwr_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.flexible_working_requests(id) ON DELETE CASCADE,

  -- Appeal details
  appeal_reason TEXT NOT NULL,
  appealed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Appeal meeting (optional — HR may decide without one)
  meeting_date DATE,
  meeting_notes TEXT,

  -- Outcome
  outcome TEXT CHECK (outcome IN ('upheld', 'overturned')),
  outcome_notes TEXT,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 3. INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_fwr_profile_id
  ON public.flexible_working_requests(profile_id);

CREATE INDEX IF NOT EXISTS idx_fwr_manager_id
  ON public.flexible_working_requests(manager_id);

CREATE INDEX IF NOT EXISTS idx_fwr_status
  ON public.flexible_working_requests(status)
  WHERE status IN ('submitted', 'under_review', 'approved_trial');

CREATE INDEX IF NOT EXISTS idx_fwr_response_deadline
  ON public.flexible_working_requests(response_deadline)
  WHERE status IN ('submitted', 'under_review');

CREATE INDEX IF NOT EXISTS idx_fwr_appeals_request_id
  ON public.fwr_appeals(request_id);

-- Partial unique index: max 1 live (unresolved) request per employee at a time.
-- Resolved statuses (approved, rejected, withdrawn, appeal_upheld, appeal_overturned) are excluded.
DROP INDEX IF EXISTS idx_fwr_active_per_profile;
CREATE UNIQUE INDEX idx_fwr_active_per_profile
  ON public.flexible_working_requests(profile_id)
  WHERE status NOT IN ('approved', 'approved_trial', 'rejected', 'withdrawn', 'appeal_upheld', 'appeal_overturned');

-- ===========================================
-- 4. ELIGIBILITY CHECK FUNCTION
-- ===========================================
-- Blocks creation if the employee already has 2+ requests in the last 12 months.
-- Called from the INSERT trigger. Uses RAISE EXCEPTION (not silent return)
-- per project convention.

CREATE OR REPLACE FUNCTION public.check_fwr_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.flexible_working_requests
  WHERE profile_id = NEW.profile_id
    AND status != 'withdrawn'
    AND created_at > (NOW() - INTERVAL '12 months');

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'Employee has already made 2 flexible working requests in the last 12 months (statutory limit under Employment Relations (Flexible Working) Act 2023)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_fwr_limit_trigger ON public.flexible_working_requests;
CREATE TRIGGER check_fwr_limit_trigger
  BEFORE INSERT ON public.flexible_working_requests
  FOR EACH ROW EXECUTE FUNCTION public.check_fwr_limit();

-- ===========================================
-- 5. ENABLE RLS
-- ===========================================

ALTER TABLE public.flexible_working_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fwr_appeals ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 6. RLS POLICIES — flexible_working_requests
-- ===========================================
-- Three-tier: self, manager, HR admin (same pattern as leave_requests)

-- SELECT: Users can view own requests
DROP POLICY IF EXISTS "Users can view own fwr" ON public.flexible_working_requests;
CREATE POLICY "Users can view own fwr"
  ON public.flexible_working_requests FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- SELECT: Managers can view their reports' requests
DROP POLICY IF EXISTS "Managers can view reports fwr" ON public.flexible_working_requests;
CREATE POLICY "Managers can view reports fwr"
  ON public.flexible_working_requests FOR SELECT TO authenticated
  USING (public.manages_user(profile_id));

-- INSERT: Users can create own requests
DROP POLICY IF EXISTS "Users can create own fwr" ON public.flexible_working_requests;
CREATE POLICY "Users can create own fwr"
  ON public.flexible_working_requests FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- UPDATE: Users can update own requests (withdraw only — status guard in app layer)
DROP POLICY IF EXISTS "Users can update own fwr" ON public.flexible_working_requests;
CREATE POLICY "Users can update own fwr"
  ON public.flexible_working_requests FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND status IN ('submitted', 'under_review'));

-- UPDATE: Managers can update requests they're assigned to (approve/reject/consult)
DROP POLICY IF EXISTS "Managers can decide reports fwr" ON public.flexible_working_requests;
CREATE POLICY "Managers can decide reports fwr"
  ON public.flexible_working_requests FOR UPDATE TO authenticated
  USING (manager_id = auth.uid());

-- ALL: HR admins have full access
DROP POLICY IF EXISTS "HR admins can manage all fwr" ON public.flexible_working_requests;
CREATE POLICY "HR admins can manage all fwr"
  ON public.flexible_working_requests FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 7. RLS POLICIES — fwr_appeals
-- ===========================================

-- SELECT: Request owner can view appeals on their own requests
DROP POLICY IF EXISTS "Users can view own fwr appeals" ON public.fwr_appeals;
CREATE POLICY "Users can view own fwr appeals"
  ON public.fwr_appeals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.flexible_working_requests r
      WHERE r.id = request_id AND r.profile_id = auth.uid()
    )
  );

-- SELECT: Managers can view appeals on their reports' requests
DROP POLICY IF EXISTS "Managers can view reports fwr appeals" ON public.fwr_appeals;
CREATE POLICY "Managers can view reports fwr appeals"
  ON public.fwr_appeals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.flexible_working_requests r
      WHERE r.id = request_id AND public.manages_user(r.profile_id)
    )
  );

-- INSERT: Request owner can appeal their own rejected request
DROP POLICY IF EXISTS "Users can appeal own rejected fwr" ON public.fwr_appeals;
CREATE POLICY "Users can appeal own rejected fwr"
  ON public.fwr_appeals FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flexible_working_requests r
      WHERE r.id = request_id
        AND r.profile_id = auth.uid()
        AND r.status = 'rejected'
    )
  );

-- ALL: HR admins have full access (they decide appeals)
DROP POLICY IF EXISTS "HR admins can manage all fwr appeals" ON public.fwr_appeals;
CREATE POLICY "HR admins can manage all fwr appeals"
  ON public.fwr_appeals FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 8. UPDATED_AT TRIGGERS
-- ===========================================
-- Reuses the existing update_updated_at_column() function from migration 00002.

DROP TRIGGER IF EXISTS update_fwr_updated_at ON public.flexible_working_requests;
CREATE TRIGGER update_fwr_updated_at
  BEFORE UPDATE ON public.flexible_working_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fwr_appeals_updated_at ON public.fwr_appeals;
CREATE TRIGGER update_fwr_appeals_updated_at
  BEFORE UPDATE ON public.fwr_appeals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 9. AUDIT TRIGGERS
-- ===========================================
-- Reuses the existing audit_trigger_func() from migration 00024.

DROP TRIGGER IF EXISTS audit_flexible_working_requests ON public.flexible_working_requests;
CREATE TRIGGER audit_flexible_working_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.flexible_working_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_fwr_appeals ON public.fwr_appeals;
CREATE TRIGGER audit_fwr_appeals
  AFTER INSERT OR UPDATE OR DELETE ON public.fwr_appeals
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
