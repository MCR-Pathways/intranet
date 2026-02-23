-- Migration 00024: HR Module Foundation
-- Creates all HR tables, extends profiles, and sets up audit infrastructure.
-- This is the foundation for the entire HR module — all tables are created
-- upfront (even for later phases) to prevent breaking schema changes.
--
-- Tables created:
--   Phase 1: employee_details, emergency_contacts, employment_history,
--            compliance_document_types, compliance_documents, asset_types,
--            assets, asset_assignments, key_dates, audit_log
--   Phase 2: public_holidays, leave_entitlements, leave_requests,
--            absence_records, return_to_work_forms, staff_leaving_forms
--   Phase 3: surveys, survey_questions, survey_responses, dei_responses,
--            one_to_one_records, objectives, praise
--
-- All operations are idempotent (IF NOT EXISTS / DO blocks).

-- ===========================================
-- 1. EXTEND PROFILES TABLE
-- ===========================================
-- Add employment-essential columns. Each uses a DO block for idempotent re-runs.

-- FTE (full-time equivalent, e.g. 0.4, 0.56, 0.6, 0.75, 0.8, 1.0)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN fte NUMERIC(3,2) DEFAULT 1.0
    CHECK (fte > 0 AND fte <= 1.0);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Contract type (permanent/fixed-term/casual/secondment)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN contract_type TEXT DEFAULT 'permanent'
    CHECK (contract_type IN ('permanent', 'fixed_term', 'casual', 'secondment'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Department (functional grouping — matches org chart structure)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN department TEXT
    CHECK (department IN (
      'executive', 'people', 'finance', 'delivery', 'development',
      'engagement', 'systems', 'fundraising', 'communications',
      'learning_development', 'hr'
    ));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Region (geographical — matches org chart regions)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN region TEXT
    CHECK (region IN ('west', 'east', 'north', 'england', 'central', 'national'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- External employee flag (e.g. Glasgow City Council employees)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN is_external BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Probation end date (typically start_date + 6 months)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN probation_end_date DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Contract end date (for fixed-term contracts)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN contract_end_date DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Work pattern (affects leave calculations)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN work_pattern TEXT DEFAULT 'standard'
    CHECK (work_pattern IN ('standard', 'part_time', 'compressed', 'term_time'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department);
CREATE INDEX IF NOT EXISTS idx_profiles_region ON public.profiles(region);
CREATE INDEX IF NOT EXISTS idx_profiles_contract_type ON public.profiles(contract_type);
CREATE INDEX IF NOT EXISTS idx_profiles_probation_end ON public.profiles(probation_end_date)
  WHERE probation_end_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_contract_end ON public.profiles(contract_end_date)
  WHERE contract_end_date IS NOT NULL;

-- ===========================================
-- 2. EMPLOYEE DETAILS (1:1 with profiles — sensitive personal data)
-- ===========================================
-- Separated from profiles because this data is sensitive (Special Category
-- under UK GDPR) and needs stricter access control. Line managers can see
-- the row but NOT all columns (enforced at application layer).

CREATE TABLE IF NOT EXISTS public.employee_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Personal information
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say', 'other')),
  pronouns TEXT,            -- free text: "he/him", "she/her", "they/them", etc.
  nationality TEXT,

  -- Address
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'United Kingdom',

  -- Private contact details (separate from work email/phone on profiles)
  personal_email TEXT,
  personal_phone TEXT,

  -- Sensitive identifiers
  ni_number TEXT,           -- National Insurance number

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_details_profile ON public.employee_details(profile_id);

-- ===========================================
-- 3. EMERGENCY CONTACTS (1:many, typically max 2 per employee)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone_primary TEXT NOT NULL,
  phone_secondary TEXT,
  email TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,  -- 0 = primary, 1 = secondary
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_profile ON public.emergency_contacts(profile_id);

-- ===========================================
-- 4. EMPLOYMENT HISTORY (immutable audit of changes within MCR)
-- ===========================================
-- Records every significant change to an employee's role/status.
-- Immutable — rows are only ever inserted, never updated or deleted.

CREATE TABLE IF NOT EXISTS public.employment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'hired', 'promotion', 'role_change', 'fte_change', 'department_change',
    'team_change', 'secondment_start', 'secondment_end', 'contract_change',
    'manager_change', 'region_change', 'left'
  )),
  effective_date DATE NOT NULL,
  previous_value TEXT,      -- What it was before (free text or JSON)
  new_value TEXT,           -- What it changed to
  notes TEXT,               -- Optional context
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employment_history_profile ON public.employment_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_employment_history_date ON public.employment_history(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_employment_history_type ON public.employment_history(event_type);

-- ===========================================
-- 5. COMPLIANCE DOCUMENT TYPES (configurable catalogue)
-- ===========================================
-- HR admin manages the types of documents that need tracking.
-- Each type has configurable renewal periods and alert windows.

CREATE TABLE IF NOT EXISTS public.compliance_document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                          -- e.g. 'PVG Disclosure', 'DBS Check'
  description TEXT,
  default_validity_months INTEGER,                    -- How long before re-check needed
  alert_days_before_expiry INTEGER[] DEFAULT '{90, 30, 7}',  -- When to send alerts
  is_mandatory BOOLEAN DEFAULT FALSE,                 -- Must every employee have this?
  applies_to TEXT[] DEFAULT '{staff, pathways_coordinator}',  -- Which user_types need this
  is_active BOOLEAN DEFAULT TRUE,                     -- Soft delete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 6. COMPLIANCE DOCUMENTS (per-employee documents)
-- ===========================================
-- Individual document records, linked to a type and optionally to a
-- file stored in Supabase Storage (bucket: hr-documents).

CREATE TABLE IF NOT EXISTS public.compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES public.compliance_document_types(id) ON DELETE RESTRICT,
  reference_number TEXT,                              -- e.g. PVG certificate number
  issue_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN (
    'valid', 'expiring_soon', 'expired', 'pending_renewal', 'not_applicable'
  )),

  -- File storage (Supabase Storage: hr-documents bucket)
  file_path TEXT,           -- Storage path: {profile_id}/{filename}
  file_name TEXT,
  file_size INTEGER,        -- Bytes
  mime_type TEXT,

  -- Tracking
  notes TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_docs_profile ON public.compliance_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_type ON public.compliance_documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_expiry ON public.compliance_documents(expiry_date)
  WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_docs_status ON public.compliance_documents(status)
  WHERE status IN ('expiring_soon', 'expired', 'pending_renewal');

-- ===========================================
-- 7. PUBLIC HOLIDAYS (Scotland + England calendars)
-- ===========================================
-- MCR operates in both Scotland and England, which have different
-- public holiday calendars. An employee's region determines which
-- holidays apply to their leave calculations.

CREATE TABLE IF NOT EXISTS public.public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('scotland', 'england', 'all')),
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(holiday_date, region)
);

CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public.public_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_year_region ON public.public_holidays(year, region);

-- ===========================================
-- 8. LEAVE ENTITLEMENTS (per employee, per leave year)
-- ===========================================
-- Leave year runs January–December. Entitlements are set per employee
-- per year. Remaining balance is CALCULATED (not stored) as:
--   entitlement - SUM(approved leave days for that type and year)
-- This prevents drift and is self-correcting.

CREATE TABLE IF NOT EXISTS public.leave_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_year_start DATE NOT NULL,                     -- e.g. 2026-01-01
  leave_year_end DATE NOT NULL,                       -- e.g. 2026-12-31
  leave_type TEXT NOT NULL CHECK (leave_type IN (
    'annual', 'sick', 'maternity', 'paternity', 'shared_parental',
    'adoption', 'compassionate', 'jury_service', 'toil', 'unpaid', 'study'
  )),
  base_entitlement_days NUMERIC(5,2) NOT NULL,        -- Before FTE adjustment
  fte_at_calculation NUMERIC(3,2) NOT NULL,           -- FTE when entitlement was set
  adjustments_days NUMERIC(5,2) DEFAULT 0,            -- Manual adjustments (carry-over, bought, etc.)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, leave_year_start, leave_type)
);

