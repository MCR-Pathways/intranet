# HR Module — Development Roadmap

> **Living document** — updated as features are completed and priorities shift.
> Last updated: 2026-02-24

---

## Phase 1 — COMPLETE

All features fully built with RLS policies, audit logging, and input sanitisation.

### User Management
- **Routes:** `/hr/users` (table), `/hr/users/[userId]` (detail with 7+ tabs)
- **Components:** `src/components/hr/user-table.tsx`, `src/components/hr/user-edit-dialog.tsx`, `src/components/hr/employee-detail-content.tsx`
- **Actions:** `src/app/(protected)/hr/users/actions.ts`
- **Capabilities:** View/edit all staff profiles, manage roles (`is_hr_admin`, `is_ld_admin`, `is_line_manager`), complete/reset induction, edit employment details

### My Profile
- **Route:** `/hr/profile`
- **Components:** `src/components/hr/profile-page-content.tsx` (4 tabs: Overview, Personal Details, Documents, Employment History)
- **Actions:** `src/app/(protected)/hr/profile/actions.ts`
- **Capabilities:** View own profile, edit personal details (pronouns, address, contact), manage emergency contacts (max 2), view employment history (immutable)

### Leave Management
- **Routes:** `/hr/leave` (dashboard with tabs), `/hr/calendar` (team calendar)
- **Components:** `src/components/hr/leave-dashboard-content.tsx`, `src/components/hr/leave-calendar.tsx`, `src/components/hr/leave-balance-cards.tsx`, `src/components/hr/leave-request-dialog.tsx`, `src/components/hr/record-leave-dialog.tsx`
- **Actions:** `src/app/(protected)/hr/leave/actions.ts`
- **Capabilities:**
  - Employee self-service: request annual, compassionate, TOIL, unpaid, study leave
  - HR-only recording: sick, maternity, paternity, shared parental, adoption, jury service
  - Manager approvals, employee withdrawals, HR cancellations
  - FTE-adjusted working day calculations (excludes weekends + public holidays)
  - Half-day support, pro-rata for mid-year starters/leavers
  - Leave year: calendar year (Jan 1 – Dec 31)
  - Scotland + England public holiday calendars

### Assets
- **Route:** `/hr/assets`
- **Components:** `src/components/hr/asset-page-content.tsx`, `src/components/hr/asset-dialog.tsx`, `src/components/hr/asset-assign-dialog.tsx`, `src/components/hr/asset-return-dialog.tsx`
- **Actions:** `src/app/(protected)/hr/assets/actions.ts`
- **Capabilities:** Full asset lifecycle — create, assign, return, retire. Configurable asset types. Condition tracking. Employee self-service view of assigned assets.

### Compliance Documents
- **Route:** `/hr/compliance` (HR admin only)
- **Components:** `src/components/hr/compliance-dashboard.tsx`, `src/components/hr/compliance-upload-dialog.tsx`, `src/components/hr/compliance-edit-dialog.tsx`, `src/components/hr/compliance-status-grid.tsx`
- **Actions:** `src/app/(protected)/hr/compliance/actions.ts`
- **Capabilities:** Configurable document types (PVG, DBS, NSPCC, First Aid, etc.) with mandatory flags and alert windows. Upload to `hr-documents` storage bucket (max 10MB, PDF/JPEG/PNG/DOCX). Verify, download (signed URLs), auto-status calculation (valid/expiring_soon/expired/pending_renewal). Employee × document status grid.

### Key Dates
- **Route:** `/hr/key-dates` (HR admin only)
- **Components:** `src/components/hr/key-dates-dashboard.tsx`, `src/components/hr/key-date-dialog.tsx`
- **Actions:** `src/app/(protected)/hr/key-dates/actions.ts`
- **Capabilities:** Track probation ends, appraisals, contract renewals, course renewals. Configurable alert windows. Mark as completed.

### Shared Config
- **File:** `src/lib/hr.ts` — single source of truth for leave types, contract types, departments, regions, work patterns, employment events, compliance statuses, sickness categories, leaving reasons, gender options, and utility functions (`calculateWorkingDays`, `calculateBradfordFactor`, `calculateProRataEntitlement`, etc.)

