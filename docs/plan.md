# MCR Pathways Intranet — Development Plan

> **Living document** — updated as features are completed and priorities shift.
> For HR-specific roadmap, see [docs/hr-plan.md](./hr-plan.md).
> Last updated: 2026-06-03

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
- WS6 (in progress): Content migration from old WordPress intranet. An Import HTML editor mode converts Old Intranet HTML through a parsing walker (`src/lib/wp-migration/html-to-plate.ts`) into Plate JSON, with cross-article asset dedup and a batch-loop driver iterating audited content bits. Each old WP page goes through a design review before content is walked. The editorial pass on a migrated article runs a five-step workflow per page, sequentially — PLAN (commit a checklist to the page's audit row), APPLY (edit at `/resources/article/{slug}/edit`), VERIFY (three lenses: DOM heading structure, visual screenshots, search-query landing test), SIGN-OFF (post artefacts and wait for explicit go-ahead), MARK DONE (update the audit row). Codified in `src/app/(protected)/resources/CLAUDE.md` so the workflow survives context clears. Status: pc-support, group-work, jargon, MVV, information-for-new-staff migrated end-to-end. Information-for-new-staff editorial pass DONE (2026-06-03; 16 toggles flattened to H3 inline, Algolia native-article record count went from 6 to 53 records across all native articles after the heading-wrap fix landed in the same session). Group-work editorial pass IN PROGRESS. Pc-support PC Guidebook editorial pass and people-services (Bit 6) migration queued next.
- Plate toggle rebuilt from indent-based to container-based (parallel to WS6, not part of WS numbering): `toggle_v2` + `toggle_v2_summary` plugins replace the legacy `toggle` + `BaseTogglePlugin` + render-time `nestToggleChildren` inference. The container shape matches Elementor's Toggle widget on the OLD intranet — body lives inside the container as children, so closing the toggle structurally hides every block (images included). Storage converter walked 17 indent-shape toggles in `information-for-new-staff` into the container shape. Editor element renders the toggle title in `font-semibold` to match the static read view (WYSIWYG convention captured in `src/app/(protected)/resources/CLAUDE.md`).
- Files stored on Google Drive via service account impersonation, served through proxy API route

### Algolia Search- 2 indices in code: resources_articles, learning_courses (tool_shed_entries code references removed with W5; production dashboard deletion is a separate manual step)
- Global Cmd+K search overlay with recent search management
- Faceted course catalogue
- Deep linking for resources (#sectionSlug)

### Infrastructure- Security hardening (HSTS, CSP enforcing, auth redirect validation, timing-safe tokens, SECURITY DEFINER search_path)
- Proxy JWT optimisation (zero DB queries per authenticated request)
- React Compiler enabled, Turbopack FS caching
- 1,546 tests across 71 files (Vitest + RTL + jsdom)
- E2E setup (Playwright + local Supabase Docker, 18 tests)
- Structured logger ready for Sentry/Datadog swap

### UI/UX Polish- Collapsible sidebar (YouTube-style), shared PageHeader, breadcrumbs
- Colour/UX overhaul (neutral greys, cool grey background, brand colour palette)
- Table standardisation complete (all 21 data tables use one visual pattern: `bg-card rounded-xl border border-border shadow-sm overflow-clip`)
- Tab bar redesign (underline variant), badge tonal redesign
- Brand colour refinement (link token, icon palette, avatar hash, Google avatar filter)

---

## Remaining Work

### Intranet redesign (in progress)

Multi-PR initiative responding to design feedback (April 2026). Full research and per-workstream PR proposals in [docs/intranet-redesign-research.md](./intranet-redesign-research.md). Anti-bland frontend playbook (referenced before any UI work) in [docs/frontend-design-playbook.md](./frontend-design-playbook.md).

- [x] **W1** — Width sweep + DailyBanner alignment with centre column on `/intranet`. New `src/lib/layout.ts`, `--centre-column` CSS variable, AppLayout wrapper. PR #284.
- [ ] **W2** — 3-column home layout. Adds right rail (~312px, sticky) on `/intranet` only. Visible at xl (≥1280px); hidden at lg/md/sm with a tab fallback inside the feed page at md. **Right-rail content depends on W6's rescoping — see W6 note.**
- [x] **W3** — original "greeting + attention banner" plan. Pivoted to **W3-rev** (notification centre overhaul + quiet greeting + DailyBanner retirement). See `memory/intranet-design-feedback.md` for the locked scope. Shipped across PRs #289 (.1a), #292 (.1b), #293 (.2a), #294 (.2b), #295 (.3), #296 (.4).
- [x] **W4** — Originally scoped as "type-pill differentiation on feed cards"; expanded into a full post-type taxonomy + Kudos compose + post-publish kudos editor. Shipped across PRs #298 (backend + render + compose + Pin-to-corner-icon + notification click-to-clear) and #299 (post-publish editor reuse). Six humanizer-vetted Kudos categories, multi-recipient cap of 10, yellow strip + KudosHeader as the type signal (matches the "single signature accent" pattern from the Viva Engage 2023 "less decoration" research). Post-type discriminator + reserved slots for Tool Shed types (W5) and Announcement (W4b — see below). See `memory/kudos-feature.md`.
- [~] **W4b** — Announcement post type. Attempted 2026-05-11 (PR #300, branch `feature/w4b`); scratched at Colin's direction before merge. Research + design decisions preserved in `memory/announcement-deferred.md` for revival. The schema slot is reserved in 00095's CHECK whitelist so a future revisit doesn't need a new migration to register the type. Triggers for revival documented in the memory file.
- [x] **W5** — Tool Shed cleanup pass. Shipped as a cleanup-only PR after a row-count check on 2026-05-11 found 5 entries, all test fixtures. The substantive composer + schema + renderer + notification work that the original W5 scope envisioned moved into W7 (see below). Migration 00096 dropped `tool_shed_entries`. The `/learning/tool-shed` page + actions + components, sidebar nav link, Cmd+K integration, `TOOL_SHED_INDEX` constant, and production Algolia index entry are all gone. The three reserved `post_type` slots in 00095's CHECK whitelist stay so W7 can repopulate them without a new migration.
- [ ] **W6** — Quick-actions rail. **Needs rescoping after W3-rev.** Original audit (in research doc §1) had ~half its candidates absorbed by the bell: working_location, office arrival confirmation, resume next compliance course, open weekly roundup, approve pending leave — all now state rows in the bell with inline actions. The remaining quick-action candidates are pure navigation shortcuts (Book leave, Submit absence, Find a colleague, etc.) — that's a smaller surface, may fold into W2's right rail rather than warranting its own workstream. Re-audit before scoping.
- [ ] **W7** — Composer + feed-layout audit. Originally scoped as "3-step modal: type picker → form → preview & send". Expanded 2026-05-11 to a full review of whether the composer and feed-layout primitives are fit-for-purpose for every post type the system should support (News / Kudos / Postcard / 3-2-1 / Takeover / any future types). Now also absorbs the substantive Tool Shed work originally scoped for W5: `tool_shed_meta` schema column + consistency CHECK, render branches in `post-card.tsx`, `tool_shed` notification source kind + default-on preference, fan-out. Needs its own research phase before scoping (peer-platform review of LinkedIn / Workplace / Viva / Slack / Notion / Polaris, decisions on entry-point shape and per-type form structure) — same shape as W3-rev and W4 planning.
- [ ] **W8** — Postcard signature card (3D flip; scoped Source Serif 4 + Story Script + Special Elite to the postcard surface only). Independent.

### Design constraints from W3-rev

These now apply to all future intranet work:

- **No coloured banners above the page H1 for routine actions.** Polaris's banner rule ("not the primary entry point to information or actions merchants need on a regular basis") is the cleanest external anchor — see `docs/ui-ux-principles.md` §11 for the full reasoning and supporting design-system citations. Attention items route through bell + `source_kind` + `/notifications`.
- **The bell is the single attention surface.** Splitting attention between bell and an in-page panel is an anti-pattern.
- **`SOURCE_KIND_MODULE` in `src/lib/notifications.ts` is canonical.** Adding a new notification source kind requires adding it to the module map (HR / Learning / News / Mentions / Sign-In).
- **Saved notifications bypass the 30-day Cleared retention sweep.** Any background job touching the `notifications` table must respect `is_saved=true`.
- **`/admin` rename DROPPED.** A pure rename only fixes half the admin surface (HR/Systems → `/hr`, L&D-only → `/learning/admin/courses`); a unified `/admin` index would be a separate workstream worth doing only if/when admin sub-pages multiply or users complain. No active TODO.

**Adjacent workstreams surfaced during W3-rev planning (not yet sequenced):**
- [ ] **Digest summary email for pile-up notifications.** Pronto-on-event is already covered by existing Resend triggers. Pile-up scenario (user away for two weeks comes back to N items) needs a separate digest email cadence — single email summarising accumulated items rather than N individual emails. New cron + template work.

**Adjacent workstreams surfaced during W5 planning (not yet sequenced):**
- [ ] **Unified `intranet_feed` Algolia index** that indexes news posts. Cmd+K now covers `resources_articles` + `learning_courses` only — news posts are not indexed. A unified `intranet_feed` index would extend search to all news posts (Kudos included, and any post types W7 introduces). Scope: new Algolia index + indexing/removal hooks in the intranet actions file + deep-link routing from Cmd+K results. Reversible — easy to add later.

  **Triggers for picking this up:** (1) W7 lands and the composer puts more mixed content in the feed, increasing the surface area Cmd+K should cover; (2) periodic sync after first month of post-launch usage shows search coverage gap matters; (3) we add a third post type that warrants global findability. Until at least one trigger fires, leave Cmd+K covering only resources + courses.

### Recommended next pickup order

W6 re-audit → W2 → W7 → W8.

W4 is shipped; W4b is deferred; W5 shipped as the cleanup-only retirement. W6 needs the fresh audit (write down what survives now that the bell took half the candidates). W2 lands with a clear right-rail purpose. W7 then does the substantive composer + layout audit that the original sequencing had as a small modal redesign — now the proper "every post type is first-class" workstream that pulls in the Tool Shed runway (schema column, renderer, notifications) since none of that should pre-commit shape before W7's research phase.

### HR Phase 3
- [ ] Surveys & pulse checks
- [ ] DEI / equality monitoring
- [ ] Performance: 1-to-1 records, objectives
- [x] ~~Praise / shout-outs~~ — shipped as Kudos (Intranet module, not HR). See `memory/kudos-feature.md`.
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
- [x] Google Drive webhook renewal cron — Supabase pg_cron (migration 00083), PR #260. Drive returns ~24h-lifetime channels in practice; daily 03:00 UTC renewal handles all linked docs.
- [x] Google Doc source-edit time tracked for drift signalling — `google_doc_modified_at` column (migration 00084). Three-state kebab header: in-sync / drift / never-synced. PRs #262, #263.
- [x] Admin Drive Watches dashboard at `/resources/settings` — linked docs table + recent renewal runs + per-row Sync/Unlink. PR #265.
- [x] Per-article sync failure surface — `last_sync_error` column (migration 00085) + red "Sync failed" badge on dashboard and kebab header. Dashboard default sort groups attention-needed rows at the top. PR #266.
- [x] Resend email activation (domain verification + env vars) — PRs #175, #198, #200, #201

### Larger Features
- [ ] Kiosk PWA — see `memory/kiosk-overhaul.md` for full requirements
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
- [x] Google Drive webhook renewal cron — Supabase pg_cron, PR #260
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