CREATE INDEX IF NOT EXISTS idx_leave_entitlements_profile ON public.leave_entitlements(profile_id);
CREATE INDEX IF NOT EXISTS idx_leave_entitlements_year ON public.leave_entitlements(leave_year_start);

-- ===========================================
-- 9. LEAVE REQUESTS
-- ===========================================
-- Employees submit requests; line managers (or HR in their absence) approve/reject.
-- Total days are calculated at submission time, accounting for FTE and public holidays.

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN (
    'annual', 'sick', 'maternity', 'paternity', 'shared_parental',
    'adoption', 'compassionate', 'jury_service', 'toil', 'unpaid', 'study'
  )),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_half_day BOOLEAN DEFAULT FALSE,               -- Starts at afternoon only
  end_half_day BOOLEAN DEFAULT FALSE,                 -- Ends at morning only
  total_days NUMERIC(5,2) NOT NULL,                   -- Calculated, accounting for half-days + FTE
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'cancelled', 'withdrawn'
  )),

  -- Decision tracking
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_notes TEXT,
  rejection_reason TEXT,                              -- Mandatory when status = 'rejected'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_profile ON public.leave_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status)
  WHERE status IN ('pending', 'approved');
CREATE INDEX IF NOT EXISTS idx_leave_requests_decided_by ON public.leave_requests(decided_by);

