# MCR Pathways Intranet — Development Plan

> **Living document** — updated as features are completed and priorities shift.
> For HR-specific roadmap, see [docs/hr-plan.md](./hr-plan.md).
> Last updated: 2026-04-17

---

## Completed Modules

### Learning & Development (Overhaul complete — replaced LearnDash)
- **Original V1** (complete): Course catalogue, enrolment, progress tracking, compliance alerts, admin CRUD/reports
- **Overhaul** (complete): Full LMS rebuild. See `docs/learning-overhaul.md` for comprehensive handover.
  - Phase 1 (complete): Migrations (00060-00070), shared utilities, section CRUD actions
  - Phase 2 (complete): Admin UI (Tiptap editor, DnD, auto-save, preview), learner UI (Complete and Continue, progress bars), certificates (PDF), section quizzes
  - Phase 3 (complete): Reporting & assignments (individual assignment, course duplication, manager compliance)
  - Tool Shed (complete): Social learning feed (Digital Postcards, 3-2-1 Model, 10-Minute Takeover). 6 components, JSONB content, format configs. PR #176.
  - Email notifications: ACTIVE (PRs #175, #198, #200, #201). Immediate send, XSS-safe, branded logo + preheaders.
  - Phase F (complete): Learner polish (PRs #187-194). Dashboard merge, catalogue card polish, lesson sidebar sections, catalogue search, certificate redesign (Coursera-inspired), admin guardrails (certificate toggle, publish warnings), syllabus preview, completion celebration (confetti). Migration 00072.
  - Key changes: Course→Sections→Lessons, section quizzes, certificates (PDF), Tool Shed, global Cmd+K search, private course feedback

### Sign-In / Working Location (v2 complete)
- Schedule-based weekly working location planner (replaced daily sign-in)
- Interactive month calendar with day detail panel (Google Calendar–inspired)
- Recurring weekly patterns with one-click apply
- Google Calendar sync (read + write-back) with domain-wide delegation
- Team schedule grid + team calendar with member filtering (managers)
- Kiosk check-in for office arrival confirmation
- Daily reconciliation banners, reports with CSV export

### Induction System- 9-step induction checklist with DB persistence (`/intranet/induction`)
- Auto-redirect when complete, server-side verification

### News Feed & Content- Post composer with Tiptap rich text, @mentions, attachments, link previews
- Reactions, editing, deletion, pin/unpin, comment notifications
- Inline polls (custom duration, multi-select, close early, CSV/XLSX/PDF export)
- Weekly roundup banner, image lightbox

### Notifications- Real-time notification bell with unread badge
- Mark as read / mark all as read
- Course publish notifications via RPC

### HR Module (Phase 1+2 complete)
- Phase 1: User management, profile, leave, assets, compliance, key dates, dashboard
- Phase 2: Absence, RTW, leaving, flexible working, permissions, org chart, my team, onboarding
- See [docs/hr-plan.md](./hr-plan.md) for Phase 3 roadmap

### Resources — Google Docs (complete)
- Google Docs integration (link, sync, webhook auto-update)
- Category hierarchy (9 top-level, 43+ subcategories, cascading selects)
- Component pages (org chart under Org Structure)
- Algolia search (section-level indexing, deep linking)
- Contextual editor affordances (kebab menus, drafts pill, per-surface actions), settings page, featured articles
- UX redesign: grouped index, scroll-spy TOC, freshness indicators, "More in [folder]" sibling nav
- Drafts governance (WS1): draft visibility restricted to content editors (not HR admins), `/resources/drafts` view, unpublish-clears-featured, Postgres 23505 handling on slug collisions, drafts excluded from recently-viewed
- Editor affordances (WS2): global editor-mode toggle killed, replaced with contextual kebab menus on cards/articles, drafts pill in page header, 404 outline button contrast fixed
- Landing polish (WS3): category card metadata dropped for consistency, "Updated" date prefix standardised, grid changed to sm:2/md:3/lg:4, Recently Updated promoted above Browse by Category, editor-only featured placeholder, heading-in-grid to prevent empty sections, Key Resources section deduplicated
- Article reading (WS4): sticky TOC offset fixed (top-6 to top-20), TOC card surface added, ArticleBreadcrumb extracted from 3 views (fixed ComponentArticleView "Home" bug + missing category icon), heading indent baseline made dynamic
- Search (WS5): config-as-code script for Algolia (searchableAttributes, snippets, distinct dedup), content snippets rendered in global search, highlight contrast improved (amber-100 to amber-200/60)
- Long-tail polish (WS6): dead code deletion (-1,100 lines), exhaustive-deps fix, dynamic icon consistency, featured system removed entirely, landing redesigned (categories first, Finder-style zebra table for Recently Updated), per-user bookmarks (DB table, server actions, toggle on articles + category lists, dedicated /resources/bookmarks page), header actions redesigned (Bookmarks button for all users with teal icon, outline+bg-card, consistent height), button intent system (success variant for Publish/Approve, outline contrast fix, active:scale-95 tap animation), table-04 pattern adopted system-wide (rounded striped tables, odd:bg-muted/50)

### Resources — Native Editor (WS5 complete)
- Plate editor for creating articles directly on the intranet (not linked from Google Docs)
- Two content paths coexist: Google Docs for living documents, native editor for static reference content
- WS2 (complete): Editor foundation (Plate packages, PlateStatic renderer, create/edit flows, draft/publish, auto-save, search-and-link, concurrent editing warning)
- WS3 (complete): Block plugins (callout, table, columns, toggle). Insert dropdown, manual Save button, HTML serialisation pipeline, static plugin extraction
- WS4 (complete): Media and files. Drive upload + proxy + resource_media whitelist + UPDATE RLS policy (migration 00078). Image (dialog + paste with dimensions + useUploadHandler hook), video embed (YouTube/Vimeo with nocookie + edit/delete toolbar), file attachment (PDF/Word/Excel/PowerPoint/text). Static renderers with icon parity, accessibility (aria-labels, iframe titles), CLS prevention, Algolia removal on soft-delete, findPath consistency across all elements, 23 new tests.
- WS5a (complete): Visual parity. Card wrapper, TOC sidebar, heading deep-links, freshness indicator, breadcrumbs, Supabase Realtime for native articles. Shared article-constants.ts, useScrollSpy hook, refactored ArticleOutline. Table/video/column/image styling aligned. Image alignment (left/centre/right) in editor + static renderer. Google Docs sanitiser preserves image alignment. Category dropdown bug fixed. Jotai deduplicated. 34 new tests.
- WS5b (complete): Cross-linking. Google Doc URLs rewritten to intranet articles via render-time parser. Google redirect URL unwrapping. LinkStatic handles internal links (relative + absolute intranet URLs) in same tab. extractDocId/extractFolderId extracted to client-safe google-doc-url.ts. Object.hasOwn for prototype pollution guard. APP_ORIGIN shared via article-constants.ts. UNIQUE partial index on google_doc_id (migration 00079). 14 new tests.
- WS6: Content migration (create articles from old WordPress intranet pages)
- Files stored on Google Drive via service account impersonation, served through proxy API route

### Algolia Search- 3 indices: resources_articles, learning_courses, tool_shed_entries
- Global Cmd+K search overlay with recent search management
- Faceted course catalogue
- Deep linking for resources (#sectionSlug) and Tool Shed (#entryId)

### Infrastructure- Security hardening (HSTS, CSP enforcing, auth redirect validation, timing-safe tokens, SECURITY DEFINER search_path)
- Proxy JWT optimisation (zero DB queries per authenticated request)
- React Compiler enabled, Turbopack FS caching
- 1,433 tests across 61 files (Vitest + RTL + jsdom)
- E2E setup (Playwright + local Supabase Docker, 18 tests)
- Structured logger ready for Sentry/Datadog swap

### UI/UX Polish- Collapsible sidebar (YouTube-style), shared PageHeader, breadcrumbs
- Colour/UX overhaul (neutral greys, cool grey background, brand colour palette)
- Table standardisation complete (all 21 data tables use one visual pattern: `bg-card rounded-xl border border-border shadow-sm overflow-clip`)
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
- [x] Notification preferences (email/in-app toggles) — PR #175
- [ ] Google Calendar connection toggle
- [ ] Theme/display preferences

### Infrastructure & Testing
- [x] Rate limiting on API routes (Upstash Redis, PR #163). Server action rate limiting deferred — see `memory/rate-limiting.md`
- [ ] Error monitoring integration (Sentry/Datadog swap for `src/lib/logger.ts`)
- [ ] E2E test phases 2-3 (core module + HR module tests — currently 18 E2E tests for 55 pages)
- [ ] Mobile responsiveness pass (currently desktop/laptop only)
- [ ] CI/CD pipeline (GitHub Actions for automated test runs, lint, type-check)
- [x] Regenerate `database.types.ts` from production Supabase — 70+ tables, typed clients, 72 type errors fixed
- [ ] Google Drive webhook renewal cron (7-day expiry, no auto-renewal)
- [x] Resend email activation (domain verification + env vars) — PRs #175, #198, #200, #201

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
- [x] Rate limiting on API routes (Upstash Redis, PR #163)
- [ ] Server action rate limiting (deferred — needs try/catch in 13 action files first, see `memory/rate-limiting.md`)
- [ ] Error monitoring integration (swap logger transport)
- [ ] Mobile responsiveness
- [x] `database.types.ts` regeneration — 70+ tables, typed clients, post-process script
- [ ] Google Drive webhook renewal cron (watch channels expire after 7 days)
- [ ] CI/CD pipeline (GitHub Actions — currently relies on Vercel Git integration only)
- [ ] Absence records soft-delete (currently hard-deletes, no audit trail)
- [ ] Large action file splitting — flexible-working (1,241 lines), onboarding (1,192 lines), absence (1,012 lines)
- [x] Tool Shed popular tags DB aggregation (moved to PostgreSQL RPC — migration 00070)
- [x] Tool Shed card & feed UX overhaul (PR #185): format accent borders, event title redesign, 3-2-1 violet→emerald, search_text column, end-of-feed indicator, filter transitions
- [ ] Tool Shed dialog & draft UX (PR 2, planned): partial draft saves, character counters, unsaved changes warning, draft toggle discovery

---

## Test Accounts

| Account | Type | Auth |
|---------|------|------|
| `test.worker@mcrpathways.org` | Admin | Magic link |
| `abdulmuiz.adaranijo+test2@mcrpathways.org` | Staff (Full Test) | Magic link |
| `test.practice@mcrpathways.org` | External staff (is_external) | Magic link |
