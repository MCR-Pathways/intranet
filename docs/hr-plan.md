# HR Module — Development Roadmap

> **Living document** — updated as features are completed and priorities shift.
> Last updated: 2026-03-09

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

### UI/UX Polish ✅ DONE
- **HR dashboard sections:** Flat 11-card grid replaced with labelled sections (My HR, Organisation, Administration) using `SectionHeader` component
- **Sidebar grouping:** HR nav items grouped into My HR (My Profile, Leave, Calendar, My Team, Assets), Organisation (Org Chart), Admin (User Management, Absence & Sickness, Compliance, Key Dates, Leaving)
- **Breadcrumbs:** Added to `/hr/users/[userId]` (HR > User Management > {name}), `/hr/leaving/[formId]` (HR > Leaving > {name}), `/hr/absence/rtw/[formId]` (HR > Absence > RTW Form)
- **PageHeader:** All HR pages now use shared `PageHeader` component with consistent `text-3xl` title styling

### Bradford Factor — DECISION: Wellbeing Prompts Instead
- **Decision (Feb 2026):** Do not surface the raw Bradford score. Research showed it's blind to cause (disability discrimination risk under Equality Act 2010), drives presenteeism, and the BMA has condemned it.
- **Alternative:** Wellbeing prompts based on absence pattern data (spells count, total days, trends). Prompts like "This employee has had X separate absences in the last 6 months. Consider a wellbeing check-in." HR admins only.
- **When:** Part of Phase 2 Absence Records & Sickness Tracking (needs `absence_records` data to drive prompts).
- **Code note:** `calculateBradfordFactor()` in `src/lib/hr.ts` kept as internal utility — not surfaced in UI.

---

## Phase 2 — COMPLETE

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

### Flexible Working Requests ✅ DONE
- **Route:** `/hr/flexible-working` (employee + HR admin views)
- **Table:** `flexible_working_requests` + `fwr_appeals` (migration 00037)
- **Actions:** `src/app/(protected)/hr/flexible-working/actions.ts` (12 server actions)
- **Capabilities:** Full digital workflow per Employment Relations (Flexible Working) Act 2023 — day-one right, 2 requests/12 months, 2-month deadline, mandatory consultation, 8 statutory grounds. Auto-updates `profiles.work_pattern` + employment history on approval. Trial periods with outcome recording. Appeals process.
- **PR:** #62

### Department-Based Access Model ✅ DONE
- **Migration:** `supabase/migrations/00038_department_based_access.sql` — `is_systems_admin` column, `is_hr_admin_effective()` / `is_ld_admin_effective()` / `is_systems_admin_effective()` SQL functions, self-promotion prevention trigger, JWT sync
- **Auth helpers:** `src/lib/auth-helpers.ts` (client-safe), `src/lib/auth.ts` (server-side `requireSystemsAdmin`, `requireHROrSystemsAdmin`)
- **Sidebar restructure:** Self-Service / People / Admin groups with role-filtered items
- **Permission UX:** Department auto-grant badges ("Via HR Department"), manual override toggles, self-edit protection
- **PR:** #63

### Decouple Permissions from Departments ✅ DONE
- **Migration:** `supabase/migrations/00040_decouple_permissions_and_departments.sql` — backfills explicit admin flags, simplifies `_effective` RPCs (removes department checks), creates `departments` table, seeds 11 departments
- **Changes:** Admin roles are now explicitly granted (not auto-derived from department membership). Departments are purely organisational. Permission confirmation AlertDialogs for granting/revoking access. Dynamic department dropdowns from DB.
- **New page:** `/hr/departments` — CRUD management for departments (colour, sort order, activate/deactivate)
- **PR:** #68

### User Management Interface Improvement ✅ DONE
- **What:** Compact 4-column table (Person, Status, Organisation, Actions) with two-line rows replacing 9-column cluttered table. Split overloaded UserEditDialog into three focused dialogs (ProfileEditDialog, EmploymentEditDialog, PermissionsEditDialog). Searchable comboboxes for line manager/team assignment. Auto-derive `is_external = true` for pathways coordinators. System Permissions card on detail page overview. `is_external` moved from header badges to Employment card as "Classification".
- **Components:** `person-combobox.tsx`, `team-combobox.tsx`, `permissions-edit-dialog.tsx`, `command.tsx`, `popover.tsx` (NEW); `user-table.tsx`, `user-edit-dialog.tsx`, `employment-edit-dialog.tsx`, `profile-overview-tab.tsx`, `employee-detail-content.tsx` (REFACTOR)
- **Dependencies:** `cmdk`, `@radix-ui/react-popover` (Popover + Command UI primitives)
- **Server actions:** Removed `updateEmployeeEmployment` (consolidated into `updateUserProfile`), added `is_external` auto-derive for pathways coordinators
- **Types:** Added `is_systems_admin` to `ProfileSummary` in `types/hr.ts`
- **Permission audit:** Comprehensive audit for UI elements that promise actions the server silently blocks. Fixed: Department field in EmploymentEditDialog disabled for non-HR admins (server strips it), induction Complete/Reset menu items hidden for non-HR admins (server rejects), admin permission toggles disabled for non-HR admins in both UserEditDialog and PermissionsEditDialog. `isCurrentUserHRAdmin` prop threaded through all dialog chains.

### Leave Calendar Tab ✅ DONE
- Calendar removed from sidebar, now a "Team Calendar" tab within `/hr/leave` (managers/HR admins only)
- `/hr/calendar` redirects to `/hr/leave?tab=calendar` for backward compatibility
- Role-aware tab validation — non-managers/non-admins can't access calendar/approvals tabs
- **PR:** #64