-- ===========================================
-- 10. ABSENCE RECORDS (sickness tracking, Bradford Factor)
-- ===========================================
-- Separate from leave_requests because absences may be unplanned and
-- need additional medical tracking (fit notes, categories, return-to-work).

CREATE TABLE IF NOT EXISTS public.absence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL,
  absence_type TEXT NOT NULL CHECK (absence_type IN (
    'sick_self_certified', 'sick_fit_note', 'unauthorised', 'other'
  )),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(5,2) NOT NULL,
  reason TEXT,
  sickness_category TEXT CHECK (sickness_category IN (
    'cold_flu', 'stomach', 'headache_migraine', 'musculoskeletal',
    'mental_health', 'injury', 'surgery', 'dental',
    'pregnancy_related', 'chronic_condition', 'covid', 'other'
  )),

  -- Fit note (Supabase Storage: hr-documents bucket)
  fit_note_path TEXT,
  fit_note_file_name TEXT,

  -- Tracking
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_absence_records_profile ON public.absence_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_absence_records_dates ON public.absence_records(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_absence_records_category ON public.absence_records(sickness_category)
  WHERE sickness_category IS NOT NULL;

-- ===========================================
-- 11. RETURN TO WORK FORMS (integrated — not uploaded documents)
-- ===========================================
-- Completed by line managers (or HR in their absence) when an employee
-- returns from sickness absence. Structured data, not a PDF upload,
-- so it's queryable and reportable.

CREATE TABLE IF NOT EXISTS public.return_to_work_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_record_id UUID NOT NULL UNIQUE REFERENCES public.absence_records(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Absence summary (denormalised for easy querying)
  absence_start_date DATE NOT NULL,
  absence_end_date DATE NOT NULL,

  -- Form fields
  reason_for_absence TEXT NOT NULL,
  is_work_related BOOLEAN DEFAULT FALSE,
  gp_clearance_received BOOLEAN DEFAULT FALSE,
  adjustments_needed TEXT,                            -- Any workplace adjustments required
  phased_return_agreed BOOLEAN DEFAULT FALSE,
  phased_return_details TEXT,
  follow_up_date DATE,                                -- When to check in again
  additional_notes TEXT,
  employee_comments TEXT,                             -- Employee's own notes/comments

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rtw_forms_employee ON public.return_to_work_forms(employee_id);
CREATE INDEX IF NOT EXISTS idx_rtw_forms_absence ON public.return_to_work_forms(absence_record_id);
CREATE INDEX IF NOT EXISTS idx_rtw_forms_follow_up ON public.return_to_work_forms(follow_up_date)
  WHERE follow_up_date IS NOT NULL;

-- ===========================================
-- 12. STAFF LEAVING FORMS (completed by line managers)
-- ===========================================
-- Structured offboarding form. Completed when an employee leaves MCR.
-- Cross-references with asset assignments for equipment return tracking.

CREATE TABLE IF NOT EXISTS public.staff_leaving_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  leaving_date DATE NOT NULL,

  -- Reason
  reason_for_leaving TEXT NOT NULL CHECK (reason_for_leaving IN (
    'resignation', 'redundancy', 'end_of_contract', 'retirement',
    'dismissal', 'mutual_agreement', 'other'
  )),
  reason_details TEXT,

  -- Notice period
  notice_period_start DATE,
  notice_period_end DATE,

  -- Exit interview
  exit_interview_completed BOOLEAN DEFAULT FALSE,
  exit_interview_notes TEXT,

  -- Knowledge transfer
  knowledge_transfer_completed BOOLEAN DEFAULT FALSE,
  knowledge_transfer_notes TEXT,

  -- Equipment and access (cross-references asset_assignments)
  equipment_returned BOOLEAN DEFAULT FALSE,
  equipment_notes TEXT,
  access_revoked BOOLEAN DEFAULT FALSE,               -- Google account, building access, etc.
  access_revoked_date DATE,

  -- Leave
  final_leave_balance NUMERIC(5,2),                   -- Calculated at time of leaving

  -- Future reference
  rehire_eligible BOOLEAN,
  additional_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_leaving_profile ON public.staff_leaving_forms(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_leaving_date ON public.staff_leaving_forms(leaving_date);
CREATE INDEX IF NOT EXISTS idx_staff_leaving_reason ON public.staff_leaving_forms(reason_for_leaving);

-- ===========================================
-- 13. KEY DATES (alerts for important milestones)
-- ===========================================
-- Probation end, appraisal due, contract end, course renewals, etc.
-- Each has configurable alert windows.

CREATE TABLE IF NOT EXISTS public.key_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_type TEXT NOT NULL CHECK (date_type IN (
    'probation_end', 'appraisal_due', 'contract_end',
    'course_renewal', 'custom'
  )),
  due_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  alert_days_before INTEGER[] DEFAULT '{30, 7}',      -- When to send notifications
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_key_dates_profile ON public.key_dates(profile_id);
CREATE INDEX IF NOT EXISTS idx_key_dates_due ON public.key_dates(due_date)
  WHERE is_completed = FALSE;
CREATE INDEX IF NOT EXISTS idx_key_dates_type ON public.key_dates(date_type);

-- ===========================================
-- 14. ASSET TYPES (configurable catalogue)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.asset_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                          -- e.g. 'Laptop', 'Monitor', 'Phone', 'Headset'
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 15. ASSETS (individual tracked items)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type_id UUID NOT NULL REFERENCES public.asset_types(id) ON DELETE RESTRICT,
  asset_tag TEXT NOT NULL UNIQUE,                     -- e.g. "MCR-LAP-042"
  make TEXT,                                          -- e.g. "Apple", "Dell", "Lenovo"
  model TEXT,                                         -- e.g. "MacBook Pro 14"
  serial_number TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC(10,2),                        -- In GBP
  warranty_expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
    'available', 'assigned', 'in_repair', 'retired', 'lost'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON public.assets(asset_type_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_warranty ON public.assets(warranty_expiry_date)
  WHERE warranty_expiry_date IS NOT NULL;

-- ===========================================
-- 16. ASSET ASSIGNMENTS (who has what, with full history)
-- ===========================================
-- Current assignment: WHERE returned_date IS NULL
-- Historical assignments show the full lifecycle of each asset.

CREATE TABLE IF NOT EXISTS public.asset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  returned_date DATE,                                 -- NULL while currently assigned
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  condition_on_assignment TEXT,                        -- e.g. "New", "Good", "Fair"
  condition_on_return TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset ON public.asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_profile ON public.asset_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_current ON public.asset_assignments(asset_id)
  WHERE returned_date IS NULL;

-- ===========================================
-- 17. AUDIT LOG (generic, trigger-populated, append-only)
-- ===========================================
-- Every change to sensitive HR data is logged automatically via
-- database triggers. No one can UPDATE or DELETE audit records.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],    -- Which columns changed (for UPDATE only)
  changed_by UUID,          -- Set via current_setting('app.current_user_id')
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public.audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
-- Partial index for recent entries (most queries look at recent data)
CREATE INDEX IF NOT EXISTS idx_audit_log_recent ON public.audit_log(created_at DESC)
  WHERE created_at > (NOW() - INTERVAL '90 days');

-- ===========================================
-- 18. SURVEYS (Phase 3 — pulse, engagement, DEI, custom)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  survey_type TEXT NOT NULL CHECK (survey_type IN ('pulse', 'engagement', 'dei', 'custom')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  is_anonymous BOOLEAN DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_status ON public.surveys(status);

-- ===========================================
-- 19. SURVEY QUESTIONS
-- ===========================================

CREATE TABLE IF NOT EXISTS public.survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('rating', 'text', 'single_choice', 'multi_choice')),
  options JSONB,            -- For choice questions: ["Option A", "Option B", ...]
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON public.survey_questions(survey_id);

-- ===========================================
-- 20. SURVEY RESPONSES
-- ===========================================
-- For anonymous surveys, respondent_id is used ONLY to track who has/hasn't
-- responded. It is NEVER joined to answers in queries or reports.

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  respondent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  answers JSONB NOT NULL,   -- {question_id: answer_value}
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON public.survey_responses(survey_id);
-- Unique: one response per person per survey
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_responses_unique
  ON public.survey_responses(survey_id, respondent_id)
  WHERE respondent_id IS NOT NULL;

-- ===========================================
-- 21. DEI RESPONSES (anonymous equality monitoring)
-- ===========================================
-- Intentionally has NO profile FK — responses are anonymous.
-- Used for aggregate reporting only.

CREATE TABLE IF NOT EXISTS public.dei_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_period TEXT NOT NULL,                        -- e.g. '2026-Q1'
  ethnicity TEXT,
  disability BOOLEAN,
  sexual_orientation TEXT,
  religion TEXT,
  age_band TEXT CHECK (age_band IN (
    'under_25', '25_34', '35_44', '45_54', '55_64', '65_plus'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dei_responses_period ON public.dei_responses(survey_period);

-- ===========================================
-- 22. ONE-TO-ONE RECORDS (Phase 3 — performance management)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.one_to_one_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  notes TEXT,
  action_items JSONB,       -- [{description, due_date, completed}]
  is_private BOOLEAN DEFAULT FALSE,  -- Manager-only private notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_121_records_manager ON public.one_to_one_records(manager_id);
CREATE INDEX IF NOT EXISTS idx_121_records_employee ON public.one_to_one_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_121_records_date ON public.one_to_one_records(meeting_date DESC);

-- ===========================================
-- 23. OBJECTIVES (Phase 3 — performance management)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('personal', 'team', 'organisational')),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'in_progress', 'completed', 'deferred'
  )),
  target_date DATE,
  completed_at TIMESTAMPTZ,
  review_period_start DATE,
  review_period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objectives_profile ON public.objectives(profile_id);
CREATE INDEX IF NOT EXISTS idx_objectives_status ON public.objectives(status);

-- ===========================================
-- 24. PRAISE / SHOUT-OUTS (Phase 3)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.praise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  value TEXT CHECK (value IN (
    'teamwork', 'innovation', 'impact', 'leadership', 'dedication', 'kindness'
  )),
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_praise_to ON public.praise(to_profile_id);
CREATE INDEX IF NOT EXISTS idx_praise_from ON public.praise(from_profile_id);

-- ===========================================
-- 25. AUDIT TRIGGER FUNCTION
-- ===========================================
-- Automatically logs changes to sensitive HR tables.
-- Reads the acting user from current_setting('app.current_user_id'),
-- falling back to auth.uid() for direct API calls.

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed_by UUID;
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields TEXT[];
  v_key TEXT;
BEGIN
  -- Try to get the current user from the app setting (set by server actions)
  BEGIN
    v_changed_by := current_setting('app.current_user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    -- Fall back to the authenticated Supabase user
    v_changed_by := auth.uid();
  END;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), v_changed_by);
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), v_changed_by);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_changed_fields := ARRAY[]::TEXT[];

    -- Identify which fields actually changed (ignoring updated_at)
    FOR v_key IN SELECT jsonb_object_keys(v_new_data) LOOP
      IF v_key NOT IN ('updated_at') AND
         (v_old_data->v_key IS DISTINCT FROM v_new_data->v_key) THEN
        v_changed_fields := v_changed_fields || v_key;
      END IF;
    END LOOP;

    -- Only log if something meaningful changed
    IF array_length(v_changed_fields, 1) > 0 THEN
      INSERT INTO public.audit_log (
        table_name, record_id, action, old_data, new_data, changed_fields, changed_by
      )
      VALUES (
        TG_TABLE_NAME, NEW.id, 'UPDATE', v_old_data, v_new_data, v_changed_fields, v_changed_by
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- ===========================================
-- 26. APPLY AUDIT TRIGGERS TO SENSITIVE TABLES
-- ===========================================

-- Profiles (already has updated_at trigger; audit trigger is additional)
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_employee_details ON public.employee_details;
CREATE TRIGGER audit_employee_details
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_details
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_leave_requests ON public.leave_requests;
CREATE TRIGGER audit_leave_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_compliance_documents ON public.compliance_documents;
CREATE TRIGGER audit_compliance_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.compliance_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_absence_records ON public.absence_records;
CREATE TRIGGER audit_absence_records
  AFTER INSERT OR UPDATE OR DELETE ON public.absence_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_employment_history ON public.employment_history;
CREATE TRIGGER audit_employment_history
  AFTER INSERT OR UPDATE OR DELETE ON public.employment_history
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_assets ON public.assets;
CREATE TRIGGER audit_assets
  AFTER INSERT OR UPDATE OR DELETE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_asset_assignments ON public.asset_assignments;
CREATE TRIGGER audit_asset_assignments
  AFTER INSERT OR UPDATE OR DELETE ON public.asset_assignments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_staff_leaving_forms ON public.staff_leaving_forms;
CREATE TRIGGER audit_staff_leaving_forms
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_leaving_forms
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ===========================================
-- 27. UPDATED_AT TRIGGERS FOR NEW TABLES
-- ===========================================
-- Reuses the existing update_updated_at_column() function from migration 00002.

DROP TRIGGER IF EXISTS update_employee_details_updated_at ON public.employee_details;
CREATE TRIGGER update_employee_details_updated_at
  BEFORE UPDATE ON public.employee_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_emergency_contacts_updated_at ON public.emergency_contacts;
CREATE TRIGGER update_emergency_contacts_updated_at
  BEFORE UPDATE ON public.emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_compliance_document_types_updated_at ON public.compliance_document_types;
CREATE TRIGGER update_compliance_document_types_updated_at
  BEFORE UPDATE ON public.compliance_document_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_compliance_documents_updated_at ON public.compliance_documents;
CREATE TRIGGER update_compliance_documents_updated_at
  BEFORE UPDATE ON public.compliance_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leave_entitlements_updated_at ON public.leave_entitlements;
CREATE TRIGGER update_leave_entitlements_updated_at
  BEFORE UPDATE ON public.leave_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_absence_records_updated_at ON public.absence_records;
CREATE TRIGGER update_absence_records_updated_at
  BEFORE UPDATE ON public.absence_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_return_to_work_forms_updated_at ON public.return_to_work_forms;
CREATE TRIGGER update_return_to_work_forms_updated_at
  BEFORE UPDATE ON public.return_to_work_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_leaving_forms_updated_at ON public.staff_leaving_forms;
CREATE TRIGGER update_staff_leaving_forms_updated_at
  BEFORE UPDATE ON public.staff_leaving_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_key_dates_updated_at ON public.key_dates;
CREATE TRIGGER update_key_dates_updated_at
  BEFORE UPDATE ON public.key_dates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_asset_types_updated_at ON public.asset_types;
CREATE TRIGGER update_asset_types_updated_at
  BEFORE UPDATE ON public.asset_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assets_updated_at ON public.assets;
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_asset_assignments_updated_at ON public.asset_assignments;
CREATE TRIGGER update_asset_assignments_updated_at
  BEFORE UPDATE ON public.asset_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_surveys_updated_at ON public.surveys;
CREATE TRIGGER update_surveys_updated_at
  BEFORE UPDATE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_one_to_one_records_updated_at ON public.one_to_one_records;
CREATE TRIGGER update_one_to_one_records_updated_at
  BEFORE UPDATE ON public.one_to_one_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_objectives_updated_at ON public.objectives;
CREATE TRIGGER update_objectives_updated_at
  BEFORE UPDATE ON public.objectives
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