### Database
- **Migration:** `supabase/migrations/00024_create_hr_foundation.sql` (all tables for Phases 1–3)
- **RLS:** `supabase/migrations/00025_create_hr_rls_policies.sql` (self-service, line manager recursive, HR admin tiers)
- **Seeds:** `00026_seed_compliance_types.sql`, `00029_seed_asset_types.sql`
- **Storage:** `00028_create_hr_documents_bucket.sql`

---

## Phase 1 Polish — COMPLETE

Quick wins inspired by nexus-hr analysis (Feb 2026).

### HR Dashboard Landing Page ✅ DONE
- **Route:** `/hr` index page
- **What:** Time-based greeting + 4 HR admin stat cards (server-side data, clickable):
  - Staff on leave today → links to `/hr/calendar`
  - Stale leave requests (pending 3+ days) → links to `/hr/leave`
  - Compliance attention (expiring + expired) → links to `/hr/compliance`
  - Key dates overdue → links to `/hr/key-dates`
- Stat cards only shown to HR admins; regular users see the quick actions grid as before
- Colours: green (all clear), amber (warning), red (expired/overdue) — matching compliance dashboard palette

### Leave Team Capacity Notification ✅ DONE
- **Where:** Approval view (`LeaveRequestTable` in Approvals tab)
- **What:** Blue info notice per row when teammates have approved leave overlapping the request dates
- **Implementation:** Server fetches `teamMemberMap` (2 indexed queries), client-side `getTeamOverlap()` from already-loaded `allRequests`. Zero additional queries at render time.
- **Format:** "[Name(s)] is/are also on leave during this period. Team: X/Y available."

### Bradford Factor — DECISION: Wellbeing Prompts Instead
- **Decision (Feb 2026):** Do not surface the raw Bradford score. Research showed it's blind to cause (disability discrimination risk under Equality Act 2010), drives presenteeism, and the BMA has condemned it.
- **Alternative:** Wellbeing prompts based on absence pattern data (spells count, total days, trends). Prompts like "This employee has had X separate absences in the last 6 months. Consider a wellbeing check-in." HR admins only.
- **When:** Part of Phase 2 Absence Records & Sickness Tracking (needs `absence_records` data to drive prompts).
- **Code note:** `calculateBradfordFactor()` in `src/lib/hr.ts` kept as internal utility — not surfaced in UI.

---

## Phase 2 — IN PROGRESS

Database tables created in migration `00024`, extended in `00030`.

### Absence Records & Sickness Tracking ✅ DONE
- **Route:** `/hr/absence` (HR admin dashboard with All Absences + Pending RTW tabs)
- **Components:** `src/components/hr/record-absence-dialog.tsx`, `src/components/hr/profile-absence-tab.tsx`, `src/components/hr/absence-dashboard-content.tsx`
- **Actions:** `src/app/(protected)/hr/absence/actions.ts`
- **Capabilities:**
  - HR admin records absences with type (sick self-certified, sick fit note, unauthorised, other)
  - Auto-calculates working days (FTE-aware, excludes weekends + public holidays)
  - Sickness category selection (12 categories from MCR policy)
  - Fit note upload to `hr-documents/fit-notes/` storage bucket
  - Generated `is_long_term` column (28+ calendar days, MCR policy)
  - Wellbeing prompt cards for HR admins (replaces raw Bradford Factor)
  - Absence tab on employee detail view with history table, RTW status badges, delete with confirmation

### Return-to-Work Forms ✅ DONE
- **Route:** `/hr/absence/rtw/[formId]` (employee confirmation page)
- **Components:** `src/components/hr/return-to-work-form.tsx` (Sheet — side drawer with 7 sections)
- **Lifecycle:** Draft → Submitted → Locked
  - Manager creates draft (auto-fills dates, auto-calculates trigger point from 12-month history)
  - Manager fills in sections: Wellbeing Discussion, Return Assessment, Trigger Points, Procedures, Notes
  - Manager submits → notification sent to employee
  - Employee reviews, adds comments, clicks "I Confirm This Is Accurate" → form locks
  - HR admin can unlock for corrections
- **Trigger point auto-calculation:** 4 spells OR 8+ working days in rolling 12 months (MCR Absence Management Policy, April 2025). Manager can override.
- **Migration:** `supabase/migrations/00030_extend_rtw_and_absence.sql` — 12 new columns on `return_to_work_forms`, generated `is_long_term` column, notification INSERT policy
- **Dashboard integration:** Pending RTW Forms stat card on `/hr`, sidebar nav link to `/hr/absence`