### My Team ✅ DONE
- **Route:** `/hr/team`
- **Components:** `src/components/hr/team-dashboard-content.tsx` (manager view), `src/components/hr/team-peer-content.tsx` (non-manager view), `src/components/hr/team-member-card.tsx` (shared card)
- **Capabilities:**
  - Manager view: direct reports grid, on-leave indicators, pending approvals pill, who's off banner, work anniversary detection (14-day window) with purple summary pill and cake icon
  - Non-manager view: peers (same line_manager_id), manager info card, on-leave indicators
  - Orphan state: empty state prompting HR contact
  - Action menu: View in User Management, View Leave, View on Calendar
- **PRs:** #65, #67

### Org Chart ✅ DONE
- **Route:** `/hr/org-chart`
- **Components:** `src/components/hr/org-chart-content.tsx` (main client component), `src/components/hr/org-chart-person-card.tsx` (foreignObject card)
- **Library:** `react-d3-tree` (dynamic import, SSR-safe)
- **Seed data:** `supabase/migrations/00039_seed_mcr_org_structure.sql` + `scripts/seed-org-structure.mjs` — ~70-80 profiles mirroring MCR's real org structure (real job titles, fake names)
- **Capabilities:**
  - Interactive tree built from `line_manager_id` relationships
  - Virtual root "MCR Pathways" when multiple roots exist
  - Search by name/title with auto-focus on match's manager subtree + breadcrumb navigation
  - Department filter (Shadcn Select) with ancestor chain (no virtual root), search + filter coordination (searching resets filter, filtering clears search)
  - "Find Me" button, expand/collapse all, zoom controls (±/fit) with backdrop blur
  - Focus mode: drill into any manager's subtree with breadcrumb trail, click-to-centre with smooth transitions
  - Person cards: bigger (280×130), avatar with coloured fallback, `text-sm` name, `line-clamp-2` job title, department colour border, on-leave amber dot, GCC badge, FTE badge, "N reports" badge
  - Click card → navigates to `/hr/users/{id}`
  - Department legend strip showing active departments with colour dots
  - Dynamic initial centering based on container width
  - Keyboard hints overlay
  - Accessibility: `role="img"`, `aria-label`, `aria-roledescription` on container; `aria-label` on each card
- **PRs:** #66, #67, #70 (UI/UX improvement)

### Onboarding Progress Tracker ✅ DONE
- **Routes:** `/hr/onboarding` (dashboard), `/hr/onboarding/[checklistId]` (detail), `/hr/onboarding/templates` (template management)
- **Components:** `src/components/hr/onboarding-dashboard-content.tsx`, `src/components/hr/onboarding-checklist-content.tsx`, `src/components/hr/onboarding-template-management.tsx`, `src/components/hr/onboarding-progress-bar.tsx`, `src/components/hr/create-onboarding-dialog.tsx`, `src/components/hr/profile-onboarding-tab.tsx`
- **Actions:** `src/app/(protected)/hr/onboarding/actions.ts` (18 server actions)
- **Migration:** `supabase/migrations/00047_onboarding_tracker.sql` — 4 tables (`onboarding_templates`, `onboarding_template_items`, `onboarding_checklists`, `onboarding_checklist_items`), indexes, RLS policies, updated_at trigger
- **Capabilities:**
  - Configurable templates with sections (Before Start, Day One, First Week, First Month, General) and assignee roles (HR Admin, Line Manager, Employee, Other)
  - Relative due dates (day offset from start date), resolved to concrete dates on checklist creation
  - Dashboard with search, progress bars, overdue indicators, "Show completed" toggle
  - Detail page with grouped items, checkbox toggling, add ad-hoc items, complete/cancel actions
  - Template management: create/edit/delete templates, inline item management with section grouping
  - Employee detail "Onboarding" tab with active checklist summary + history
  - HR dashboard stat card ("Active Onboardings") + quick action card
  - Authority: HR admin full access, line managers can toggle items for their reports
  - Partial unique index: one active checklist per employee
  - Notifications on checklist creation (employee + line manager) and completion (initiator)
- **Mirrors:** `staff_leaving_forms` offboarding pattern

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
| Migrations | `supabase/migrations/00024–00032`, `00037` (FWR), `00038–00040` (permissions/departments), `00044` (decouple permissions), `00047` (onboarding) |
| Proxy | `src/proxy.ts` (HR access: staff only) |
| Tests | `src/app/(protected)/hr/{absence,assets,compliance,departments,key-dates,leave,leaving,profile,users}/actions.test.ts` (9 files). **Missing:** flexible-working, onboarding |
| Component tests | `src/components/hr/{department-management-content,leave-request-table,org-chart-content,org-chart-person-card,permissions-edit-dialog,person-combobox,return-to-work-form,team-combobox}.test.tsx` (8 files) |

---

## Decisions Pending

- [x] Bradford Factor: Replaced with wellbeing prompts (decided Feb 2026). `calculateBradfordFactor()` kept as internal utility.
- [x] Payroll: Managed by separate provider, no integration needed (confirmed Feb 2026)
- [ ] Bank information: Currently on Google Forms/Sheets (Lynne, Jacqueline, HR Manager access). Decision needed on whether to store in-app with encryption or keep on Google. Security review required.
- [ ] Document signing: No DocuSign access for HR. Options: Google Docs e-signature (post-start only) vs built-in acknowledgement system. Needs investigation.
- [ ] Compressed hours: 4-day week supported. 9-day fortnight mentioned by HR — decide if it needs a new `work_pattern` entry when building flexible working feature.
- [x] Onboarding checklist: Fully configurable via templates — HR admins create templates with items, sections, assignee roles, and day offsets. No fixed items.
- [ ] Reports priority: Which reports are needed first for board/funding?
- [ ] Profile photos: Investigate `avatar_url` from Supabase Auth Google OAuth
