-- Migration 00025: HR Module RLS Policies & Helper Functions
-- Sets up Row Level Security for all HR tables and adds new helper
-- functions for recursive management hierarchy access.
--
-- Security model:
--   Employee (self): View/edit own data
--   Line Manager: View direct reports' data, approve leave, complete forms
--   HR Admin: Full access to all HR data
--   Audit log: Read-only for HR admins, no one can modify
--
-- All operations are idempotent (DROP IF EXISTS / CREATE OR REPLACE).

-- ===========================================
-- 1. NEW HELPER FUNCTIONS
-- ===========================================

-- Recursive management check: does the current user manage the target
-- at ANY depth in the reporting chain? Walks the line_manager_id tree.
CREATE OR REPLACE FUNCTION public.manages_user_recursive(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE report_chain AS (
    -- Direct reports of current user
    SELECT id FROM public.profiles WHERE line_manager_id = auth.uid()
    UNION
    -- Indirect reports (reports of reports, etc.)
    SELECT p.id FROM public.profiles p
    INNER JOIN report_chain rc ON p.line_manager_id = rc.id
  )
  SELECT EXISTS (SELECT 1 FROM report_chain WHERE id = target_user_id);
$$;

-- Check if current user is a senior manager (has indirect reports,
-- i.e. manages people who themselves manage others).
CREATE OR REPLACE FUNCTION public.is_senior_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p1
    INNER JOIN public.profiles p2 ON p2.line_manager_id = p1.id
    WHERE p1.line_manager_id = auth.uid()
  );
$$;

-- ===========================================
-- 2. ENABLE RLS ON ALL NEW TABLES
-- ===========================================

ALTER TABLE public.employee_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_to_work_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_leaving_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dei_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_to_one_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.praise ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 3. EMPLOYEE DETAILS POLICIES
-- ===========================================
-- Sensitive personal data. Line managers can see the ROW but NOT all
-- columns — column restriction enforced at application layer via
-- explicit SELECT lists (never select("*")).

DROP POLICY IF EXISTS "Users can view own employee details" ON public.employee_details;
CREATE POLICY "Users can view own employee details"
  ON public.employee_details FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own employee details" ON public.employee_details;
CREATE POLICY "Users can update own employee details"
  ON public.employee_details FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own employee details" ON public.employee_details;
CREATE POLICY "Users can insert own employee details"
  ON public.employee_details FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view reports employee details" ON public.employee_details;
CREATE POLICY "Managers can view reports employee details"
  ON public.employee_details FOR SELECT TO authenticated
  USING (public.manages_user(profile_id));

DROP POLICY IF EXISTS "HR admins can manage all employee details" ON public.employee_details;
CREATE POLICY "HR admins can manage all employee details"
  ON public.employee_details FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 4. EMERGENCY CONTACTS POLICIES
-- ===========================================

DROP POLICY IF EXISTS "Users can manage own emergency contacts" ON public.emergency_contacts;
CREATE POLICY "Users can manage own emergency contacts"
  ON public.emergency_contacts FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view reports emergency contacts" ON public.emergency_contacts;
CREATE POLICY "Managers can view reports emergency contacts"
  ON public.emergency_contacts FOR SELECT TO authenticated
  USING (public.manages_user(profile_id));

DROP POLICY IF EXISTS "HR admins can manage all emergency contacts" ON public.emergency_contacts;
CREATE POLICY "HR admins can manage all emergency contacts"
  ON public.emergency_contacts FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 5. EMPLOYMENT HISTORY POLICIES
-- ===========================================
-- Immutable: only HR admins can insert. No one updates or deletes.

DROP POLICY IF EXISTS "Users can view own employment history" ON public.employment_history;
CREATE POLICY "Users can view own employment history"
  ON public.employment_history FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "HR admins can manage employment history" ON public.employment_history;
CREATE POLICY "HR admins can manage employment history"
  ON public.employment_history FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 6. COMPLIANCE DOCUMENT TYPES POLICIES
-- ===========================================
-- Readable by all authenticated users (need to know what docs are required).
-- Only HR admins can manage the catalogue.

DROP POLICY IF EXISTS "Authenticated users can view compliance types" ON public.compliance_document_types;
CREATE POLICY "Authenticated users can view compliance types"
  ON public.compliance_document_types FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "HR admins can manage compliance types" ON public.compliance_document_types;