### Staff Leaving Forms (Offboarding) ✅ DONE
- **Routes:** `/hr/leaving` (dashboard with Active/Completed/All tabs), `/hr/leaving/[formId]` (full form page)
- **Components:** `src/components/hr/leaving-dashboard-content.tsx`, `src/components/hr/leaving-form-content.tsx`, `src/components/hr/create-leaving-form-dialog.tsx`, `src/components/hr/profile-leaving-tab.tsx`
- **Actions:** `src/app/(protected)/hr/leaving/actions.ts`
- **Migration:** `supabase/migrations/00032_extend_staff_leaving_forms.sql` (extends existing table with `status`, `initiated_by`, `last_working_date`; partial unique index for one active form per person)
- **Capabilities:**
  - Manager or HR admin initiates a leaving form from the dashboard (employee picker dialog)
  - Multi-step workflow: Draft → Submitted → In Progress → Completed (+ Cancelled)
  - Auto-calculated data: outstanding assets, active compliance docs, final leave balance
  - Offboarding checklist: exit interview, knowledge transfer, equipment return, access revocation
  - Completion triggers: profile deactivated, "Left Organisation" employment history event, initiator notified
  - Cancelled forms free the partial unique constraint, allowing a new form for the same person
  - Employee detail "Leaving" tab shows lightweight summary card with link to full form
  - Dashboard stat card ("Active Leavers") on HR homepage, sidebar nav link
- **Replaces:** External web form at mcrpathways.org/staff-leaver

### Onboarding Progress Tracker (Nexus-inspired)
- **Table:** New — `onboarding_checklists` or similar
- **What:** Configurable checklist for new starters (Right to Work, Contract Signed, IT Equipment Assigned, DBS/PVG Submitted, Bank Details Received, etc.)
- **UI needed:** Progress bar per new starter, checklist view, dashboard widget showing new starters in pipeline
- **Ties into:** Existing compliance documents (auto-check PVG/DBS), asset assignments (auto-check equipment)
- **Mirrors:** `staff_leaving_forms` for offboarding

### Flexible Working Requests
- **Route:** `/hr/flexible-working`
- **Table:** `flexible_working_requests` — new table needed
- **Columns (from MCR paper form):** `profile_id`, `previous_request_date` (max 1 request per 12 months per s.80F ERA 1996), `current_working_pattern` (text — days/hours/times/location), `requested_working_pattern` (text — days/hours/times/location), `requested_start_date`, `trial_period` (3 or 6 months), `trial_end_date`, `status` (pending_manager/pending_hr/approved/rejected/trial_ended), `manager_id`, `manager_decision_at`, `manager_notes`, `hr_received_at`, `hr_notes`, `outcome_recorded_by`, `created_at`, `updated_at`
- **Workflow:** Employee fills form → line manager approves/rejects → if approved, shared with HR → trial period (3 or 6 months) starts → automatic reminder notifications before trial end date
- **UI needed:** Request form (employee), approval view (manager), HR overview dashboard, trial period reminder system
- **Ties into:** Existing `WORK_PATTERN_CONFIG` in `src/lib/hr.ts` (standard, part_time, compressed, term_time already defined), notification system for reminders
- **Source:** HR team confirmed employees currently use a paper form, want digital workflow with automated reminders
- **Note on compressed hours:** Already supported in `work_pattern` column on `profiles` (CHECK constraint includes `'compressed'`) and `WORK_PATTERN_CONFIG` in `src/lib/hr.ts` (`daysPerWeek: 4`). Leave calculations handle this via FTE. Staff do work compressed hours (e.g. 4-day week). No term-time only currently.

### Org Chart
- **Route:** `/hr/org-chart` (placeholder exists)
- **What:** Visual reporting hierarchy using `manager_id` relationships from `profiles`
- **Dependencies:** Needs `manages_user_recursive()` function (already exists in RLS)

### My Team
- **Route:** `/hr/team` (placeholder exists)
- **What:** Team directory and management tools for line managers
- **Dependencies:** Manager relationships, leave data, compliance status

---

## Phase 3 — FUTURE

Database tables already created in migration `00024`. Larger features for later.

### Surveys & Pulse Checks
- **Tables:** `surveys`, `survey_questions`, `survey_responses`
- **Capabilities:** Pulse surveys, engagement surveys, custom surveys. Question types: rating, text, single/multi-choice. Anonymous option (respondent tracked for completion only, never joined to answers).

