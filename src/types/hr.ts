/**
 * Composite TypeScript types for the HR module.
 *
 * These types combine data from multiple database tables into the shapes
 * that components and server actions actually work with. They supplement
 * the auto-generated types in database.types.ts.
 */

import type {
  LeaveType,
  ContractType,
  Department,
  Region,
  WorkPattern,
  SicknessCategory,
  ComplianceStatus,
  LeavingReason,
  EmploymentEventType,
} from "@/lib/hr";

// =============================================
// EMPLOYEE PROFILE (extended view for HR admin)
// =============================================

/** Core profile fields visible to all authenticated users. */
export interface ProfileSummary {
  id: string;
  full_name: string;
  preferred_name: string | null;
  email: string;
  avatar_url: string | null;
  job_title: string | null;
  user_type: "staff" | "pathways_coordinator" | "new_user";
  status: "active" | "inactive" | "pending_induction";
  fte: number;
  department: Department | null;
  region: Region | null;
  is_line_manager: boolean;
  is_hr_admin: boolean;
  is_ld_admin: boolean;
  is_external: boolean;
}

/** Full employee profile for HR admin views. */
export interface EmployeeProfile extends ProfileSummary {
  phone: string | null;
  start_date: string | null;
  contract_type: ContractType;
  contract_end_date: string | null;
  probation_end_date: string | null;
  work_pattern: WorkPattern;
  line_manager_id: string | null;
  team_id: string | null;
  induction_completed_at: string | null;
  last_sign_in_date: string | null;
  created_at: string;
}

/** Sensitive personal details (employee_details table). */
export interface EmployeeDetails {
  id: string;
  profile_id: string;
  date_of_birth: string | null;
  gender: "male" | "female" | "non_binary" | "prefer_not_to_say" | "other" | null;
  pronouns: string | null;
  nationality: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  personal_email: string | null;
  personal_phone: string | null;
  ni_number: string | null;
}

/**
 * Limited employee details visible to line managers.
 * Excludes: ni_number, date_of_birth, personal_email, personal_phone.
 */
export interface ManagerVisibleDetails {
  id: string;
  profile_id: string;
  gender: string | null;
  pronouns: string | null;
  nationality: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
}

// =============================================
// EMERGENCY CONTACTS
// =============================================

export interface EmergencyContact {
  id: string;
  profile_id: string;
  full_name: string;
  relationship: string;
  phone_primary: string;
  phone_secondary: string | null;
  email: string | null;
  sort_order: number;
}

// =============================================
// EMPLOYMENT HISTORY
// =============================================

export interface EmploymentHistoryEntry {
  id: string;
  profile_id: string;
  event_type: EmploymentEventType;
  effective_date: string;
  previous_value: string | null;
  new_value: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

// =============================================
// COMPLIANCE DOCUMENTS
// =============================================

export interface ComplianceDocumentType {
  id: string;
  name: string;
  description: string | null;
  default_validity_months: number | null;
  alert_days_before_expiry: number[];
  is_mandatory: boolean;
  applies_to: string[];
  is_active: boolean;
}

export interface ComplianceDocument {
  id: string;
  profile_id: string;
  document_type_id: string;
  reference_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: ComplianceStatus;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  uploaded_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
}

/** Compliance document joined with its type name for display. */
export interface ComplianceDocumentWithType extends ComplianceDocument {
  document_type_name: string;
}

/** Summary of an employee's compliance status across all document types. */
export interface ComplianceSummary {
  profile_id: string;
  total_required: number;
  total_valid: number;
  total_expiring_soon: number;
  total_expired: number;
  total_missing: number;
}

// =============================================
// LEAVE MANAGEMENT
// =============================================

export interface LeaveEntitlement {
  id: string;
  profile_id: string;
  leave_year_start: string;
  leave_year_end: string;
  leave_type: LeaveType;
  base_entitlement_days: number;
  fte_at_calculation: number;
  adjustments_days: number;
  notes: string | null;
}

export interface LeaveRequest {
  id: string;
  profile_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  start_half_day: boolean;
  end_half_day: boolean;
  total_days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled" | "withdrawn";
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
}

/** Leave request joined with the requester's profile for manager views. */
export interface LeaveRequestWithEmployee extends LeaveRequest {
  employee_name: string;
  employee_avatar: string | null;
  employee_job_title: string | null;
}

/** Calculated leave balance for a single leave type. */
export interface LeaveBalance {
  leave_type: LeaveType;
  entitlement: number;        // Total entitled days (base × FTE + adjustments)
  used: number;               // Days already taken (approved leave)
  pending: number;            // Days in pending requests
  remaining: number;          // entitlement - used
  available: number;          // entitlement - used - pending
}

// =============================================
// ABSENCE & SICKNESS
// =============================================

export type AbsenceType = "sick_self_certified" | "sick_fit_note" | "unauthorised" | "other";

export interface AbsenceRecord {
  id: string;
  profile_id: string;
  leave_request_id: string | null;
  absence_type: AbsenceType;
  start_date: string;
  end_date: string;
  total_days: number;
  is_long_term: boolean; // Generated column — never write to this
  reason: string | null;
  sickness_category: SicknessCategory | null;
  fit_note_path: string | null;
  fit_note_file_name: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Absence record with RTW form status and employee details for list views. */
export interface AbsenceRecordWithRTW extends AbsenceRecord {
  employee_name: string;
  employee_avatar: string | null;
  employee_job_title: string | null;
  rtw_status: RTWStatus | null; // null = no RTW form yet
  rtw_form_id: string | null;
}

// =============================================
// RETURN TO WORK FORMS
// =============================================

export type RTWStatus = "draft" | "submitted" | "confirmed" | "locked";

export interface ReturnToWorkForm {
  id: string;
  absence_record_id: string;
  employee_id: string;
  completed_by: string;
  completed_at: string;
  absence_start_date: string;
  absence_end_date: string;