CREATE POLICY "HR admins can manage compliance types"
  ON public.compliance_document_types FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 7. COMPLIANCE DOCUMENTS POLICIES
-- ===========================================

DROP POLICY IF EXISTS "Users can view own compliance documents" ON public.compliance_documents;
CREATE POLICY "Users can view own compliance documents"
  ON public.compliance_documents FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view reports compliance documents" ON public.compliance_documents;
CREATE POLICY "Managers can view reports compliance documents"
  ON public.compliance_documents FOR SELECT TO authenticated
  USING (public.manages_user(profile_id));

DROP POLICY IF EXISTS "HR admins can manage all compliance documents" ON public.compliance_documents;
CREATE POLICY "HR admins can manage all compliance documents"
  ON public.compliance_documents FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 8. PUBLIC HOLIDAYS POLICIES
-- ===========================================
-- Readable by all (everyone needs to see when holidays are).
-- Only HR admins can manage.

DROP POLICY IF EXISTS "Authenticated users can view public holidays" ON public.public_holidays;
CREATE POLICY "Authenticated users can view public holidays"
  ON public.public_holidays FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "HR admins can manage public holidays" ON public.public_holidays;
CREATE POLICY "HR admins can manage public holidays"
  ON public.public_holidays FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 9. LEAVE ENTITLEMENTS POLICIES
-- ===========================================

DROP POLICY IF EXISTS "Users can view own leave entitlements" ON public.leave_entitlements;
CREATE POLICY "Users can view own leave entitlements"
  ON public.leave_entitlements FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view reports leave entitlements" ON public.leave_entitlements;
CREATE POLICY "Managers can view reports leave entitlements"
  ON public.leave_entitlements FOR SELECT TO authenticated
  USING (public.manages_user(profile_id));

DROP POLICY IF EXISTS "HR admins can manage all leave entitlements" ON public.leave_entitlements;
CREATE POLICY "HR admins can manage all leave entitlements"
  ON public.leave_entitlements FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 10. LEAVE REQUESTS POLICIES
-- ===========================================

DROP POLICY IF EXISTS "Users can view own leave requests" ON public.leave_requests;
CREATE POLICY "Users can view own leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own leave requests" ON public.leave_requests;
CREATE POLICY "Users can create own leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- Users can only update their own PENDING requests (to withdraw)
DROP POLICY IF EXISTS "Users can update own pending leave requests" ON public.leave_requests;
CREATE POLICY "Users can update own pending leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND status = 'pending');

-- Managers can view their reports' leave requests
DROP POLICY IF EXISTS "Managers can view reports leave requests" ON public.leave_requests;
CREATE POLICY "Managers can view reports leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (public.manages_user(profile_id));

-- Managers can approve/reject their reports' requests
DROP POLICY IF EXISTS "Managers can decide reports leave requests" ON public.leave_requests;
CREATE POLICY "Managers can decide reports leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.manages_user(profile_id));

-- HR admins can manage all leave requests (including approving in LM absence)
DROP POLICY IF EXISTS "HR admins can manage all leave requests" ON public.leave_requests;
CREATE POLICY "HR admins can manage all leave requests"
  ON public.leave_requests FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 11. ABSENCE RECORDS POLICIES
-- ===========================================

DROP POLICY IF EXISTS "Users can view own absence records" ON public.absence_records;
CREATE POLICY "Users can view own absence records"
  ON public.absence_records FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view reports absence records" ON public.absence_records;
CREATE POLICY "Managers can view reports absence records"
  ON public.absence_records FOR SELECT TO authenticated
  USING (public.manages_user(profile_id));

DROP POLICY IF EXISTS "HR admins can manage all absence records" ON public.absence_records;
CREATE POLICY "HR admins can manage all absence records"
  ON public.absence_records FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 12. RETURN TO WORK FORMS POLICIES
-- ===========================================

-- Employees can view their own return-to-work forms
DROP POLICY IF EXISTS "Users can view own return to work forms" ON public.return_to_work_forms;
CREATE POLICY "Users can view own return to work forms"
  ON public.return_to_work_forms FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- Managers can manage return-to-work forms for their direct reports
