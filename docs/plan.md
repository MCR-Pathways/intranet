# MCR Pathways Intranet — Development Plan

> **Living document** — updated as features are completed and priorities shift.
> For HR-specific roadmap, see [docs/hr-plan.md](./hr-plan.md).
> For intranet overhaul roadmap, see plan in `.claude/plans/encapsulated-doodling-wigderson.md`.
> Last updated: 2026-03-12

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

### Intranet Phase 4 — Resources / Knowledge Base ✅
- [x] `/intranet/resources` replaces Guides + Policies stubs
- [x] Two-level hierarchy: Categories → Articles (Tiptap editor reused from Phase 2)
- [x] HR admins create/edit/publish/delete; all users read published content
- [x] Old `/intranet/guides` and `/intranet/policies` redirect to resources
- [x] Sidebar updated: single "Resources" nav item replaces "Guides" + "Policies"
- **Resources Editor Overhaul (PRs #102–105):**
  - [x] Fix double border in article editor, install 9 Tiptap extension packages (PR #102)
  - [x] Full formatting suite: links, images, tables, callouts, code blocks, underline, strikethrough (PR #103). Custom callout extension (`tiptap-callout.ts`), link popover, shared `CALLOUT_CONFIG`, centralised `isValidHttpUrl()`.
  - [x] Full-page editor routes replacing dialog: `/[categorySlug]/new` and `/[articleSlug]/edit` (PR #104). Deleted `article-form-dialog.tsx`. Reserved "new"/"edit" slugs.
  - [x] Article outline sidebar (table of contents): `extractHeadings()`, `slugifyHeading()`, IntersectionObserver active tracking, two-column reading view (PR #105)

### Intranet Phase 5 — Resources Overhaul (5 PRs)
- [x] **PR 1 — Soft-Delete + Kebab Menus + Featured Articles** (PR #109): Migration 00049, soft-delete with 30-day bin, "..." kebab menus on all resource components, featured articles section (max 3, horizontal cards), `/resources/bin` route, auto-purge scheduled task. 1058 tests.
- [x] **PR 2 — Category Restructuring + Move Articles + Icon Picker + Landing Page** (PR #110): Migration 00050, merge "How-to Guides" → "Guides", `icon_colour` column, Notion-style icon picker popover (46 curated Lucide icons, 8 colour swatches, search, categorised grid), redesigned category form dialog, Bin relocated from toolbar to sidebar (Notion/Google Drive pattern), move article between categories, category reordering
- [x] **PR 3 — Editor Tooltips + Toolbar Enhancements** (PR #113): Google Docs-style dark pill tooltips on all 25+ buttons, heading dropdown (Normal text + H1-H4), subscript/superscript, alignment, checklist, indent/outdent, text colour (11 colours), highlight (9 colours), undo/redo, clear formatting, 8 new Tiptap extensions, renderer support for all new node types/marks. Post-merge fixes: checklist CSS (Tiptap v3 DOM attributes), Vercel build (optional props for useEditorState null), reactive indent/outdent disabled state, reactive heading dropdown.
- [x] **PR 3a — Auto-Save for Article Editor** (PR #114): Notion-style debounced auto-save (5s after last change). `useAutoSave` hook with state machine + concurrent save protection + `savePromiseRef` for flushSave race condition fix. `SaveStatusIndicator` (unsaved/saving/saved/error). Create→edit transition (first save creates draft, subsequent saves update). `beforeunload` safety net. 15 new tests. 1073 total.
- [ ] **PR 4 — Image Upload via Supabase Storage**: File upload + drag-and-drop + clipboard paste, URL fallback, `resource-images` bucket
- [ ] **PR 5 — File Attachments**: `resource_article_attachments` table, downloadable files at bottom of articles, MIME type icon mapping

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

### Resources Module Restructure (In Progress — 4 PRs)
- [x] **Pre-req — Broaden Systems Admin Permissions** (PR #127): Migration 00052. Systems admins can grant `is_ld_admin`, `is_systems_admin`, `is_line_manager`, `is_content_editor`. HR Admin + department remain HR-admin-only. Updated `protect_admin_fields()` trigger and `PermissionsEditDialog`.
- [x] **Pre-req — Remove Pathways Coordinator User Type** (PR #130): Migration 00053. `pathways_coordinator` → `staff` + `is_external = true`. `is_internal_staff()` DB function for visibility RLS. `has_module_access()` uses `is_external`. `is_external` added to JWT claims. Proxy redirect loop fix for new_user. 25 app files updated.
- [x] **PR A — Content Editor Permission** (PR #128): Migration 00054. `is_content_editor` column, `requireContentEditor()` auth gate, updated RLS (8 policies), JWT claims sync, `protect_admin_fields`. All 16 resource actions migrated from `requireHRAdmin()` to `requireContentEditor()`. Permissions dialog adds Content Editor toggle.
- [ ] **PR B — Subcategories + Visibility** (PR #131): Migration 00055. `parent_id` for 2-level hierarchy, `visibility` on categories and articles (`all` | `internal`), depth constraint, `VisibilityBadge` shared component, category form with parent selector and visibility toggle.
- [ ] **PR C — Route Migration**: `/intranet/resources` → `/resources` (top-level sidebar module). Redirect in proxy.
- [ ] **PR D — New Taxonomy + Polish**: 9-category taxonomy replacing flat 4-category structure. Seed data.

### Intranet Phase 6 — Surveys + Universal Search
- [ ] Full survey module: multi-question, 5 question types, anonymous option, results dashboard
- [ ] Cmd+K universal search palette: posts + resources + people (PostgreSQL FTS)

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