### DEI / Equality Monitoring
- **Table:** `dei_responses` — anonymous equality data
- **Columns:** `survey_period` (e.g. '2026-Q1'), `age_band`, `gender`, `ethnicity`, `disability`, `sexual_orientation`, `religion`, `caring_responsibilities`
- **Reports:** Aggregate-only, never individual-level

### Performance: 1-to-1 Records
- **Table:** `one_to_one_records`
- **Columns:** `manager_id`, `employee_id`, `meeting_date`, `notes_manager`, `notes_employee`, `agreed_actions`, `follow_up_date`
- **UI needed:** Meeting scheduler, shared notes, action tracking

### Performance: Objectives
- **Table:** `objectives`
- **Columns:** `profile_id`, `title`, `description`, `category` (performance/development/strategic), `status` (not_started/in_progress/completed/deferred), `progress` (0–100), `due_date`, `review_period`, `aligned_to`
- **UI needed:** Objective cards with progress bars, status badges, alignment tags

### Praise / Shout-outs
- **Table:** `praise`
- **Columns:** `from_profile_id`, `to_profile_id`, `message`, `category` (teamwork/innovation/customer_focus/above_and_beyond/leadership), `is_public`
- **UI needed:** Praise cards, team feed, possibly visible on intranet news feed

### Document Signing / Acknowledgements
- **What:** Lightweight e-signature/acknowledgement system for post-start letters and policy acknowledgements
- **Context:** HR has no DocuSign access. Google Docs e-signature is an option for post-start documents. Pre-start contracts remain manual for now.
- **Possible approach:** Built-in acknowledgement system (employee clicks "I have read and agree" with timestamp + IP logging) for policies. Google Docs e-signature for formal letters (needs investigation).
- **Decision needed:** Whether to build in-app or rely on Google Docs e-signature

### Reports & Analytics (Nexus-inspired)
- **Route:** `/hr/reports` (new page)
- **Reports:**
  - Headcount & Turnover — line chart from `employment_history` events
  - Sickness & Absence — bar chart by department from `absence_records`
  - Diversity & Inclusion — donut chart from `dei_responses` (anonymised)
  - Leave usage — breakdown by type, department, trends
- **Features:** Date range filtering, department/region filters, CSV export
- **Charting:** Recharts (already used in L&D admin dashboard)
- **Effort:** Medium-High — aggregation queries, chart components, filters

---

## Aspirational — EXPLORATION NEEDED

### Directory Grid View + Google Profile Photos
- **What:** Add grid/list toggle to `/hr/users` with avatar-based cards
- **Photo source:** Google profile pictures via OAuth (`avatar_url` may already be stored by Supabase Auth — needs investigation). Alternative: Google People API.
- **Effort:** Low for grid toggle UI; exploratory for photo sourcing

---

## Key File Reference

| Area | Files |
|------|-------|
| Shared config | `src/lib/hr.ts` |
| Auth helpers | `src/lib/auth.ts` (`requireHRAdmin`, `getCurrentUser`, `PROFILE_SELECT`) |
| Server actions | `src/app/(protected)/hr/*/actions.ts` |
| Components | `src/components/hr/*.tsx` |
| DB types | `src/types/database.types.ts` |
| Migrations | `supabase/migrations/00024–00032` |
| Middleware | `src/middleware.ts` (HR access: staff only) |
| Tests | `src/app/(protected)/hr/users/actions.test.ts` |

---

## Decisions Pending

- [x] Bradford Factor: Replaced with wellbeing prompts (decided Feb 2026). `calculateBradfordFactor()` kept as internal utility.
- [x] Payroll: Managed by separate provider, no integration needed (confirmed Feb 2026)
- [ ] Bank information: Currently on Google Forms/Sheets (Lynne, Jacqueline, HR Manager access). Decision needed on whether to store in-app with encryption or keep on Google. Security review required.
- [ ] Document signing: No DocuSign access for HR. Options: Google Docs e-signature (post-start only) vs built-in acknowledgement system. Needs investigation.
- [ ] Compressed hours: 4-day week supported. 9-day fortnight mentioned by HR — decide if it needs a new `work_pattern` entry when building flexible working feature.
- [ ] Onboarding checklist: What items should be configurable vs fixed?
- [ ] Reports priority: Which reports are needed first for board/funding?
- [ ] Profile photos: Investigate `avatar_url` from Supabase Auth Google OAuth