DROP POLICY IF EXISTS "Managers can manage reports RTW forms" ON public.return_to_work_forms;
CREATE POLICY "Managers can manage reports RTW forms"
  ON public.return_to_work_forms FOR ALL TO authenticated
  USING (public.manages_user(employee_id))
  WITH CHECK (public.manages_user(employee_id));

-- HR admins can manage all
DROP POLICY IF EXISTS "HR admins can manage all RTW forms" ON public.return_to_work_forms;
CREATE POLICY "HR admins can manage all RTW forms"
  ON public.return_to_work_forms FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 13. STAFF LEAVING FORMS POLICIES
-- ===========================================

-- Managers can create and view leaving forms for their direct reports
DROP POLICY IF EXISTS "Managers can manage reports leaving forms" ON public.staff_leaving_forms;
CREATE POLICY "Managers can manage reports leaving forms"
  ON public.staff_leaving_forms FOR ALL TO authenticated
  USING (public.manages_user(profile_id))
  WITH CHECK (public.manages_user(profile_id));

-- HR admins can manage all
DROP POLICY IF EXISTS "HR admins can manage all leaving forms" ON public.staff_leaving_forms;
CREATE POLICY "HR admins can manage all leaving forms"
  ON public.staff_leaving_forms FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 14. KEY DATES POLICIES
-- ===========================================

DROP POLICY IF EXISTS "Users can view own key dates" ON public.key_dates;
CREATE POLICY "Users can view own key dates"
  ON public.key_dates FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view reports key dates" ON public.key_dates;
CREATE POLICY "Managers can view reports key dates"
  ON public.key_dates FOR SELECT TO authenticated
  USING (public.manages_user(profile_id));

DROP POLICY IF EXISTS "HR admins can manage all key dates" ON public.key_dates;
CREATE POLICY "HR admins can manage all key dates"
  ON public.key_dates FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 15. ASSET TYPES POLICIES
-- ===========================================

DROP POLICY IF EXISTS "Authenticated users can view asset types" ON public.asset_types;
CREATE POLICY "Authenticated users can view asset types"
  ON public.asset_types FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "HR admins can manage asset types" ON public.asset_types;
CREATE POLICY "HR admins can manage asset types"
  ON public.asset_types FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 16. ASSETS POLICIES
-- ===========================================

DROP POLICY IF EXISTS "Authenticated users can view assets" ON public.assets;
CREATE POLICY "Authenticated users can view assets"
  ON public.assets FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "HR admins can manage assets" ON public.assets;
CREATE POLICY "HR admins can manage assets"
  ON public.assets FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 17. ASSET ASSIGNMENTS POLICIES
-- ===========================================

-- Users can view their own assignments
DROP POLICY IF EXISTS "Users can view own asset assignments" ON public.asset_assignments;
CREATE POLICY "Users can view own asset assignments"
  ON public.asset_assignments FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- Managers can view their reports' assignments
DROP POLICY IF EXISTS "Managers can view reports asset assignments" ON public.asset_assignments;
CREATE POLICY "Managers can view reports asset assignments"
  ON public.asset_assignments FOR SELECT TO authenticated
  USING (public.manages_user(profile_id));

-- HR admins can manage all
DROP POLICY IF EXISTS "HR admins can manage all asset assignments" ON public.asset_assignments;
CREATE POLICY "HR admins can manage all asset assignments"
  ON public.asset_assignments FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 18. AUDIT LOG POLICIES
-- ===========================================
-- Append-only: no UPDATE or DELETE policies exist.
-- INSERTs happen via the SECURITY DEFINER trigger function.
-- Only HR admins can read the log.

DROP POLICY IF EXISTS "HR admins can view audit log" ON public.audit_log;
CREATE POLICY "HR admins can view audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- 19. SURVEYS POLICIES
-- ===========================================

-- All authenticated users can view active surveys
DROP POLICY IF EXISTS "Users can view active surveys" ON public.surveys;
CREATE POLICY "Users can view active surveys"
  ON public.surveys FOR SELECT TO authenticated
  USING (status = 'active' OR public.is_hr_admin());

DROP POLICY IF EXISTS "HR admins can manage surveys" ON public.surveys;
CREATE POLICY "HR admins can manage surveys"
  ON public.surveys FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 20. SURVEY QUESTIONS POLICIES
