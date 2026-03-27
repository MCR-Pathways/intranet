# MCR Pathways Intranet — Development Plan

> **Living document** — updated as features are completed and priorities shift.
> For HR-specific roadmap, see [docs/hr-plan.md](./hr-plan.md).
> Last updated: 2026-03-27

---

## Completed Modules

### Learning & Development ✅ (Overhaul complete — replaced LearnDash)
- **Original V1** (complete): Course catalogue, enrolment, progress tracking, compliance alerts, admin CRUD/reports
- **Overhaul** (complete): Full LMS rebuild. See `docs/learning-overhaul.md` for comprehensive handover.
  - Phase 1 ✅: Migrations (00060-00070), shared utilities, section CRUD actions
  - Phase 2 ✅: Admin UI (Tiptap editor, DnD, auto-save, preview), learner UI (Complete and Continue, progress bars), certificates (PDF), section quizzes
  - Phase 3 ✅: Reporting & assignments (individual assignment, course duplication, manager compliance)
  - Tool Shed ✅: Social learning feed (Digital Postcards, 3-2-1 Model, 10-Minute Takeover). 6 components, JSONB content, format configs. PR #176.
  - Email notifications: DORMANT until Resend account setup (RESEND_API_KEY + CRON_SECRET + domain verification). PR #175.
  - Key changes: Course→Sections→Lessons, section quizzes, certificates (PDF), Tool Shed, global Cmd+K search, private course feedback

### Sign-In / Working Location ✅ (v2 complete)
- Schedule-based weekly working location planner (replaced daily sign-in)
- Interactive month calendar with day detail panel (Google Calendar–inspired)
- Recurring weekly patterns with one-click apply
- Google Calendar sync (read + write-back) with domain-wide delegation
- Team schedule grid + team calendar with member filtering (managers)
- Kiosk check-in for office arrival confirmation
- Daily reconciliation banners, reports with CSV export

### Induction System ✅
- 9-step induction checklist with DB persistence (`/intranet/induction`)
- Auto-redirect when complete, server-side verification

### News Feed & Content ✅
- Post composer with Tiptap rich text, @mentions, attachments, link previews
- Reactions, editing, deletion, pin/unpin, comment notifications
- Inline polls (custom duration, multi-select, close early, CSV/XLSX/PDF export)
- Weekly roundup banner, image lightbox

### Notifications ✅
- Real-time notification bell with unread badge
- Mark as read / mark all as read
- Course publish notifications via RPC

### HR Module ✅ (Phase 1+2 complete)
- Phase 1: User management, profile, leave, assets, compliance, key dates, dashboard
- Phase 2: Absence, RTW, leaving, flexible working, permissions, org chart, my team, onboarding
- See [docs/hr-plan.md](./hr-plan.md) for Phase 3 roadmap

### Resources ✅ (complete)
- Google Docs integration (link, sync, webhook auto-update)
- Category hierarchy (9 top-level, 43+ subcategories, cascading selects)
- Component pages (org chart under Org Structure)
- Algolia search (section-level indexing, deep linking)
- Editor mode, settings page, featured articles
- UX redesign: grouped index, scroll-spy TOC, freshness indicators, "More in [folder]" sibling nav

### Algolia Search ✅
- 3 indices: resources_articles, learning_courses, tool_shed_entries
- Global Cmd+K search overlay with recent search management
- Faceted course catalogue
- Deep linking for resources (#sectionSlug) and Tool Shed (#entryId)

### Infrastructure ✅
- Security hardening (HSTS, CSP enforcing, auth redirect validation, timing-safe tokens, SECURITY DEFINER search_path)
- Proxy JWT optimisation (zero DB queries per authenticated request)
- React Compiler enabled, Turbopack FS caching
- 1,267 tests across 53 files (Vitest + RTL + jsdom)
- E2E setup (Playwright + local Supabase Docker, 18 tests)
- Structured logger ready for Sentry/Datadog swap

### UI/UX Polish ✅
- Collapsible sidebar (YouTube-style), shared PageHeader, breadcrumbs
- Colour/UX overhaul (neutral greys, cool grey background, brand colour palette)
- Table standardisation (TanStack Table + Shadcn, 15 of 17 tables migrated)
- Tab bar redesign (underline variant), badge tonal redesign
- Brand colour refinement (link token, icon palette, avatar hash, Google avatar filter)

---

## Remaining Work

### HR Phase 3
- [ ] Surveys & pulse checks
- [ ] DEI / equality monitoring
- [ ] Performance: 1-to-1 records, objectives
- [ ] Praise / shout-outs
- [ ] Document signing / acknowledgements
- [ ] Reports & analytics with charts
- See [docs/hr-plan.md](./hr-plan.md) for full details

### Settings Preferences
- [ ] Notification preferences (email/in-app toggles)
- [ ] Google Calendar connection toggle
- [ ] Theme/display preferences

### Infrastructure & Testing
- [x] Rate limiting on API routes (Upstash Redis). Server action rate limiting deferred to hardening phase — see `memory/rate-limiting.md`
- [ ] Error monitoring integration (Sentry/Datadog swap for `src/lib/logger.ts`)
- [ ] E2E test phases 2-3 (core module + HR module tests — currently 18 E2E tests for 56 pages)
- [ ] Mobile responsiveness pass (currently desktop/laptop only)
- [ ] CI/CD pipeline (GitHub Actions for automated test runs, lint, type-check)
- [ ] Regenerate `database.types.ts` from production Supabase (25 of 40+ tables present)
- [ ] Google Drive webhook renewal cron (7-day expiry, no auto-renewal)
- [ ] Resend email activation (domain verification + env vars: `RESEND_API_KEY`, `CRON_SECRET`)

### Larger Features
- [ ] Kiosk PWA — see `memory/kiosk-overhaul.md` for full requirements
- [ ] Intranet RHS sidebar (feed stays ~590px, add sidebar alongside)
- [ ] Google People API photo sync (replace URL-based avatar filter with DB-level flag)
- [ ] Intranet surveys (multi-question, 5 types, anonymous option, results dashboard)

### Known Issues
- Radix UI ID hydration mismatches — known React 19/Radix issue, harmless (won't fix)
- Mobile delete button for sign-in entries — hover-only, fix when mobile support needed (won't fix)
- Algolia `resources_articles` index — auto-creates on first Google Doc link

---

## Technical Debt
- [x] Rate limiting on API endpoints (Upstash Redis — auth, kiosk, webhooks, og-image, certificate)
- [ ] Error monitoring integration (swap logger transport)
- [ ] Mobile responsiveness
- [ ] `database.types.ts` regeneration — stale, missing 15+ tables (HR, L&D overhaul, email, mentions)
- [ ] Google Drive webhook renewal cron (watch channels expire after 7 days)
- [ ] CI/CD pipeline (GitHub Actions — currently relies on Vercel Git integration only)
- [ ] Absence records soft-delete (currently hard-deletes, no audit trail)
- [ ] Large action file splitting — flexible-working (1,167 lines), onboarding (1,140 lines), absence (966 lines)
- [x] Tool Shed popular tags DB aggregation (moved to PostgreSQL RPC — migration 00070)

---

## Test Accounts

| Account | Type | Auth |
|---------|------|------|
| `test.worker@mcrpathways.org` | Admin | Magic link |
| `abdulmuiz.adaranijo+test2@mcrpathways.org` | Staff (Full Test) | Magic link |
| `test.practice@mcrpathways.org` | External staff (is_external) | Magic link |
