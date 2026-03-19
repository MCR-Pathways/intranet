# MCR Pathways Intranet — Development Plan

> **Living document** — updated as features are completed and priorities shift.
> For HR-specific roadmap, see [docs/hr-plan.md](./hr-plan.md).
> For intranet overhaul roadmap, see plan in `.claude/plans/encapsulated-doodling-wigderson.md`.
> Last updated: 2026-03-18

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

### Sign-In / Working Location ✅ (v2 complete)
- Schedule-based weekly working location planner (replaced daily sign-in)
- Interactive month calendar with day detail panel (Google Calendar–inspired)
- Recurring weekly patterns with one-click apply
- Google Calendar sync (read + write-back) with domain-wide delegation
- Team schedule grid + team calendar with member filtering (managers)
- Kiosk check-in for office arrival confirmation
- Daily reconciliation banners, reports with CSV export
- Quality pass: colour overhaul, Gemini fixes, interactive calendar redesign
- UX polish: Default Week Editor moved to Settings page, Google Calendar-style dropdowns, calendar month/year navigation

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
- **Phase 1 polish (PR #44):** Comment editing with "(edited)" indicator, pin/unpin posts (HR admin), pathways_coordinators can post, `enrichPosts()` dedup, parallel file uploads, DB-first delete ordering
- **Phase 2 — Tiptap + @Mentions (PR #45):** Rich text composer (Tiptap: bold, italic, links, lists), @mention picker with inline people dropdown, `content_json` JSONB storage with plain-text fallback for backward compat, mention notifications via `notify_mention` RPC, TiptapRenderer for posts and comments, shared Tiptap utilities (`src/lib/tiptap.ts`)
- **Phase 2 security fixes (PR #47):** Sanitise TiptapRenderer link hrefs (stored XSS), tighten mention table RLS to author-only INSERT/DELETE, fix mentioner ID spoofing in `notify_mention()` by using `auth.uid()`
- **Phase 5 — Facebook-style Composer (PR #51):** Collapsed trigger card → focused modal dialog. Shared `ComposerActionBar` with coloured icons (Photo green, Document blue, Poll amber). Compact link preview variant. Unsaved changes guard. `forwardRef` + `useImperativeHandle` on `AttachmentEditor` for external triggers.
- **Link preview image proxy (PR #54 + #55):** OG images proxied through `/api/og-image` to satisfy CSP `img-src 'self'`. New posts store proxied URL at creation; old posts get render-time proxy via `proxyImageUrl()` in `LinkPreviewCard`. SSRF protection extracted to `src/lib/ssrf.ts` (private IP checks, redirect validation, SVG blocking, 2MB size limit). Auth-gated, 24hr cache. Feed narrowed to `max-w-[590px]` with `aspect-[1.91/1]` OG image ratio to match Facebook proportions.
- **Phase 3 — Live Feed + Polls + Comment Notifications (PR #48):** "X new posts" polling banner (30s count-only query, tab visibility-aware), comment/reply notifications via `notify_post_comment` RPC with mention deduplication, inline polls (2-4 options, vote changing, optional expiry, CSS bar results)
- **Phase 4 — Resources / Knowledge Base (PR #48):** Two-level Resources module (Categories → Articles) replacing Guides + Policies stubs. Tiptap-powered article composer. HR admins manage content, all users read. 4 seeded categories. Sidebar consolidated to single "Resources" item.

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
- Security hardening (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, CSP enforcing, auth redirect validation, generic error responses, timing-safe tokens, `SET search_path` on all SECURITY DEFINER functions — PRs #106-107)
- **CSP enforcing** (Mar 2026): `unsafe-eval` omitted entirely (dev violations are cosmetic). Static string CSP with `*.supabase.co` wildcard — IIFEs in header values crash Vercel Fluid Compute. `unsafe-inline` retained for Next.js hydration + inline styles. Nonce-based CSP deferred (forces dynamic rendering — disproportionate cost for internal app).
- Error and loading boundaries for all protected routes
- Structured logger (`src/lib/logger.ts`) ready for Sentry/Datadog swap
- Audit logging via DB triggers on 8+ tables
- Proxy auth with module access control by user type (renamed from middleware for Next.js 16)
- **Proxy JWT optimisation** (PR #49): zero DB queries per authenticated request via JWT custom claims
- **Unit Testing** (PRs #52-58, #61, #73): 1041 tests across 48 files covering server actions, hooks, components, and pure functions. See `docs/testing-plan.md` for full breakdown.
- **E2E Testing** (PR #90): Playwright + local Supabase (Docker). 18 E2E tests: auth redirects, module access control (staff vs coordinator), sidebar navigation, HR admin sub-items. Role-based fixtures (hrAdmin, lineManager, staff, coordinator). See `memory/e2e-testing.md` for phases.

### UI/UX Polish ✅
- **Collapsible sidebar** (YouTube-style): hamburger toggle always visible, collapses to 64px icon rail with tooltips, expands to 256px with labels. State persisted in `localStorage`.
- **Grouped sidebar navigation**: HR items grouped into My HR / Organisation / Admin sections. Learning items grouped into personal / Admin. Group labels shown when sidebar is expanded.
- **Shared PageHeader component** (`src/components/layout/page-header.tsx`): Standardised `text-3xl font-bold tracking-tight` title with optional subtitle, breadcrumbs, and action slot. Adopted across all ~15 page files.
- **Breadcrumbs**: Integrated into PageHeader with `/` separator (GitHub/Linear/Notion style) and hover underlines. Standardised across all pages: 14 existing pages updated (HR→Admin, Intranet→Home labels), 8 admin pages gained breadcrumbs (absence, compliance, key-dates, leaving, users, flexible-working, course management, L&D reports). Article editor prepends "Home" root. PR #112.
- **HR admin dashboard**: Admin-only `/hr` page with stat cards, office attendance, administration quick-actions, and L&D admin section. Non-admins redirect to `/hr/profile`.
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

### HR Phase 2 ✅
- [x] Absence records & sickness tracking
- [x] Return-to-work forms (digital replacement for paper RTW Discussion Form)
- [x] Staff leaving forms (offboarding) — dashboard + full form page + employee detail tab + auto-calculated data
- [x] Flexible working requests (PR #62) — full digital workflow per Employment Relations (Flexible Working) Act 2023
- [x] Department-based access model (PR #63) — auto-grant admin from department, 4-layer security, sidebar restructure
  - [x] Decoupled permissions from departments (PR #68) — admin roles explicitly granted (not auto-derived from department), dynamic departments table (migration `00040`), permission confirmation dialogs
  - [x] User Management interface improvement (PR #69) — compact 4-column table, split edit dialogs (Profile/Employment/Permissions), searchable comboboxes (`cmdk` + Radix Popover), auto-derive is_external for pathways coordinators, `isCurrentUserHRAdmin` permission gating
- [x] Leave calendar tab (PR #64) — calendar moved into `/hr/leave` as manager/HR admin tab
- [x] My Team (PR #65, #67) — manager + peer views, on-leave indicators, work anniversaries
- [x] Org Chart (PRs #66, #67, #70) — interactive react-d3-tree, search with auto-focus on match subtree, department filter with ancestor chain, focus mode with breadcrumbs, zoom controls, click-to-navigate, bigger cards with `line-clamp-2` titles, MCR org structure seed data (~70-80 profiles)
- [x] Onboarding progress tracker — configurable template-based checklists for new starters, dashboard with progress bars, template management, employee detail tab integration
- See [docs/hr-plan.md](./hr-plan.md) for full details

### HR Phase 3
- [ ] Surveys & pulse checks
- [ ] DEI / equality monitoring
- [ ] Performance: 1-to-1 records, objectives
- [ ] Praise / shout-outs
- [ ] Document signing / acknowledgements
- [ ] Reports & analytics with charts
- See [docs/hr-plan.md](./hr-plan.md) for full details

### Sign-In v2 — Working Location (Schedule-Based + Google Calendar) ✅
Full plan in `.claude/plans/synthetic-launching-raccoon.md`. All 8 phases + quality pass complete.

**Phases 1–8 ✅** — Data model, week planner, people calendar, recurring patterns, kiosk, team grid, Google Calendar sync (read + write-back), daily banners, reports. See memory file `memory/sign-in-overhaul.md` for full phase breakdown.

**Quality Pass ✅** (branch: `fix/gemini-review-fixes`, PR #86)
- [x] **Part A — Gemini PR Fixes**: ~35 fixes across 15 files (split-day headcount, timing-safe tokens, N+1 batching, PII masking, empty catches → logger.warn, 410 full sync, service account key guard) + PR #86 review fixes (configurable kiosk office, `getUKToday` dedup, CSV `\n` sanitisation, unified `calendar.events` scope, offline queue retry, shared `timingSafeTokenCompare`)
- [x] **Part B+C — Colour Scheme + HR Wording**: Soft muted palette (`sky-50`/`teal-50`/`slate-100`/`rose-50`), MCR brand to Tailwind config, "Office Planning" wording
- [x] **Part D — Interactive Month Calendar**: Replaced WeekStrip with `InteractiveCalendar` (PeopleCalendar + DayDetailPanel), `QuickSetIcons` for 1-click location, `PendingLeaveList`, `LeaveRequestDialog` with `defaultStartDate`
- [x] **Part E — Team Calendar + Filter**: `TeamCalendar` with member filter dropdown, Month/Week toggle, day sidebar
- [x] **Part F — Google Calendar Setup Guide**: `docs/google-calendar-setup.md` for IT admins

### Intranet Phase 3 — Live Feed + Polls ✅
- [x] "X new posts available" polling banner (30s count-only query, tab visibility-aware)
- [x] Comment/reply notifications via `notify_post_comment` RPC (mention dedup, self-exclusion)
- [x] Inline polls in feed posts (2-4 options, vote changing, optional expiry, CSS bar results)

### Intranet Phase 4 — Resources / Knowledge Base ✅ (superseded by Phase 7 Redesign)
- [x] `/resources` top-level module (promoted from `/intranet/resources`)
- [x] Two-level hierarchy: Categories → Articles (Tiptap editor — later replaced by Google Docs)
- [x] HR admins + Content Editors create/edit/publish/delete; all users read published content
- [x] Old `/intranet/guides` and `/intranet/policies` redirect to `/resources`
- [x] Sidebar: top-level Resources item with BookOpen icon (between Home and Me)

### Intranet Phase 5 — Resources Overhaul ✅ (superseded by Phase 7 Redesign)
- [x] Soft-delete, kebab menus, featured articles, category management, icon picker, editor tooltips, auto-save
- [x] Tiptap editor code later removed in Phase 7 redesign (Google Docs integration replaced it)

### Sidebar Declutter — Semantic Regrouping + Admin Separation ✅ (PR #111)
- [x] Rewrite `sidebar.tsx` navigation data model: rename Intranet → Home, HR → Me, Working Location → Location
- [x] Split HR children: personal items under "Me", admin items removed from sidebar (live on `/hr` dashboard)
- [x] Add "Admin" utility link (single dashboard link, Jira/GitHub Settings pattern) for HR admins and L&D admins
- [x] New active state detection: child-path-only matching (resolves Me vs Admin conflict on `/hr/` prefix)
- [x] Remove redundant profile info card from `/settings` page (lives on `/hr/profile`)
- [x] Add L&D admin quick-action cards to HR dashboard (`/hr`)
- [x] Make `/hr` page admin-only — non-admins redirect to `/hr/profile`
- [x] Update E2E test assertions for renamed sidebar items
- No route changes — sidebar is purely visual mapping

### Breadcrumb Consistency ✅ (PR #112)
- [x] Rename stale root labels: HR→Admin (8 admin pages), Intranet→Home (5 resource/roundup pages), Learning→Admin (1 L&D admin page)
- [x] Add breadcrumbs to 8 admin pages missing them (absence, compliance, key-dates, leaving, users, flexible-working, course management, L&D reports)
- [x] Replace manual `<h1>` headers with shared PageHeader component (5 pages)
- [x] Fix article editor: prepend "Home" root breadcrumb
- [x] Visual refresh: `/` separator (GitHub/Linear/Notion style), `hover:underline` on links, removed ChevronRight icon

### Intranet Phase 6 — Resources Restructure ✅ (PRs #127–134)
- [x] **PR A — Systems Admin Permissions** (PR #127): Migration 00052. Systems admins can toggle `is_ld_admin`, `is_systems_admin`, `is_line_manager`, `is_content_editor`. HR Admin + department remain HR-admin-only.
- [x] **PR — Remove Pathways Coordinator** (PR #130): Migration 00053. `pathways_coordinator` → `staff` + `is_external = true`. `is_internal_staff()` DB function. Proxy redirect loop fix.
- [x] **PR — Content Editor Permission** (PR #128): Migration 00054. `is_content_editor` column, DB functions, 8 RLS policies updated, JWT claims sync. `requireContentEditor()` gate.
- [x] **PR B — Subcategories + Visibility** (PR #131): Migration 00055. `parent_id` self-referential FK with depth trigger, `visibility` on categories/articles, `resolve_article_visibility()` for RLS, `VisibilityBadge` component.
- [x] **PR C — Route Promotion** (PR #131): Routes `/intranet/resources` → `/resources`. Top-level sidebar item. 308 redirects in `next.config.ts`. 11 component + 8 route files.
- [x] **PR D — 9-Category Taxonomy** (PR #131): Migration 00056. Soft-delete old 3 placeholder categories, seed 9 top-level + 43 subcategories organised by function. Article breadcrumb parent chain fix. Legacy redirect fix (`/intranet/guides`, `/intranet/policies` → `/resources`).

### Intranet Phase 7 — Resources Redesign ✅ (PR #157, 6 sub-PRs)
Complete redesign of the Resources module. Tiptap article editor replaced with Google Docs integration. Category grid replaced with sidebar tree navigation. Component page system added.
- [x] **Sub-PR 1 — Schema + Google Drive Backend** (PR #151): Migration 00058. 6 new columns on resource_articles, drive_folders table, Drive API client, HTML export + sanitisation, webhook endpoint, 7 server actions, 35 tests.
- [x] **Sub-PR 2 — Sidebar Tree + Resources Layout** (PR #152): 3-level collapsible tree, dual-action click, icon-only collapse, resources shell, category content view, flat article route (`/resources/article/[slug]`), catch-all category route (`/resources/[...slug]`).
- [x] **Sub-PR 3 — Google Doc Integration UI** (PR #153): Editor mode context + pencil toggle, admin bar (New dropdown, Settings), link Google Doc dialog, Google Doc article view (prose rendering, sync status, Open in Docs, Supabase Realtime live updates), unlink dialog.
- [x] **Sub-PR 4 — Component Pages + Org Chart** (PR #154): Component registry (`resource-components.ts`), dynamic import rendering, org chart relocated from `/hr/org-chart` to Resources (308 redirect). Migration 00059 seeds org chart.
- [x] **Sub-PR 5 — Settings + Algolia Search** (PR #155): Settings page (folder registration, featured curation, category management), Algolia InstantSearch (section-level indexing with deep links), `html-react-parser` for heading IDs, article outline sidebar restored.
- [x] **Sub-PR 6 — Cleanup** (PR #156): Deleted 9 files + 12 dead server actions (3,081 lines of Tiptap editor code removed).

### Resources Post-Launch Fixes (2026-03-19)
- [x] **jsdom → linkedom migration** (PR #159 + main commits): jsdom v28 failed with ERR_REQUIRE_ESM on Vercel serverless. Replaced with linkedom in `html-sections.ts` and `google-drive.ts`. jsdom kept in devDependencies for Vitest.
- [x] **Category dropdown error handling**: Added `.catch()`/`.finally()` to `fetchCategoriesForMove()` in link dialog.
- [x] **Error logging**: Added `logger.error` to `fetchCategoriesForMove` for Supabase query failures.
- [ ] **Prose rendering bug**: Tailwind `prose` heading/table styles not applying to synced Google Doc HTML. See `memory/prose-rendering-investigation.md`.
- [ ] **6 failing google-drive tests**: Whitespace differences between jsdom (test) and linkedom (production).
- [ ] **Algolia index creation**: `resources_articles` index auto-creates on first successful Google Doc link.

### Intranet Phase 8 — Surveys + Universal Search
- [ ] Full survey module: multi-question, 5 question types, anonymous option, results dashboard
- [ ] Cmd+K universal search palette: posts + resources + people

---

## Technical Debt

- [x] Remove hardcoded dashboard learning stats
- [x] Remove hardcoded notification badge count
- [x] Remove hardcoded induction checklist items
- [x] Add loading states to data fetches
- [x] Add error handling (error boundaries)
- [x] Add form validation
- [x] Security review (headers, `select("*")` audit, SSRF hardening, comprehensive audit Mar 2026 PRs #106-107)
- [x] Dead code removal (`useUser()` hook deleted)
- [x] Shared utility dedup (`getInitials` → `src/lib/utils.ts`)
- [x] Proxy JWT optimisation (PR #49): `user_type`, `status`, `induction_completed_at` synced to `auth.users.raw_app_meta_data` via DB trigger, proxy reads from JWT `app_metadata` instead of querying profiles. DB fallback for pre-migration sessions.
- [x] CSP tightened to enforcing mode (Mar 2026): switched from Report-Only to enforcing. `unsafe-eval` omitted entirely. Static string CSP (IIFEs crash Vercel Fluid Compute). `unsafe-inline` retained (Next.js hydration + 3 inline style components). Nonce-based CSP deferred.
- [ ] Rate limiting on API endpoints (requires Upstash Redis for Vercel serverless — in-memory limiters don't persist across invocations). Priority endpoints: `/api/kiosk/confirm`, `/auth/confirm`, `/api/calendar/webhook`.
- [ ] Error monitoring integration (swap logger transport for Sentry/Datadog)
- [x] Expand test coverage (~20% — 48 test files, 1040 tests / ~236 source files). All 9 phases complete (PRs #52, #53, #56, #57, #58, #61, #73). See [docs/testing-plan.md](./testing-plan.md).
- [x] UI/UX polish (collapsible sidebar, shared PageHeader, breadcrumbs, dashboard sections)
- [x] Colour/UX overhaul (PR #91): Realigned Shadcn semantic tokens (`--secondary`, `--accent`, `--muted`) from brand colours to neutral greys (#F1F5F9). Background from ivory (#FDF9EA) to cool grey (#F2F4F7, Facebook's --web-wash). Muted from warm (#f5f3eb) to cool (#F0F2F5, Facebook's --comment-background). 4 components migrated to direct `--mcr-*` brand references. Dialogs/sheets fixed to `bg-card` (white) for proper form input contrast. ~100+ components auto-updated via CSS cascade. Industry-validated against GitHub Primer, Vercel Geist, Stripe, Facebook.
- [x] Table standardisation (COMPLETE — 15 of 17 tables migrated, 2 skipped, 7 PRs #92-97): Shadcn Table + TanStack Table. Interactive sorting, pagination, sticky headers, row numbering. 2 skipped: team-schedule-grid (calendar grid), reports-panel (simple report).
- [x] Accent hover contrast fix (PR #98, #101): Decoupled `--accent` from `--secondary` in both light and dark modes. Light: #E2E8F0, Dark: hsl(210,25%,22%).
- [x] Tab bar redesign (PR #99, #101): Adopted Shadcn v4 `variant="line"` pattern. Replaced heavy navy `bg-primary` container with underline-style tabs. 9 consumer files migrated. Hover state on both variants. Nested tabs (working-location) use default (pill) for visual hierarchy.
- [x] Date formatting consolidation (PR #100): Extracted `formatDate()` and consolidated `formatShortDate()` usage across 7 files. Eliminated inline `toLocaleDateString` duplication.
- [x] Brand colour refinement (PRs #121-123, #125): Link colour token (`--link` = teal), icon palette (6 MCR brand swatches), avatar hash (Navy/Teal/Wine), pink WCAG fix, Google default avatar filter (`filterAvatarUrl()`). 1112 tests.
- [ ] Mobile responsiveness (currently desktop/laptop only)

---

## Test Accounts

| Account | Type | Auth |
|---------|------|------|
| `test.worker@mcrpathways.org` | Admin | Magic link |
| `abdulmuiz.adaranijo+test2@mcrpathways.org` | Staff (Full Test) | Magic link |
| `test.practice@mcrpathways.org` | Pathways coordinator | Magic link |