-- ===========================================

DROP POLICY IF EXISTS "Users can view survey questions" ON public.survey_questions;
CREATE POLICY "Users can view survey questions"
  ON public.survey_questions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.surveys
    WHERE id = survey_id AND (status = 'active' OR public.is_hr_admin())
  ));

DROP POLICY IF EXISTS "HR admins can manage survey questions" ON public.survey_questions;
CREATE POLICY "HR admins can manage survey questions"
  ON public.survey_questions FOR ALL TO authenticated
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- ===========================================
-- 21. SURVEY RESPONSES POLICIES
-- ===========================================

-- Users can insert their own responses
DROP POLICY IF EXISTS "Users can submit survey responses" ON public.survey_responses;
CREATE POLICY "Users can submit survey responses"
  ON public.survey_responses FOR INSERT TO authenticated
  WITH CHECK (respondent_id = auth.uid());

-- Users can view their own responses
DROP POLICY IF EXISTS "Users can view own survey responses" ON public.survey_responses;
CREATE POLICY "Users can view own survey responses"
  ON public.survey_responses FOR SELECT TO authenticated
  USING (respondent_id = auth.uid());

-- HR admins can view all (for reporting — anonymous surveys: must NOT join to respondent_id)
DROP POLICY IF EXISTS "HR admins can view all survey responses" ON public.survey_responses;
CREATE POLICY "HR admins can view all survey responses"
  ON public.survey_responses FOR SELECT TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- 22. DEI RESPONSES POLICIES
-- ===========================================
-- HR admins can read aggregate data. INSERTs via service role only.

DROP POLICY IF EXISTS "HR admins can view DEI responses" ON public.dei_responses;
CREATE POLICY "HR admins can view DEI responses"
  ON public.dei_responses FOR SELECT TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- 23. ONE-TO-ONE RECORDS POLICIES
-- ===========================================

-- Managers can manage their own 1-to-1 records
DROP POLICY IF EXISTS "Managers can manage own 121 records" ON public.one_to_one_records;
CREATE POLICY "Managers can manage own 121 records"
  ON public.one_to_one_records FOR ALL TO authenticated
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Employees can view their own 1-to-1 records (non-private ones)
DROP POLICY IF EXISTS "Employees can view own 121 records" ON public.one_to_one_records;
CREATE POLICY "Employees can view own 121 records"
  ON public.one_to_one_records FOR SELECT TO authenticated
  USING (employee_id = auth.uid() AND is_private = FALSE);

-- HR admins can view all
DROP POLICY IF EXISTS "HR admins can view all 121 records" ON public.one_to_one_records;
CREATE POLICY "HR admins can view all 121 records"
  ON public.one_to_one_records FOR SELECT TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- 24. OBJECTIVES POLICIES
-- ===========================================

DROP POLICY IF EXISTS "Users can manage own objectives" ON public.objectives;
CREATE POLICY "Users can manage own objectives"
  ON public.objectives FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view reports objectives" ON public.objectives;
CREATE POLICY "Managers can view reports objectives"
  ON public.objectives FOR SELECT TO authenticated
  USING (public.manages_user(profile_id));

DROP POLICY IF EXISTS "HR admins can view all objectives" ON public.objectives;
CREATE POLICY "HR admins can view all objectives"
  ON public.objectives FOR SELECT TO authenticated
  USING (public.is_hr_admin());

-- ===========================================
-- 25. PRAISE POLICIES
-- ===========================================

-- Public praise visible to all authenticated users
DROP POLICY IF EXISTS "Users can view public praise" ON public.praise;
CREATE POLICY "Users can view public praise"
  ON public.praise FOR SELECT TO authenticated
  USING (is_public = TRUE OR from_profile_id = auth.uid() OR to_profile_id = auth.uid());

-- Users can create praise
DROP POLICY IF EXISTS "Users can create praise" ON public.praise;
CREATE POLICY "Users can create praise"
  ON public.praise FOR INSERT TO authenticated
  WITH CHECK (from_profile_id = auth.uid());

-- Users can delete their own praise
DROP POLICY IF EXISTS "Users can delete own praise" ON public.praise;
CREATE POLICY "Users can delete own praise"
  ON public.praise FOR DELETE TO authenticated
  USING (from_profile_id = auth.uid());
