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

## Phase 1 Polish — UP NEXT

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

### Leave Team Capacity Notification
- **Where:** `LeaveRequestDialog` (requester view) and approval view (approver)
- **What:** Informational notice (not a blocker) when requesting/approving leave that would leave the team light:
  - Only checks team members (same manager's direct reports), not org-wide
  - Excludes public holidays
  - Blue/neutral info notice: "Note: [Name] is also on leave [dates]. Your team will have [X/Y] members available."
- **Effort:** Medium — query approved/pending leave for team members in date range

### Bradford Factor Display (Optional)
- **Where:** Employee detail leave tab (HR admin view only)
- **What:** Small card showing Bradford Factor score (S² × D) with colour indicator: green (<50), amber (50–200), red (>200). `calculateBradfordFactor()` already exists in `src/lib/hr.ts`.
- **Considerations:** Can be seen as punitive. Never shown to the employee. MCR Pathways to decide if this aligns with their people culture.
- **Effort:** Very low — one card component

---

## Phase 2 — PLANNED

Database tables already created in migration `00024`. Need RLS policies (in `00025` or new migration) and UI.

### Absence Records & Sickness Tracking
- **Table:** `absence_records` — extends leave with sickness categories, fit note tracking, GP details
- **Columns:** `profile_id`, `leave_request_id` (optional link), `start_date`, `end_date`, `sickness_category` (12 categories in `src/lib/hr.ts`), `is_work_related`, `fit_note_received`, `fit_note_expiry`, `gp_referral`, `occupational_health_referral`, `notes`
- **UI needed:** Sickness record form (HR admin), sickness history tab on employee detail, sickness trends dashboard

### Return-to-Work Forms
- **Table:** `return_to_work_forms` — structured RTW interview data
- **Columns:** `absence_record_id`, `employee_id`, `completed_by`, `meeting_date`, `absence_reason`, `support_offered`, `adjustments_needed`, `adjustments_details`, `fit_for_work`, `follow_up_required`, `follow_up_date`, `follow_up_notes`, `employee_comments`, `manager_comments`
- **UI needed:** RTW form (manager fills in after employee returns), linked from absence record

### Staff Leaving Forms (Offboarding)
- **Table:** `staff_leaving_forms` — offboarding checklist and exit data
- **Columns:** `profile_id`, `leaving_date`, `last_working_date`, `reason_for_leaving` (7 reasons in `src/lib/hr.ts`), `destination`, `exit_interview_completed`, `exit_interview_notes`, `knowledge_transfer_completed`, `equipment_returned`, `access_revoked`, `final_pay_processed`, `reference_agreed`, `notes`, `completed_by`
- **UI needed:** Leaving form (HR admin), offboarding checklist view, auto-link to asset returns

### Onboarding Progress Tracker (Nexus-inspired)
- **Table:** New — `onboarding_checklists` or similar
- **What:** Configurable checklist for new starters (Right to Work, Contract Signed, IT Equipment Assigned, DBS/PVG Submitted, Bank Details Received, etc.)
- **UI needed:** Progress bar per new starter, checklist view, dashboard widget showing new starters in pipeline
- **Ties into:** Existing compliance documents (auto-check PVG/DBS), asset assignments (auto-check equipment)
- **Mirrors:** `staff_leaving_forms` for offboarding

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
| Migrations | `supabase/migrations/00024–00029` |
| Middleware | `src/middleware.ts` (HR access: staff only) |
| Tests | `src/app/(protected)/hr/users/actions.test.ts` |

---

## Decisions Pending

- [ ] Bradford Factor: Does MCR Pathways want this surfaced in the UI?
- [ ] Onboarding checklist: What items should be configurable vs fixed?
- [ ] Reports priority: Which reports are needed first for board/funding?
- [ ] Profile photos: Investigate `avatar_url` from Supabase Auth Google OAuth