  // Part 1 — Manager prep
  discussion_date: string | null;
  reason_for_absence: string | null;
  is_work_related: boolean;
  is_pregnancy_related: boolean;
  has_underlying_cause: boolean;
  wellbeing_discussion: string | null;
  medical_advice_details: string | null;

  // Trigger points (auto-calculated, manager can override)
  trigger_point_reached: boolean;
  trigger_point_details: string | null;

  // Procedures compliance
  procedures_followed: boolean;
  procedures_not_followed_reason: string | null;

  // Part 2 — Fitness discussion
  gp_clearance_received: boolean;
  adjustments_needed: string | null;
  phased_return_agreed: boolean;
  phased_return_details: string | null;
  follow_up_date: string | null;
  additional_notes: string | null;

  // Employee confirmation
  employee_comments: string | null;
  employee_confirmed: boolean;
  employee_confirmed_at: string | null;

  // Lifecycle
  status: RTWStatus;
  created_at: string;
  updated_at: string;
}

/** RTW form joined with employee details for dashboard views. */
export interface ReturnToWorkFormWithEmployee extends ReturnToWorkForm {
  employee_name: string;
  employee_avatar: string | null;
  completed_by_name: string | null;
}

/** Bradford Factor summary for an employee. */
export interface BradfordFactorSummary {
  profile_id: string;
  employee_name: string;
  absence_spells: number;
  total_days: number;
  bradford_score: number;
  severity: "low" | "medium" | "high" | "critical";
}

/** Wellbeing prompt derived from absence history (replaces raw Bradford scores). */
export interface AbsenceWellbeingPrompt {
  spells_12m: number;
  total_days_12m: number;
  prompt: string;
  severity: "low" | "medium" | "high";
}

// =============================================
// STAFF LEAVING
// =============================================

export interface StaffLeavingForm {
  id: string;
  profile_id: string;
  completed_by: string;
  completed_at: string;
  leaving_date: string;
  reason_for_leaving: LeavingReason;
  reason_details: string | null;
  notice_period_start: string | null;
  notice_period_end: string | null;
  exit_interview_completed: boolean;
  exit_interview_notes: string | null;
  knowledge_transfer_completed: boolean;
  knowledge_transfer_notes: string | null;
  equipment_returned: boolean;
  equipment_notes: string | null;
  access_revoked: boolean;
  access_revoked_date: string | null;
  final_leave_balance: number | null;
  rehire_eligible: boolean | null;
  additional_notes: string | null;
}

// =============================================
// KEY DATES
// =============================================

export interface KeyDate {
  id: string;
  profile_id: string;
  date_type: "probation_end" | "appraisal_due" | "contract_end" | "course_renewal" | "custom";
  due_date: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  alert_days_before: number[];
}

/** Key date joined with employee profile for dashboard views. */
export interface KeyDateWithEmployee extends KeyDate {
  employee_name: string;
  employee_avatar: string | null;
}

// =============================================
// ASSET MANAGEMENT
// =============================================

export interface AssetType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface Asset {
  id: string;
  asset_type_id: string;
  asset_tag: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  warranty_expiry_date: string | null;
  status: "available" | "assigned" | "in_repair" | "retired" | "lost";
  notes: string | null;
}

/** Asset joined with its type name for display. */
export interface AssetWithType extends Asset {
  asset_type_name: string;
}

export interface AssetAssignment {
  id: string;
  asset_id: string;
  profile_id: string;
  assigned_date: string;
  returned_date: string | null;
  assigned_by: string | null;
  condition_on_assignment: string | null;
  condition_on_return: string | null;
  notes: string | null;
}

/** Asset assignment joined with employee name for display. */
export interface AssetAssignmentWithDetails extends AssetAssignment {
  employee_name: string;
  asset_tag: string;
  asset_type_name: string;
  make: string | null;
  model: string | null;
}

// =============================================
// AUDIT LOG
// =============================================

export interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  changed_by: string | null;
  created_at: string;
}

/** Audit entry joined with the changer's name for display. */
export interface AuditEntryWithUser extends AuditEntry {
  changed_by_name: string | null;
}

// =============================================
// SURVEYS
// =============================================

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  survey_type: "pulse" | "engagement" | "dei" | "custom";
  status: "draft" | "active" | "closed";
  is_anonymous: boolean;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: "rating" | "text" | "single_choice" | "multi_choice";
  options: string[] | null;
  sort_order: number;
  is_required: boolean;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  respondent_id: string | null;
  answers: Record<string, unknown>;
  submitted_at: string;
}

// =============================================
// HR NOTIFICATION TYPES
// =============================================

/** All HR-specific notification types for the notification system. */
export type HRNotificationType =
  | "leave_requested"
  | "leave_approved"
  | "leave_rejected"
  | "compliance_expiry"
  | "probation_ending"
  | "contract_ending"
  | "appraisal_due"
  | "course_renewal_due"
  | "absence_recorded"
  | "return_to_work_due"
  | "rtw_confirmation_required"
  | "asset_warranty_expiry"
  | "team_clash_warning";
