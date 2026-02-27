# MCR Pathways Intranet — Development Plan

> **Living document** — updated as features are completed and priorities shift.
> For HR-specific roadmap, see [docs/hr-plan.md](./hr-plan.md).
> Last updated: 2026-02-27

---

## Completed Modules

### Learning & Development ✅
- Course catalogue with category filtering (`/learning/courses`)
- Course detail pages with enrolment
- My courses page (enrolled/completed)
- Progress tracking and completion status
- Compliance training due date alerts
- Tool Shed page (`/learning/tool-shed`)
- **Admin features:** Course CRUD, admin reports (`/learning/admin/`)
- Notification system for course publishing (RPC + UI)

### Sign-In System ✅
- Daily location sign-in with DB persistence (`/sign-in`)
- Today's sign-ins and monthly history
- Team sign-in overview for line managers
- Nudge bubble for unsigned-in users

### Induction System ✅
- 9-step induction checklist with DB persistence (`/intranet/induction`)
- Individual module pages (welcome, policies, H&S, GDPR, EDI, cyber-security, IT setup, email signature, meet the team)
- Auto-redirect when complete, server-side verification

### News Feed & Content ✅
- Post composer with attachments and link previews (`/intranet`)
- Reactions, editing, deletion with confirmation dialogs
- Auto-link detection with SSRF-hardened OG preview fetching
- Image lightbox with keyboard navigation
- Weekly roundup banner
- Guides section (`/intranet/guides`)
- Policies section (`/intranet/policies`)

### Notifications ✅
- Real-time notification bell with unread badge
- Mark as read / mark all as read
- Course publish notifications via `notify_course_published` RPC

### HR Module Phase 1 ✅
- User management with full employee detail view (`/hr/users`, `/hr/users/[userId]`)
- My profile with personal details, emergency contacts, employment history (`/hr/profile`)
- Leave management with FTE-aware calculations, approvals, calendar (`/hr/leave`, `/hr/calendar`)
- Asset tracking with full lifecycle (`/hr/assets`)
- Compliance documents with file storage and verification (`/hr/compliance`)
- Key dates tracking (`/hr/key-dates`)
- See [docs/hr-plan.md](./hr-plan.md) for Phase 2/3 roadmap

### Settings (Partial) ✅
- Profile info display (`/settings`)
- Preferences section stubbed ("coming soon")

### Infrastructure ✅
- Security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy)
- Error and loading boundaries for all protected routes
- Structured logger (`src/lib/logger.ts`) ready for Sentry/Datadog swap
- Audit logging via DB triggers on 8+ tables
- Middleware auth with module access control by user type

### UI/UX Polish ✅
- **Collapsible sidebar** (YouTube-style): hamburger toggle always visible, collapses to 64px icon rail with tooltips, expands to 256px with labels. State persisted in `localStorage`.
- **Grouped sidebar navigation**: HR items grouped into My HR / Organisation / Admin sections. Learning items grouped into personal / Admin. Group labels shown when sidebar is expanded.
- **Shared PageHeader component** (`src/components/layout/page-header.tsx`): Standardised `text-3xl font-bold tracking-tight` title with optional subtitle, breadcrumbs, and action slot. Adopted across all ~15 page files.
- **Breadcrumbs**: Integrated into PageHeader, added to nested routes (`/hr/users/[userId]`, `/hr/leaving/[formId]`, `/hr/absence/rtw/[formId]`, `/learning/courses/[id]`, `/learning/admin/courses/[id]`, `/intranet/weekly-roundup/[id]`)
- **HR dashboard sections**: Flat 11-card grid replaced with labelled sections (My HR, Organisation, Administration)
- **EmptyState component** (`src/components/ui/empty-state.tsx`): Standardised empty state with icon, title, description, optional CTA
- **LoadingButton component** (`src/components/ui/loading-button.tsx`): Button wrapper with `loading` prop showing spinner
- **Sidebar refinements**: Spacing-only separation between modules (no divider lines — research across YouTube, Gmail, Material Design 3 etc. confirmed spacing is preferred for short flat nav lists). Primary-tinted left border for active child lists. "Account" label above Settings. Hamburger alignment with sidebar icons via fixed margin. Single stat card `max-w-sm` constraint.

---

## Remaining Work

### Settings Preferences
- [ ] Notification preferences (email/in-app toggles)
- [ ] Google Calendar connection toggle
- [ ] Theme/display preferences

### HR Phase 1 Polish ✅
- [x] HR dashboard landing page (`/hr` index with live stats)
- [x] Leave team capacity notification (info notice when team is light)
- [x] Bradford Factor → replaced with wellbeing prompts approach (part of Phase 2)
- See [docs/hr-plan.md](./hr-plan.md) for full details

### HR Phase 2
- [x] Absence records & sickness tracking
- [x] Return-to-work forms (digital replacement for paper RTW Discussion Form)
- [x] Staff leaving forms (offboarding) — dashboard + full form page + employee detail tab + auto-calculated data
- [ ] Onboarding progress tracker
- [ ] Flexible working requests (form → manager approval → HR → trial period reminders)
- [ ] Org chart (`/hr/org-chart` — placeholder exists)
- [ ] My team view (`/hr/team` — placeholder exists)
- See [docs/hr-plan.md](./hr-plan.md) for full details

### HR Phase 3
- [ ] Surveys & pulse checks
- [ ] DEI / equality monitoring
- [ ] Performance: 1-to-1 records, objectives
- [ ] Praise / shout-outs
- [ ] Document signing / acknowledgements
- [ ] Reports & analytics with charts
- See [docs/hr-plan.md](./hr-plan.md) for full details

### Content Expansion
- [ ] Surveys section (`/intranet/surveys` — placeholder exists)

---

## Technical Debt

- [x] Remove hardcoded dashboard learning stats
- [x] Remove hardcoded notification badge count
- [x] Remove hardcoded induction checklist items
- [x] Add loading states to data fetches
- [x] Add error handling (error boundaries)
- [x] Add form validation
- [x] Security review (headers, `select("*")` audit, SSRF hardening)
- [x] Dead code removal (`useUser()` hook deleted)
- [x] Shared utility dedup (`getInitials` → `src/lib/utils.ts`)
- [ ] Middleware JWT optimisation (replace DB round-trip with custom claims)
- [ ] Error monitoring integration (swap logger transport for Sentry/Datadog)
- [ ] Expand test coverage (~5% currently — 14 test files, 300 tests / ~130 source files)
- [x] UI/UX polish (collapsible sidebar, shared PageHeader, breadcrumbs, dashboard sections)
- [ ] Mobile responsiveness (currently desktop/laptop only)

---

## Test Accounts

| Account | Type | Auth |
|---------|------|------|
| `test.worker@mcrpathways.org` | Admin | Magic link |
| `abdulmuiz.adaranijo+test2@mcrpathways.org` | Staff (Full Test) | Magic link |
| `test.practice@mcrpathways.org` | Pathways coordinator | Magic link |
