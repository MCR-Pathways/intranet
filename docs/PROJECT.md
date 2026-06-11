# MCR Pathways Intranet — Project Documentation

> **Owner:** Abdulmuiz Adaranijo
> **Status:** Active development
> **Last reviewed:** 2026-06-05

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Getting Started](#getting-started)
4. [Architecture](#architecture)
5. [Modules](#modules)
6. [Database](#database)
7. [Authentication & Authorisation](#authentication--authorisation)
8. [Security](#security)
9. [Testing](#testing)
10. [Deployment & Infrastructure](#deployment--infrastructure)
11. [Key Files Reference](#key-files-reference)
12. [Architecture Decision Records](#architecture-decision-records)
13. [Known Issues & Technical Debt](#known-issues--technical-debt)
14. [Future Work](#future-work)
15. [Changelog](#changelog)

---

## Project Overview

The MCR Pathways Intranet is an internal web application that replaces BreatheHR for MCR Pathways, a Glasgow-based charity. It serves as the organisation's central platform for HR management, learning and development, internal communications, and office working location tracking.

**Key facts:**
- Replaces BreatheHR for all HR functions
- Users are Glasgow City Council employees with `@mcrpathways.org` Google Workspace accounts
- Desktop-only (mobile-responsive pass planned for future)
- Hosted on Vercel, database on Supabase (PostgreSQL)

**Who uses it:**
- **Staff (internal)** — full access to all modules (HR, Sign-In, Learning, Intranet, Resources)
- **Staff (external / Pathways Coordinators)** — `is_external = true`, access to Learning, Intranet, and Resources only
- **New Users** — induction flow only until completed

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript (strict mode) | 5.x |
| UI | React | 19.2.3 |
| Styling | Tailwind CSS v4 | 4.x |
| Components | Shadcn/Radix UI | 13 Radix primitives |
| Icons | Lucide React | 0.563.0 |
| Database | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth (Google OAuth + email OTP) | — |
| Rich Text | Tiptap (full suite: headings, bold, italic, underline, strikethrough, links, lists, tables, images, callouts, code blocks, @mentions) | 3.20.0 |
| Data Tables | TanStack React Table | 8.21.3 |
| Charts | Recharts | 3.7.0 |
| Org Chart | react-d3-tree | 3.6.6 |
| Google APIs | googleapis (Calendar + Drive integration) | 171.4.0 |
| Search | Algolia (algoliasearch + react-instantsearch) | — |
| HTML Parsing | html-react-parser | — |
| Toasts | Sonner | 2.0.7 |
| Command Palette | cmdk | 1.1.1 |
| Testing | Vitest + React Testing Library + jsdom | Vitest 4.x |
| E2E Testing | Playwright | 1.58.2 |

---

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm
- A Supabase project (or local Supabase CLI setup)
- Google Workspace domain access for OAuth testing

### Environment Variables

Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For Google Calendar integration, see `docs/google-calendar-setup.md`.

### Running Locally

```bash
npm install              # Install dependencies
npm run dev              # Start dev server on localhost:3000
```

### Running Tests

```bash
npm test                 # Single run
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
npm run test:e2e         # Playwright E2E tests
```

### Database Migrations

```bash
DATABASE_URL="postgresql://..." node scripts/run-migrations.mjs
DATABASE_URL="postgresql://..." node scripts/run-migrations.mjs --check-only  # Health check only
```

Migration files are in `supabase/migrations/` and run in numeric order (98 files, `00001` through `00097` plus a combined migration).

### Local Supabase

Config is in `supabase/config.toml`. Local ports: API 54321, DB 54322, Studio 54323, Inbucket 54324.

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────┐
│                   Vercel (Hosting)               │
│  ┌─────────────────────────────────────────────┐ │
│  │            Next.js 16 App Router            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐ │ │
│  │  │  Server   │  │  Server  │  │  API      │ │ │
│  │  │Components │  │ Actions  │  │  Routes   │ │ │
│  │  └────┬─────┘  └────┬─────┘  └─────┬─────┘ │ │
│  │       │              │              │       │ │
│  │       └──────────────┼──────────────┘       │ │
│  │                      │                      │ │
│  │              ┌───────▼────────┐             │ │
│  │              │  Proxy (auth   │             │ │
│  │              │  + middleware)  │             │ │
│  │              └───────┬────────┘             │ │
│  └──────────────────────┼──────────────────────┘ │
└─────────────────────────┼───────────────────────┘
                          │
              ┌───────────▼───────────┐
              │   Supabase             │
              │  ┌─────────────────┐  │
              │  │   PostgreSQL    │  │
              │  │   + RLS + RPCs  │  │
              │  └─────────────────┘  │
              │  ┌─────────────────┐  │
              │  │   Auth (OAuth   │  │
              │  │   + Magic Link) │  │
              │  └─────────────────┘  │
              │  ┌─────────────────┐  │
              │  │   Storage       │  │
              │  │   (Attachments) │  │
              │  └─────────────────┘  │
              └───────────────────────┘
                          │
              ┌───────────▼───────────┐
              │  Google Workspace      │
              │  (Calendar sync via    │
              │   domain-wide deleg.)  │
              └───────────────────────┘
```

### Route Groups

- `(auth)/` — Public routes: `/login`, `/auth/callback`, `/auth/confirm`
- `(protected)/` — Authenticated routes with `AppLayout` (header + sidebar)

### Data Flow

1. **Server Component** calls `getCurrentUser()`, fetches data via Supabase, passes props to Client Components
2. **Client Components** use `useState`/`useMemo` for UI state, call Server Actions via `useTransition()`
3. **Server Actions** (in `actions.ts` files) authenticate, sanitise inputs, mutate DB, call `revalidatePath()`

### Supabase Client Pattern

| Context | File | Use |
|---|---|---|
| Server Components / Server Actions | `src/lib/supabase/server.ts` | Data fetching, mutations |
| Client Components | `src/lib/supabase/client.ts` | Real-time subscriptions only |
| Middleware (proxy) | `src/lib/supabase/middleware.ts` | Session cookie refresh |
| Admin operations (migrations) | `src/lib/supabase/service.ts` | Service role access |

**Critical rule:** Never use the browser Supabase client for mutations — they hang indefinitely. All writes go through Server Actions.

### Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

---

## Modules

### HR Module (Phase 1 + 2 complete, Phase 3 planned)

The largest module. Provides employee self-service and HR admin functionality.

**Routes:** 21 pages under `/hr`

| Feature | Route | Key Files |
|---|---|---|
| Dashboard | `/hr` | Admin-only dashboard (non-admins → `/hr/profile`) |
| User Management | `/hr/users`, `/hr/users/[userId]` | 7+ tabs per user |
| My Profile | `/hr/profile` | 4 tabs (overview, personal, documents, history) |
| Leave Management | `/hr/leave`, `/hr/calendar` | Self-service requests, HR recording, approvals |
| Absence & RTW | `/hr/absence`, `/hr/absence/rtw/[formId]` | Return-to-work forms, Bradford Factor |
| Assets | `/hr/assets` | IT equipment tracking |
| Compliance | `/hr/compliance` | Document expiry tracking |
| Key Dates | `/hr/key-dates` | Probation, anniversaries |
| Departments | `/hr/departments` | Org structure |
| Flexible Working | `/hr/flexible-working` | Statutory FWR requests |
| Leaving | `/hr/leaving` | Offboarding checklists |
| Onboarding | `/hr/onboarding` | New starter checklists |
| Org Chart | `/resources/article/org-chart` | Visual tree (react-d3-tree), relocated to Resources as component page. 308 redirect from `/hr/org-chart`. |
| My Team | `/hr/team` | Line manager team view |

**Server Actions:** 27 action files
**Components:** 68 files in `src/components/hr/`
**Shared config:** `src/lib/hr.ts` (938 lines — leave types, statuses, formatters, constants)

For the detailed HR roadmap, see `docs/hr-plan.md`.

### Learning & Development Module (Phase 1+2+3 complete)

Replacing LearnDash (WordPress LMS) with a custom-built LMS. Section-based courses with section quizzes, learner UI, certificate auto-issue, completion notifications, 4 lesson types (text, video, slides, rich_text), and `auth.uid()` RPC enforcement. See `docs/learning-overhaul.md` for comprehensive handover document.

**Status:** All phases complete and merged. Course overhaul (PR #167-168), UX phases A-E (PRs #172-176), Algolia search (PRs #177-178). Migrations 00060-00070 applied. Email notifications active. The Tool Shed module (Postcards / 3-2-1 / Takeover) was retired in W5 (2026-05-11) — its three `post_type` slots stay reserved in 00095's CHECK whitelist for W7 to repopulate alongside the broader composer + feed-layout audit.

**Routes:** 9 pages under `/learning`

| Feature | Route |
|---|---|
| Dashboard | `/learning` |
| Course Catalogue | `/learning/courses` |
| Course Detail | `/learning/courses/[id]` |
| Lesson View | `/learning/courses/[id]/lessons/[lessonId]` |
| Section Quiz | `/learning/courses/[id]/sections/[sectionId]/quiz` |
| My Learning | `/learning` |
| Admin: Courses | `/learning/admin/courses` |
| Admin: Course Detail | `/learning/admin/courses/[id]` |
| Admin: Reports | `/learning/admin/reports` |
| Certificate PDF | `/api/certificate/[id]/route` |

**Planned routes (not yet built):** `/learning/certificates` (certificate wall), `/learning/certificates/[id]`

**Key components (Phase 3):** `section-accordion.tsx` (expandable sections in course detail), `section-quiz-player.tsx` (quiz UI with `submit_section_quiz_attempt` RPC), `lesson-renderer.tsx` (renders text/video/slides/rich_text lessons), rewritten `lesson-sidebar.tsx` (section-grouped, LinkedIn-style checkmarks).

**Key changes in overhaul:** Course→Sections→Lessons hierarchy, section quizzes (gate progression), 4 lesson types (text, video, slides, rich_text), PDF certificates (auto-issued via DB trigger on course completion), completion notifications (DB trigger), `auth.uid()` enforcement on all RPCs, admin content builder (Tiptap, DnD, auto-save, preview), individual assignment, course duplication, manager compliance views, Algolia search (course index), global Cmd+K search. Email notifications active.

**New DB tables:** `course_sections`, `section_quizzes`, `section_quiz_questions`, `section_quiz_options`, `section_quiz_attempts`, `certificates`, `course_feedback`, `email_notifications`. Migrations 00060-00068. (`tool_shed_entries` was dropped in W5.)

**Migrations 00065-00068:** `00065` reconciliation (clean up old quiz tables, add slides/rich_text to lesson_type CHECK), `00066` delete empty courses, `00067` certificate auto-issue trigger (`generate_certificate_on_completion`), `00068` completion notification trigger.

**New dependencies:** `@react-pdf/renderer`, `resend`. New env var: `RESEND_API_KEY`.

### Intranet Module (complete)

Internal communications — news feed, resources/knowledge base, and induction.

**Routes:** 24 pages under `/intranet` + `/resources` (17 + 7, including induction sub-pages, resource catch-alls, and editor-only views)

| Feature | Route |
|---|---|
| News Feed | `/intranet` |
| Weekly Roundup | `/intranet/weekly-roundup` |
| Induction Hub | `/intranet/induction` (9 sub-pages) |
| Post Detail | `/intranet/post/[id]` (standalone permalink) |
| Resources Landing | `/resources` |
| Category View | `/resources/[...slug]` (1-3 level catch-all) |
| Article View | `/resources/article/[slug]` (flat, globally unique) |
| Settings (editor) | `/resources/settings` |

**Key features:** Rich text posts (Tiptap), @mentions with notifications, reactions, comments, link previews with SSRF protection, image lightbox, file attachments, pin/unpin (HR admin), weekly roundup, Kudos post type.

**Kudos post type.** Recognition posts addressed to one or more named recipients (cap 10) with a required category and a free-text message. Six categories — Going the extra mile, Team player, Bright idea, Came through, Always there, Thank you — sized below Hick's-law fall-off to keep the picker fast. Compose surface is a dedicated `KudosCreateDialog` (kudos is structurally different from regular posts so it doesn't share the rich-text + attachments + poll machinery), opened from an Award chip in the composer action bar. Visual signal in the feed is a yellow 4px top strip + a `KudosHeader` reading "[Sender] sent kudos to [Recipients] for [Category]"; recipient names are the focus (they're why the post exists), sender attribution sits at 60% opacity in the bottom-right. Notifications go to every recipient via the bell (Mentions module pill — same conceptual category as @-mentions). Post-publish editing reuses the same dialog with an `editTarget` prop: category locked as a static chip, existing recipients locked with a small Lock icon in place of ×, message editable, new recipients can be added up to the cap. Existing recipients are NOT re-notified on edit (Slack thread pattern — don't ping for someone else's status change); newly-added recipients do get a bell row. Schema in migration 00095: `posts.post_type` discriminator (CHECK whitelist), `posts.kudos_category` with consistency CHECK, `post_kudos_recipients` join table with CASCADE FKs + RLS.

**Pin moved to corner icon.** Previously rendered as an inline "Pinned" Badge in the post header. As of W4 the inline-badge slot is content-type semantics (Round Up, future Announcement-style labels) and pinning is signalled by a Pin icon top-right of the card next to the kebab — matches the LinkedIn / Reddit / Teams / Instagram corner-pin convention. Unpin action still lives in the kebab. HR-admin pin/unpin permissions unchanged.

**News-feed media on Google Drive.** Posts back image and document attachments via the service-account Drive (folder structured `YYYY/MM`, auto-created on demand). The `/api/drive-file/[fileId]` proxy authenticates the user, looks the file up across `resource_media` / `post_attachments` / `news_feed_media` (the staging table that lets pre-post composer thumbnails resolve), and streams the bytes from Drive. Image pipeline strips EXIF, bakes in orientation, converts HEIC/HEIF to JPEG via heic-convert, converts Apple ProRAW DNG via Sharp's TIFF path, rejects camera RAW with a friendly error. File caps held at 4 MB by Vercel Hobby's platform limit; revisit on Pro upgrade.

**Document preview lightbox.** Click a document attachment in the feed and a modal opens with the file rendered in-place — PDFs through our proxy with `Content-Disposition: inline` (Chromium's native PDF viewer), DOCX/XLSX/PPTX/TXT/CSV through Drive's `/preview` URL (Drive viewer; files are domain-shared at upload so signed-in MCR users can load them). The modal adds no toolbar of its own — two floating frosted-glass buttons on the dark backdrop top-right (Open in new tab, Close) and the iframe's native chrome inside. Cards in the feed and the composer chip show file-type colour (Adobe red PDF, Word blue, Excel green, PowerPoint orange, slate for txt/unknown) via `FILE_TYPE_CONFIG` + `resolveFileType` from `src/lib/file-types.ts`. Image lightbox shares the same frosted-glass button style on its close + nav buttons. Page count for PDFs extracted at upload via `unpdf` and shown in the meta line ("PDF · 12 pages · 230 KB").

**Resources/Knowledge Base (redesigned):** Google Docs integration replaces Tiptap article editor. Content editors link Google Docs from Drive, HTML synced via webhooks, rendered with Tailwind `prose` classes. Native Plate editor for static reference content (two content paths coexist). The Plate editor uses a container-shape `toggle_v2` block — toggle title and body are siblings inside one node, so closing the toggle structurally hides every block inside (including images and files), matching the OLD intranet's Elementor Toggle behaviour. An Import HTML editor mode round-trips Old Intranet HTML through a parsing walker into Plate JSON for WordPress-to-intranet content migration. Native-article Algolia indexing uses a dedicated set of static heading components that render `<h2>`/`<h3>`/`<h4>` as direct body children rather than wrapped in `<div>`, so `parseHtmlIntoSections` finds every heading at the top level and one section is indexed per heading. Component page system for developer-created pages (e.g. org chart). Contextual editor affordances (kebab menus on cards, drafts pill in header, per-article Edit/Publish). Category grid with grouped index on category pages. Scroll-spy TOC, "More in [folder]" sibling nav. Settings page for folder registration, featured article curation, and category management. Algolia search with section-level indexing and deep links. Supabase Realtime for live content updates while viewing.

### Sign-In / Working Location Module (v2 complete)

Replaced the original daily sign-in with a schedule-based working location system.

**Route:** `/sign-in`

**Key features:** Weekly pattern planner, month calendar, Google Calendar sync (read + write-back via domain-wide delegation), team schedule grid (managers), kiosk check-in (`/kiosk`), CSV export. Working-location prompts now surface in the bell rather than as a page banner.

**Key files:** `src/lib/sign-in.ts` (shared types, config), `src/app/(protected)/sign-in/actions.ts`, `docs/google-calendar-setup.md`

### Notifications

**Route:** `/notifications`

Bell icon in header opens a popover (unified inbox). Bell footer "View all" links to a full `/notifications` page with three tabs (Inbox / Saved / Cleared), source-filter pills (HR / Learning / News / Mentions / Sign-In), and kebab-driven row actions.

**Architecture:** Notifications come from two paths — DB rows (event-style: leave decisions, mentions, course assignments) and persistent-state rows (computed live from underlying tables: pending leave approvals, overdue compliance, working-location prompts). Both render in the bell + Inbox tab as a single unified stream, deduped by `(source_kind, source_id)`.

**Verbs:** Single user-facing action — "Clear". Auto-Clear fires when a state resolves (e.g. manager approves a leave request → all related notifications clear automatically). Per-row Clear via kebab; bulk Clear via page-header kebab with a confirmation dialog. Saved notifications (manual pin) bypass the 30-day Cleared retention sweep so pinned items never disappear.

**Design philosophy:** Bell is the single attention surface — no in-page banners. Greeting on `/intranet` ("Good afternoon, Colin.") replaces the old "News Feed" page header.

---

## Database

### Overview

PostgreSQL on Supabase with Row Level Security (RLS) on all tables.

**98 migration files** in `supabase/migrations/`, numbered `00001` through `00097` plus a combined migration (numbering is contiguous).

**70+ tables** — key ones:

| Table | Purpose |
|---|---|
| `profiles` | User profiles (extends `auth.users`) |
| `teams` | Department/team structure |
| `manager_teams` | Line manager ↔ team assignments |
| `notifications` | In-app notifications |
| `courses`, `course_lessons`, `course_enrolments` | L&D module |
| `lesson_completions`, `quiz_*` | L&D progress + quizzes |
| `induction_progress` | Induction step tracking |
| `working_locations`, `weekly_patterns` | Sign-in module |
| `posts`, `post_comments`, `post_reactions` | News feed |
| `post_attachments`, `comment_reactions` | Feed extras |
| `weekly_roundups` | Auto-generated roundups |
| `resource_categories`, `resource_articles` | Resources section |

Plus HR tables (leave_requests, absence_records, return_to_work_forms, assets, asset_types, compliance_types, compliance_documents, key_dates, staff_leaving_forms, flexible_working_requests, fwr_appeals, onboarding_templates, onboarding_template_items, onboarding_checklists, onboarding_checklist_items, departments, employment_history, emergency_contacts), L&D overhaul tables (course_sections, section_quizzes, section_quiz_questions, section_quiz_options, section_quiz_attempts, certificates, course_feedback), email tables (email_notifications, email_preferences), and mention tables (post_mentions, comment_mentions).

### Database Functions (RPCs)

Key functions: `complete_lesson_and_update_progress`, `submit_section_quiz_attempt`, `generate_certificate_on_completion` (trigger), `generate_weekly_roundup`, `has_module_access`, `is_hr_admin`, `is_line_manager`, `notify_course_published`, `unpin_expired_roundups`, `get_popular_tags`, `is_hr_admin_effective`, `is_ld_admin_effective`, `is_systems_admin_effective`, `is_internal_staff`, `resolve_article_visibility`. All RPCs enforce `auth.uid()` for identity.

### Key Conventions

- **No `select("*")`** — always explicit column lists. Use `PROFILE_SELECT` from `src/lib/auth.ts` for profile queries.
- **TEXT + CHECK constraints** instead of PostgreSQL ENUMs (ENUMs cause transaction failures and are hard to modify).
- **All migrations are idempotent** (`IF NOT EXISTS` / `DROP IF EXISTS`).
- **`SET search_path = ''`** on all SECURITY DEFINER functions.
- **RLS policies with ownership checks**, not blanket `true`.

### Types

Auto-generated in `src/types/database.types.ts`. Regenerate after schema changes.

---

## Authentication & Authorisation

### Auth Flow

1. User visits `/login`
2. Signs in via Google OAuth (`@mcrpathways.org` only) or email magic link
3. OAuth callback at `/auth/callback`, email OTP at `/auth/confirm`
4. Proxy middleware (`src/proxy.ts`) checks auth on every request to `(protected)/` routes

### Proxy Middleware

The proxy (`src/proxy.ts`) runs on every request:
- Checks authentication (redirects to `/login` if unauthenticated)
- Fetches profile from JWT `app_metadata` (zero DB queries in fast path)
- Enforces module access by `user_type`
- Redirects users who haven't completed induction

### User Types & Module Access

| Module | `staff` (internal) | `staff` (external/PC) | `new_user` |
|---|---|---|---|
| `/hr` | Yes | No | No |
| `/sign-in` | Yes | No | No |
| `/learning` | Yes | Yes | No |
| `/intranet` | Yes | Yes | No |
| `/resources` | Yes | Yes | No |
| Induction | Yes | Yes | Yes (redirected) |

### Auth Helpers (`src/lib/auth.ts`)

- `getCurrentUser()` — returns `{ supabase, user, profile }` with sensitive fields excluded
- `requireHRAdmin()` — gate for admin-only server actions; throws if not admin

### JWT Optimisation

Frequently-checked profile fields (`user_type`, `status`, `induction_completed_at`) are stored in `auth.users.raw_app_meta_data` via a DB trigger on profiles. The proxy reads from `user.app_metadata` (zero DB queries). A DB fallback exists for sessions issued before this was implemented.

---

## Security

> **Last audited:** 2026-03-11 (comprehensive audit, PRs #106 + #107)

### Content Security Policy

Enforcing CSP on all routes (configured in `next.config.ts`):
- `img-src 'self'` — external images proxied through `/api/og-image` (feed link previews + article images)
- No `unsafe-eval` in production
- `unsafe-inline` retained for scripts/styles (Next.js hydration requirement; nonce-based CSP deferred)
- HSTS with 2-year max-age

### Security Headers

`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (restrictive).

### Auth Security

- **Domain restriction**: `@mcrpathways.org` enforced in OAuth callback, OTP confirm, and DB trigger
- **Redirect validation**: `next` query parameter validated (must be relative path, not protocol-relative) to prevent open redirects (PR #106)
- **Generic error messages**: Auth callbacks and API routes return generic errors to clients; details logged server-side (PR #106)
- **Timing-safe token comparison**: `timingSafeTokenCompare()` used for kiosk token and calendar webhook secret (PR #106)
- **Self-promotion prevention**: 3-layer defence — server action field deletion, DB trigger, RLS policies
- **CSRF protection**: Built-in via Next.js Server Actions (non-guessable action IDs + origin checking)

### Input Sanitisation

- **Server Actions whitelist fields** before DB writes (prevents column injection)
- **Tiptap renderer sanitises `href`** values to `http://https` protocols only (prevents stored XSS via `javascript:` URLs)
- **CSV exports sanitise cells** to prevent formula injection in Excel/Sheets
- **SSRF protection** on link preview fetching (private IP checks, redirect validation, SVG blocking, 2MB size limit) — `src/lib/ssrf.ts`
- **`Object.hasOwn()` guards** on Record lookups from user input (prevents prototype pollution)
- **Input validation hardening** (PRs #115-120): SVG upload removal, CSS hex colour validation, leave type validation, generic error messages (95 instances across 17 files), path traversal + UUID validation, 3-tier string length limits (SHORT 200, MEDIUM 2000, LONG 5000) on all HR free-text fields — shared utilities in `src/lib/validation.ts`

### RLS

Row Level Security on all tables with ownership-based policies. Junction tables verify the current user owns the parent record via `EXISTS` subqueries.

### SECURITY DEFINER Functions

All use `auth.uid()` for identity (never trust user-supplied IDs) and `SET search_path = ''` with fully qualified table references (early functions fixed in migration `00048`, PR #107).

### Remaining Security Work

- **Rate limiting** — no request throttling on API endpoints. Requires Upstash Redis for Vercel serverless.
- **Nonce-based CSP** — replace `unsafe-inline` with nonce-based CSP when the performance trade-off (forced dynamic rendering) is acceptable.

---

## Testing

### Test Suite

- **Framework:** Vitest 4 + React Testing Library + jsdom
- **Config:** `vitest.config.ts`, `vitest.setup.ts`
- **Files:** 70 test files, co-located with source files (`.test.ts` / `.test.tsx`)
- **Coverage:** 1,546 tests

### Test Categories

| Category | Count | Examples |
|---|---|---|
| Action tests | 21 | Server action validation, auth gating |
| HR component tests | 8 | Dialogs, tables, forms |
| News feed tests | 6 | Composer, reactions, comments |
| Lib tests | 8 | Utilities, sanitisation, URL handling |
| Hook tests | 3 | `useUser`, localStorage sync |
| Proxy test | 1 | Auth flow, module access |
| DataTable test | 1 | Sorting, filtering, pagination |

### Mocking Strategy

- **Server actions:** Mock `@/lib/auth` (`requireHRAdmin` / `getCurrentUser`), not the Supabase client
- **Proxy:** Mock `@/lib/supabase/middleware` (`updateSession`)
- **Use `vi.hoisted()`** for mock variables needed inside `vi.mock()` factories
- Reference patterns: `src/app/(protected)/hr/users/actions.test.ts`, `src/proxy.test.ts`
- Mock factory: `src/__mocks__/supabase.ts`

### E2E Tests

Playwright with 2 spec files (`auth-navigation.spec.ts`, `smoke.spec.ts`). Setup in `e2e/` folder.

### Known Test Gaps

- No E2E tests for multi-step HR workflows (18 E2E tests for a 60-page app)

---

## Deployment & Infrastructure

### Hosting

Vercel — automatic deployments from `main` branch.

### CI/CD

No GitHub Actions workflows configured. Deployments rely on Vercel's Git integration.

### Scheduled Jobs

All app crons run under Supabase pg_cron. Scheduled via `cron.schedule` in migration files; trigger source is `pg_net.http_get` hitting our own route handlers. Secrets (`app_base_url`, `cron_secret`) stored in Supabase Vault. Each handler writes a row to `public.cron_runs` on start and update on finish, so run history is SQL-queryable.

Current jobs:
- `renew-drive-watches` — 03:00 UTC daily
- `daily-reminders` — 07:47 UTC daily
- `process-emails` — 08:03 UTC daily

### Image Remotes

Allowed domains for `next/image`: `*.googleusercontent.com`, `*.supabase.co`.

### Error Monitoring

`src/lib/logger.ts` is a stub ready for Sentry/Datadog integration. Currently logs to console.

### Google Calendar Integration

Domain-wide delegation via Google service account. Setup documented in `docs/google-calendar-setup.md`. Webhook endpoint at `/api/calendar/webhook`.

### Google Drive Integration (Resources)

Service account impersonates `intranet-service-account@mcrpathways.org` via domain-wide delegation. Webhook endpoint at `/api/drive/webhook` with timing-safe token verification. Drive documents watch lifetime as "up to 7 days" but in practice issues ~24h channels; `renew-drive-watches` pg_cron (migration 00083) runs daily at 03:00 UTC and renews every linked doc each run. Shared auth in `src/lib/google-auth.ts`. Env vars: `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_DRIVE_WEBHOOK_SECRET`, `GOOGLE_DRIVE_ADMIN_EMAIL`. Each linked article stores a watch column triple: `google_watch_channel_id`, `google_watch_resource_id`, `google_watch_expires_at`.

### Algolia Search (Resources)

Client-side React InstantSearch. Section-level indexing (DocSearch pattern) for deep linking into articles. Indexing happens server-side in `drive-actions.ts` during link/sync/unlink. Env vars: `NEXT_PUBLIC_ALGOLIA_APP_ID`, `NEXT_PUBLIC_ALGOLIA_SEARCH_KEY` (public), `ALGOLIA_ADMIN_KEY` (server-only). App ID: `CFRPCC52U5`.

---

## Key Files Reference

### Configuration

| File | Purpose |
|---|---|
| `next.config.ts` | Next.js config, React Compiler, Turbopack FS caching, security headers, CSP, image remotes |
| `tsconfig.json` | TypeScript config, path aliases |
| `vitest.config.ts` | Test runner config |
| `supabase/config.toml` | Local Supabase config |
| `tailwind.config.ts` | Tailwind CSS config (v4 with `@theme inline`) |

### Core Application

| File | Purpose |
|---|---|
| `src/proxy.ts` | Auth middleware — runs on every request |
| `src/lib/auth.ts` | `getCurrentUser()`, `requireHRAdmin()`, `PROFILE_SELECT` |
| `src/lib/supabase/server.ts` | Server-side Supabase client |
| `src/lib/supabase/client.ts` | Browser-side Supabase client |
| `src/lib/supabase/middleware.ts` | Session cookie refresh |
| `src/hooks/use-user.ts` | Client-side auth state hook |
| `src/lib/utils.ts` | `cn()` utility (clsx + tailwind-merge) |

### Module Config

| File | Purpose |
|---|---|
| `src/lib/hr.ts` | HR constants, leave types, formatters (938 lines) |
| `src/lib/sign-in.ts` | Sign-in types, location config, formatters |
| `src/lib/learning.ts` | L&D utilities (section types, progress logic, duration formatting, lesson type config) |
| `src/lib/certificates.ts` | PDF certificate generation (`@react-pdf/renderer`) |
| `src/lib/email.ts` | Resend email client + MCR-branded templates |
| `src/lib/intranet.ts` | Intranet utilities |
| `src/lib/tiptap.ts` | Tiptap rich text utilities (extractPlainText, extractMentionIds, extractHeadings, slugifyHeading) |
| `src/lib/tiptap-callout.ts` | Custom Tiptap callout extension + shared CALLOUT_CONFIG |
| `src/lib/url.ts` | URL utilities (isValidHttpUrl, extractUrls, linkifyText, proxyImageUrl, sanitizeRedirectPath) |
| `src/lib/google-drive.ts` | Google Drive API client, HTML export, sanitisation, plaintext extraction |
| `src/lib/google-auth.ts` | Shared Google service account auth (Calendar + Drive) |
| `src/lib/algolia.ts` | Algolia admin + search clients, section-level indexing |
| `src/lib/resource-components.ts` | Component page registry (maps component_name → React component + data fetcher) |
| `src/lib/html-sections.ts` | Parse Google Doc HTML into sections for Algolia indexing |
| `src/lib/ssrf.ts` | SSRF protection for link preview fetching |
| `src/lib/notifications.ts` | Notification helpers |

### Scripts

| File | Purpose |
|---|---|
| `scripts/run-migrations.mjs` | Database migration runner |
| `scripts/seed-org-structure.mjs` | Seed org structure data |

### Documentation

| File | Purpose |
|---|---|
| `CLAUDE.md` | AI assistant instructions, conventions, lessons learned |
| `docs/plan.md` | Overall development roadmap |
| `docs/hr-plan.md` | HR module roadmap |
| `docs/testing-plan.md` | Testing strategy |
| `docs/google-calendar-setup.md` | Google Calendar integration setup |
| `docs/learning-overhaul.md` | Learning module overhaul handover document |
| `docs/PROJECT.md` | This document |

---

## Architecture Decision Records

> **Reconciled 2026-06-11 against live code.** This is the single canonical ADR log; the project board regenerates from it. The board's prior 1-10 and this file's prior 1-12 had drifted in numbering and content. The merge below was verified against the codebase by five read-only review passes; two claims were corrected against reality (enums in ADR-008, storage in ADR-006) and the editor decision (ADR-010) rewritten to its real state plus the migration direction.

### ADR-001: Next.js App Router on Vercel with Supabase Postgres

**Context:** Needed auth, database, storage, and RLS without building a backend from scratch, on a managed platform.

**Decision:** Next.js 16 App Router (route groups under `src/app/`) on Vercel, with Supabase-hosted PostgreSQL as the backend (auth, database, storage, RLS).

**Consequences:** Fast delivery, built-in OAuth + email OTP, RLS for security. Trade-off: vendor lock-in on Supabase-specific features (RLS, auth triggers, Vault, pg_cron).

### ADR-002: Server-actions-only mutation path

**Context:** Needed one reliable mutation pattern. Client-side Supabase writes hang indefinitely in this app.

**Decision:** All database writes go through Next.js Server Actions (the server-side Supabase client). The browser client is used only for realtime subscriptions. API routes are reserved for webhooks, cron, file proxies, and token-authenticated endpoints (kiosk).

**Consequences:** Type-safe, reliable mutations with automatic revalidation. Trade-off: every mutation needs a Server Action; all logic lives in Next.js, harder to extract later.

### ADR-003: Proxy auth from JWT app_metadata claims

**Context:** The proxy was querying the DB on every request to check user type and induction status.

**Decision:** Store frequently-checked fields (user_type, status, induction, is_external, admin flags) in `auth.users.raw_app_meta_data` via a profiles trigger; the proxy reads them from JWT claims, with a DB fallback for pre-migration sessions.

**Consequences:** Proxy is DB-free in the common path. Trade-off: claims can be stale until the next token refresh.

### ADR-004: Domain-restricted auth with internal/external tiers

**Context:** The intranet serves internal MCR staff and external school-employed Pathways Coordinators, with different module access.

**Decision:** Sign-in restricted to `@mcrpathways.org` (enforced in `handle_new_user()`). Module access is gated in the proxy by `user_type` + `is_external`: internal staff get everything; external staff get Learning + Intranet; non-staff get Intranet only after induction.

**Consequences:** One auth model covers both audiences. Trade-off: access rules live in the proxy and must stay in sync with sidebar gating.

### ADR-005: Typed Supabase clients from generated types

**Context:** Hand-typed queries drift from the schema and miss columns silently.

**Decision:** All three Supabase clients (server, browser, service) pass the `Database` generic from the generated `src/types/database.types.ts` (70+ tables) for compile-time query checking.

**Consequences:** Compile-time safety on selects/inserts/updates. Trade-off: types must be regenerated after migrations, and prod migration parity confirmed first (see tech debt).

### ADR-006: Google Drive as the document and media store (migration in progress)

**Context:** MCR runs on Google Workspace. Storing documents and media in Drive keeps content where staff already work and lets Drive's own viewers and permissions do the heavy lifting. The direction is to move *all* document and media storage off Supabase Storage onto Drive.

**Decision:** Google Drive is the target store for documents and uploaded media. Done so far: Google-Doc articles (linked + webhook-synced), news-feed media (the `post-attachments` Supabase bucket was retired in migration 00087), and resources media uploads.

**Consequences:** Content lives where staff edit it; Drive viewers handle previews. Migration is incomplete — Learning media (`lesson-images`, `course-videos`) and HR documents (`hr-documents`) are still on Supabase Storage, tracked as tech debt to move to Drive. Trade-off: dependency on the Drive API (watch-channel renewal cron), service-account setup.

### ADR-007: Algolia search, Resend email, Supabase pg_cron scheduling

**Context:** Needed section-level search, transactional email, and scheduled jobs.

**Decision:** Algolia for search — two indices (`resources_articles` at section level for deep-linking, `learning_courses` at course level), client-side React InstantSearch, server-side indexing on publish/link/sync/unlink. Resend for transactional email (FROM `noreply@mcrpathways.co.uk`, the verified domain). Supabase `pg_cron` + `pg_net` for all scheduled jobs under one scheduler — HTTP routes under `/api/cron/*` authenticated with `CRON_SECRET`, plus internal DB-function jobs, with a `cron_runs` audit table.

**Consequences:** Strong search UX, reliable email, one scheduler. Trade-off: external service dependencies (Algolia, Resend), Vault-stored secrets for cron.

### ADR-008: TEXT + CHECK for discriminators (not Postgres ENUMs)

**Context:** ENUMs caused transaction failures when a type didn't exist during trigger execution and are awkward to extend in production.

**Decision:** New discriminator columns use TEXT + CHECK constraints (e.g. `post_type`, `user_type`, `status`, sign-in `location`, notification `source_kind`).

**Consequences:** Easy schema evolution for new columns. Caveat (verified): five enum types from the original schema predate this rule and are still live — `leave_type`, `leave_status`, `work_location`, `course_category`, `enrollment_status`. Converting them to TEXT + CHECK is optional cleanup, not yet done.

### ADR-009: RLS with effective-role RPCs and decoupled capability flags

**Context:** Authorisation must be enforced at the database, and capability (what you can *do*) must not be conflated with data-access tier (what you can *see*).

**Decision:** RLS policies use ownership checks (`auth.uid()`, EXISTS subqueries) for mutations; SELECT on org-reference tables (teams, profiles, holidays) is intentionally readable to authenticated users. Effective-role RPCs (`is_hr_admin_effective()` etc.) check `status = 'active'` + the flag. Capability flags (`is_hr_admin`, `is_ld_admin`, `is_systems_admin`, `is_content_editor`, `is_line_manager`) are boolean profile columns, decoupled from `is_external`/department, grantable only by HR/systems admins via a `protect_admin_fields()` trigger. All SECURITY DEFINER functions set `search_path = ''`.

**Consequences:** Defence-in-depth; capability cleanly separated from data tier. (The two `WITH CHECK (true)` INSERT holes on `email_notifications` and `certificates` found in the 2026-06-10 review have been closed.)

### ADR-010: Plate as the target rich-text stack, replacing Tiptap where applicable

**Context:** The app grew two rich-text stacks: Tiptap (news-feed, learning lessons) and Plate (Resources native articles). Two editors and four renderers duplicate work and drift. The direction is to standardise on Plate where applicable.

**Decision:** Plate is the target editor. Current state (verified): Resources native articles use Plate (JSON via PlateStatic); Resources also has Google-Doc-linked articles (Drive-synced HTML → ArticleRenderer) and component-registry articles. Tiptap still powers news-feed posts/comments and learning lessons (`content_json`, TiptapRenderer / LessonRenderer).

**Consequences:** Clear target stack. Migration incomplete — the Tiptap surfaces (news-feed, learning lessons) are tracked as tech debt to move to Plate where applicable. Callout styling is not yet unified (`CALLOUT_CONFIG` drives Tiptap + Google-Doc callouts; Plate uses `@platejs/callout` defaults), so the two can drift until consolidated on Plate. This supersedes the earlier "Google Docs over Tiptap for Resources" framing (which omitted native Plate and component articles) and folds in the historical dialog→full-page editor decision (`article-form-dialog.tsx` was deleted; articles use full-page `/new` and `/edit` routes).

### ADR-011: TanStack Table + Shadcn for data tables

**Context:** Tables across the app had inconsistent sorting, filtering, and pagination.

**Decision:** Standardise on `@tanstack/react-table` (headless) + Shadcn `<Table>` primitives via a shared `DataTable` (with `DataTableColumnHeader` + `DataTablePagination`); uniform wrapper `bg-card rounded-xl border border-border shadow-sm overflow-clip`. Lightweight read-only tables reuse the same wrapper.

**Consequences:** Consistent table UX (~24 tables on the pattern). Content-rendering tables (Google Doc / Tiptap / Plate) are intentionally excluded.

### ADR-012: CSP-compliant image proxying

**Context:** Enforcing `img-src 'self'` CSP broke external images (Google profile photos, OG preview images).

**Decision:** Proxy external images through `/api/og-image` (protocol-validated, rate-limited, SSRF-guarded). New records store proxied URLs at creation; old records get render-time proxy via `proxyImageUrl()`.

**Consequences:** Full CSP compliance. Trade-off: extra request hop; cache needed to manage load.

### ADR-013: Component pages via registry pattern

**Context:** Some resources (e.g. org chart) are interactive React components, not documents.

**Decision:** Component registry (`src/lib/resource-components.ts`) maps `component_name` → `{ component, getData }`. Editors manage metadata; developers register the component.

**Consequences:** Developers own the code, editors own the metadata. Org chart was the first component page (relocated from `/hr/org-chart`). Trade-off: new component pages need a code change + migration.

### ADR-014: Home-feed colour hierarchy (ivory canvas + per-post-type accents)

**Context:** Staff feedback was that the app "looks dull / giving greyscale". The feed renders every post type on the same white card against a cool-grey `#F2F4F7` background, so news, kudos, polls, pinned items, and the weekly round-up are indistinguishable at a glance. Two earlier attempts were shelved: a module-identity colour system (per-module sidebar/header hues) and a contractor "Combined Feed" proposal whose off-white background was rejected in April 2026 (the background change was a hard "no" at the time). A new design handoff supersedes both.

**Decision:** Adopt the handoff as the canonical home-feed design.
- Promote ivory `#FDF9EA` (the existing `--mcr-ivory` token) to `--background`, uniform across every route. This reverses the April 2026 background decision — made consciously here, not by drift.
- One accent per post type, reusing existing brand hues per their documented roles: pinned = orange `#F09336` 4px left spine + "Pinned" pill; poll = sky-blue `#5BC6E9` left spine + "Poll" pill + rank-graded result fills; kudos = pale-yellow `#FEF7E0` card + 1.5px `#F8D45B` border; weekly round-up = solid navy `#213350` block. Ordinary posts stay plain white as the baseline the accents read against.
- Add a surface-tint ramp (`#FEF7E0`, `#EAF6FC`, `#A7DCF2`, `#D3EDF8`, `#BFE4F4`, `#FDF1E3`, `#F4E5AE`) as tints derived from existing brand hues, not as new brand colours. Light-mode only; documented in `docs/design-system.md`.
- Cards stay pure white; `bg-background` surfaces that must read as elevated migrate to `bg-card`.

**Consequences:** The feed differentiates post types at a glance without colour-coding data, staying inside the "brand colour is an accent, not a foundation" doctrine (design-system §3) for everything except the background, which is the one deliberate exception. Knock-on: a `bg-background` → `bg-card` sweep (41 sites / 30 files). The tint ramp must be reconciled against the live `--mcr-*` tokens before code — the Green token alone has three values in circulation (`#B5E046` live, `#22a34b` on the project board's Brand tab, `#4b8f4b` a rejected proposal). Dark mode is unaffected for now (no theme switcher is wired) but the new tints are light-only, and that limit is recorded. Supersedes the module-identity colour work and the Direction-C kudos mockup.

---

## Known Issues & Technical Debt

### High Priority

- **No error monitoring** — `src/lib/logger.ts` is a console stub. No Sentry/Datadog integration.
- **No server action rate limiting** — API routes are rate-limited (PR #163), but server actions are not. Deferred to hardening phase (see `memory/rate-limiting.md`).

### Migrations in progress (directional)

Deliberate cross-cutting migrations toward a single target, partially done.

- **Supabase Storage → Google Drive** (ADR-006). Drive is the target store for all media. Still on Supabase Storage: Learning media (`lesson-images`, `course-videos`) and HR documents (`hr-documents`). News-feed media (`post-attachments`) already moved in migration 00087. Migrate the remaining buckets to Drive and retire them.
- **Tiptap → Plate** (ADR-010). Plate is the target editor where applicable. Still on Tiptap: news-feed posts/comments and learning lessons (`content_json`, `TiptapRenderer` / `LessonRenderer`). Migrate where it makes sense, then unify callout styling on Plate (retire the `CALLOUT_CONFIG` / `@platejs/callout` split) and collapse the four renderers.

### Medium Priority

- **Large action files** — `flexible-working/actions.ts` (1,241 lines), `onboarding/actions.ts` (1,192 lines), `absence/actions.ts` (1,012 lines) could benefit from splitting.
- **Flat HR component structure** — all 68 HR components in `src/components/hr/`. Consider grouping by feature as Phase 3 grows.
- **No CI/CD pipeline** — no GitHub Actions; relies entirely on Vercel's Git integration.
- **Absence hard-deletes** — `absence/actions.ts` hard-deletes records. Soft-delete with `deleted_at` would be safer for audit trails.
- **No bulk operations** — leave entitlements, compliance assignments, onboarding checklists are all one-at-a-time.

### Low Priority / UX

- Weekend calendar cells nearly invisible (`bg-muted/30` on `bg-background`)
### Won't Fix

- Radix UI ID hydration mismatches (known React 19/Radix issue, harmless)
- Mobile delete button for sign-in entries (hover-only, fix when mobile support is added)

---

## Future Work

### Planned

- **HR Phase 3** — surveys, DEI tracking, performance reviews, praise/recognition, document signing, reporting
- **Mobile-responsive pass** — flag and fix areas that are hard to make mobile-friendly
- **Kiosk PWA** — progressive web app for office kiosk check-in (requirements captured in memory)
- **Intranet RHS sidebar** — sidebar alongside the news feed (feed stays ~590px)
- **E2E test expansion** — core module + HR module tests

### Infrastructure

- Error monitoring integration (Sentry or Datadog)
- CI/CD pipeline (GitHub Actions for automated test runs, lint, type-check)
- Scheduled notification jobs (daily digest for HR)

---

## Changelog

| Date | Author | Summary |
|---|---|---|
| 2026-06-05 | Abdulmuiz Adaranijo | Jargon page migrated to native glossary blocks, plus a Dependabot security pass. The MCR Jargon Buster moved from flat WordPress paragraphs to a `glossary` block (Terms definition list + two-column Acronyms table) with an on-page filter (matched-text highlighting, TOC sync), per-term Algolia records for Cmd+K deep-linking, and a per-entry insert-below control for adding terms mid-list, plus a two-way Algolia synonym harvest (54 pairs from the page's acronym and parenthetical-abbreviation entries, pushed index-wide so searching 'SDS' finds 'Skills Development Scotland' and vice versa). 83 source terms became 80 after de-duplicating three cross-section repeats; five source typos corrected. The migration script backs up the original content and re-runs from that backup. Dependabot batches 1-3 took the security backlog from 48 alerts to 7 (both criticals and 8 of 9 highs cleared): next 16.2.7, jspdf 4.2.1, resend 6.12.4, vitest 4.1.8 and a dompurify override, with the framework core kept exact-pinned. The remaining 7 are no-upstream-patch (xlsx) or major-bump-gated (platejs v53, tiptap 3.25). |
| 2026-06-03 | Abdulmuiz Adaranijo | Native-article Algolia heading-wrap fix + info-for-new-staff editorial pass. The native-article search pipeline was silently producing one section per article since the native editor + Algolia integration first shipped. `HeadingStatic` checked `element.id` and took the wrapped path (`<div data-slate-id=...><h2 id=...>...</h2></div>`) for every heading because Plate's static editor stamps an internal block-id on every element during serialisation — independent of `addHeadingIds`, which `createNativeStaticEditor` deliberately does not call. `parseHtmlIntoSections` walks `body.children` only; with headings nested inside divs at the top level it found no heading tags and produced one null-heading section per article. Fix: a new `AlgoliaH1Static` through `AlgoliaH4Static` set that always renders `<SlateElement as={Tag}>` regardless of `element.id`, wired in via a `staticComponentsAlgolia` override map used by `createNativeStaticEditor`. Browser rendering via `prepareNativeArticle` keeps the original `HeadingStatic` with its anchor-link affordance. Three regression tests in `src/lib/plate-static-plugins.test.tsx` lock the full `createNativeStaticEditor → serializeHtml → parseHtmlIntoSections` contract. All six published native articles were re-indexed via `scripts/reindex-native-article.ts` (a service-role mirror of `reindexNativeArticle`): group-work 1→2 sections, mentor-training 1→5, mission-vision-values 1→14, information-for-new-staff 1→22, jargon 1→3, pc-support 1→7. Algolia native-article record count 6 → 53. In parallel the information-for-new-staff editorial pass ran end-to-end: 16 `toggle_v2` summaries flattened to H3 with their body content inlined as siblings, via the new `src/lib/wp-migration/flatten-toggle-v2.ts` library and a `scripts/flatten-toggles.ts` per-slug CLI. `flatten-toggle-v2` walks a Plate value, promotes `toggle_v2_summary` nodes to a configurable heading level, inlines body content as siblings, and demotes nested headings by one so the outline shape stays consistent; nested `toggle_v2` inside another toggle's body flattens recursively at the next level down; an `exclude` option keeps genuine collapsibles (e.g. people-services COSHH Assessments). The CLI uses the established scripts convention (manual `createClient`, `.trim()` on env vars, `process.exit(2)` on missing env) with `--dry-run`, `--exclude="A,B"`, `--heading=h2|h3` flags. A standing rule landed in `src/app/(protected)/resources/CLAUDE.md`: every former WP toggle summary in a migrated article MUST emit as a real `<h2>`/`<h3>`/`<h4>` element — never bold paragraph, `<strong>` standalone, or styled div. The H-tag is load-bearing for Algolia section indexing, screen-reader landmark navigation, the on-page TOC built by `prepareNativeArticle`, and prose typography sizes. Bold rendering is a free consequence of using the tag. Migration count on main holds at 98 (latest 00097). |
| 2026-05-25 | Abdulmuiz Adaranijo | WordPress migration foundation + Plate toggle container rebuild. The Resources native editor gained an Import HTML mode that converts Old Intranet HTML through a parsing walker (`src/lib/wp-migration/html-to-plate.ts`) into Plate JSON. Cross-article asset dedup ensures images linked from multiple WP pages get one canonical `resource_media` row. A batch-loop driver iterates audited content bits — five pages migrated end-to-end (pc-support, group-work, jargon, MVV, information-for-new-staff). Each old WP page goes through a design review before content is walked. Two pages stayed as walker-emitted toggles per the design review (pc-support PC Guidebook + group-work themes); the rest get hand-tuned heading hierarchies. The Plate toggle was rebuilt from indent-based to container-based: `toggle_v2` + `toggle_v2_summary` plugins replace the legacy `toggle` + `BaseTogglePlugin` + `nestToggleChildren` render-time inference. The container shape is structurally what Elementor's Toggle widget produces on the OLD intranet — body lives inside the container as children, so closing the toggle structurally hides every block inside (the image-doesn't-close-with-toggle bug the indent model couldn't fix is structurally impossible here). A storage converter walked the 17 indent-shape toggles already in `information-for-new-staff` into container shape. The editor element renders the toggle title in `font-semibold` to match the static read view — captured as a project convention (WYSIWYG: editor visuals match published output). The walker also picked up four fixes from the design review: `listStart` emitted on ordered-list items so numbering increments, in-toggle headings excluded from the article TOC, void blocks (images / files) hidden inside closed toggles, and list continuation across void blocks (Google Docs UX). Four audited articles were re-published under the new walker. The Tool Shed module was retired as part of W5 cleanup — `tool_shed_entries` table dropped (00096), six components removed, sidebar nav entry gone, `tool_shed_entries` Algolia index code references removed (production dashboard deletion is a separate manual step). The three Tool Shed `post_type` slots stay reserved in 00095's CHECK whitelist for W7 to repopulate. Path-scoped CLAUDE.md rules introduced under `.claude/rules/` — they load on matching globs rather than full project context (UI components rules, Next.js config rules). Row actions across non-editor surfaces moved to always-visible (cards, table rows) — the hover-to-reveal pattern didn't fit a Chromebook fleet without consistent hover behaviour; rule captured in `docs/button-system.md`. Resources landing got a zebra-row category list with a soft-retreat empty-state wrapper. Brand-colour leak sweep stripped ad-hoc `text-mcr-teal` tints on icon chrome. Two stacked-PR auto-close incidents (downstream PRs lost when base branches were squash-deleted) reinforced the existing "rebase + retarget downstream PRs to main BEFORE deleting a merged base" rule. Migration count on main 98 (latest 00097; 00096 dropped `tool_shed_entries`, 00097 added `resource_media_dedup`). Lessons routed: container-shape toggle architecture, WYSIWYG editor-matches-static pattern, and `editor.tf.insertNodes` API (`src/app/(protected)/resources/CLAUDE.md`); WP-migration script suite convention deferred (`--key=value` vs `--key value`) — sweep documented as a deliberate convention decision before further script work. |
| 2026-05-11 | Abdulmuiz Adaranijo | W4 (Kudos) shipped + W4b (Announcement) attempted and scratched. PR #298 delivered the post-type taxonomy + Kudos backend + render + compose + Pin-to-corner-icon migration: schema (`posts.post_type` discriminator with CHECK whitelist reserving slots for kudos / announcement / 3 Tool Shed types, `posts.kudos_category` with consistency CHECK, `post_kudos_recipients` join table with CASCADE FKs and RLS — all in migration 00095), `createKudosPost` server action (sender-drop, dedup, cap-of-10, rollback on recipient-insert failure), `addKudosRecipients` post-publish add-only flow (existing recipients NOT re-notified — Slack thread pattern), yellow 4px top strip + `KudosHeader` component on `PostCard` reading "[Sender] sent kudos to [Recipients] for [Category]", dedicated `KudosCreateDialog` opened from an Award chip in `ComposerActionBar` (kudos is structurally different from regular posts so it doesn't share rich-text + attachments + poll machinery), inline "Pinned" Badge retired in favour of a top-right corner Pin icon next to the kebab (matches LinkedIn/Reddit/Teams/Instagram convention; frees the inline-badge slot for content-type semantics), notification click-to-clear behaviour (clicking a bell row navigates AND clears, matching Slack mentions / Linear / GitHub / LinkedIn — auto-clear-on-scroll was rejected for false positives). PR #299 wired the kebab "Edit Post" on a kudos to reuse `KudosCreateDialog` in edit mode rather than the rich-text `PostEditDialog`; category locked as a static chip, existing recipients shown with Lock icons in place of × buttons (add-only), message editable. `editTarget` carries the full locked-recipient data (id, label, avatar, job_title) so a recipient deactivated after the kudos was sent still renders correctly in their locked chip. Save dispatches `editPost` → `addKudosRecipients` SEQUENTIALLY — originally parallel via Promise.all, but Gemini caught the race: `addKudosRecipients` reads `posts.content` server-side for the new recipient's notification body, so parallel meant new recipients could get the OLD message. Six humanizer-vetted categories (Going the extra mile / Team player / Bright idea / Came through / Always there / Thank you), recipient cap 10 enforced server-side, message cap 500 characters. Six Gemini comments across the two PRs all addressed (try/catch around the rollback delete, sequential edit-then-add, query consolidation in `addKudosRecipients`, `logger.error` in catches, `aria-busy` on async buttons, memoise inline-literal editTarget, DRY the dialog's hydration useEffect against the reset callback). W4b (Announcement post type) attempted on 2026-05-11 — built end-to-end with new `profiles.can_post_announcements` flag (orthogonal to `is_hr_admin` per Colin's pushback: comms authority is decoupled from HR data access), `mcr-light-blue` top strip + "Announcement" header badge, compute-on-read pin display (no cron — `is_pinned AND (post_type != 'announcement' OR expires_at > now())`), Megaphone chip in `ComposerActionBar` extending `PostCreateDialog` with announcement-mode (datetime-local picker + email tickbox), bell fan-out + opt-in email broadcast. PR #300 opened then scratched at Colin's direction; migration 00096 never applied to prod, branch deleted, main unchanged. Research preserved in `memory/announcement-deferred.md` for revival. Test count 1,546 → 1,569 (W4 + W4-edit only — W4b's 8 tests went away with the branch). Migration count on main holds at 95 (the W4 schema is in 00095; the W4b migration 00096 only ever lived on the scratched branch). Lessons routed: don't conflate capability flags with data-access roles (root); sequential vs parallel when one action reads what another writes (root); memoise inline-literal props passed to memoised children (root); compute-on-read for time-bound visual state (root); `\|\|` over `??` for env-var fallbacks where empty string is invalid (root); reuse existing dialogs with mode props for variant flows (intranet CLAUDE.md); blue is the universal informational-banner convention with documented platform rationale (design-system.md). Backlog item recorded: `memory/observability-silent-catches.md` — ~38 pre-existing silent client catches surfaced during the W4 sweep, deferred as a separate observability PR with triggers documented (Sentry/Datadog wiring, repeat Gemini hit, kiosk QA report). |
| 2026-05-07 | Abdulmuiz Adaranijo | W3-rev workstream complete. Six PRs delivered the notification-centre overhaul + greeting + DailyBanner retirement: schema (`source_kind` + `source_id` columns, `is_saved` + `saved_at` columns, partial indexes, CHECK constraints across migrations 00090–00094), auto-Clear behaviour with 30-day retention sweep cron, persistent-state attention rows merged with DB events into a single deduped inbox stream, bell + popover rewrite with per-row Clear / Save / Open kebab actions and an inline working-location picker, full `/notifications` page with three tabs (Inbox/Saved/Cleared), source-filter pills (HR/Learning/News/Mentions/Sign-In), Clear-all confirmation dialog, empty-state CTA. Quiet greeting (`Good afternoon, Colin.` — Notion home reference, not Asana hero) replaced the `News Feed` H1 on `/intranet`; suppressed for users still in induction; sharp time buckets in Europe/London. DailyBanner deleted. `getDailyBannerState` renamed to `getWorkingLocationState` (still drives the bell's working-location row). All 8 working-location mutations widened to layout-level revalidation so bell + `/notifications` see fresh state. 2pm cutoff on the no-schedule prompt removed (was carry-over from the loud DailyBanner; wrong for the passive bell row). `/admin` rename dropped from the roadmap (a pure rename only fixes half the admin surface; pickup deferred to whenever a real `/admin` index is built). New design constraints captured in `docs/ui-ux-principles.md` and `docs/plan.md`: no coloured banners above page H1 for routine actions (Polaris rule), bell is the singular attention surface, `SOURCE_KIND_MODULE` is canonical for notification grouping. Anchored research from Linear Method, Polaris, NN/G banner blindness, Mark Weiser's calm-technology framing. 28 Gemini comments addressed across the six PRs (handful declined with verified reasoning — e.g. extrapolating Radix-Menu stopPropagation rules to non-Menu contexts). Test count 1,518 → 1,546 (71 files); migration count 90 → 95 (latest 00094). Lessons routed across CLAUDE.md files: Radix DropdownMenu interior interaction patterns, conditional `onCloseAutoFocus` for keyboard a11y, mirroring state into a ref to stabilise memoised callback identity, optimistic-rollback scope, server-action `cache()` pattern for same-request memoisation, Lucide MapPin filled-currentColor balloon problem, Tailwind utility ordering through tailwind-merge. |
| 2026-05-01 | Abdulmuiz Adaranijo | Save / Cancel / Submit button audit (PR #282). Smoke-test on the comment editor surfaced one Save button rendering ghost-grey identical to its Cancel sibling; expanded into a sweep audit across the 115 ghost-variant buttons in `src/components`. Found 8 violations across 6 files: comment-item Save (ghost+sm), link-google-doc-dialog Cancel (ghost), location-picker-dialog Clear (ghost), section-quiz-editor Cancel ×2 (ghost+sm), quiz-editor Cancel (ghost+sm), comment-section reply send + comment send (ghost+icon-xs/sm). All variants moved to `default`/`secondary` per `docs/button-system.md`; all `size="sm"`, `icon-xs`, and `icon-sm` on primary CTAs bumped to `default`/`icon` since "primary CTAs must be default, lg, or hero — never sm" applies equally to icon-only equivalents. Save siblings size-bumped alongside Cancel siblings to land the rule once-and-for-all. Chat-send icons (`comment-section.tsx` reply + comment) became filled navy circles via `rounded-full` className override (Button base is `rounded-lg`; rendering as rounded squares didn't match the PR description; Gemini caught the mismatch). `docs/button-system.md` extended with two locking-in changes: a new "Inline Submit / Send icon (chat composer)" row in the Patterns table spelling out `default` + `size="icon"` + `rounded-full`, and an explicit "Do not do" line listing every primary-CTA word (Save, Submit, Cancel, Clear, Reset, Approve, Publish, Send) where ghost is wrong. Rest of the 115 ghost buttons confirmed correct (toolbar, row, utility — all match the rule). Test count holds at 1,518. Three lessons routed to root `CLAUDE.md` Process: extend the same-pattern-sweep rule to user-surfaced regressions; don't carve exceptions to documented rules during strict-compliance passes (the chat-app instinct trap); don't bundle adjacent visual tweaks into a fix-one-rule-violation edit (gap-1 → gap-2 was outside the rule's scope, surfaced and reverted). |
| 2026-04-29 | Abdulmuiz Adaranijo | News-feed media moved to Google Drive (PR #279) and document attachment preview redesigned (PR #280). PR #279: `post-attachments` Supabase Storage bucket retired in migration `00087`, replaced by Drive uploads under `YYYY/MM` folders against `GOOGLE_DRIVE_NEWS_FEED_FOLDER_ID`. New `image-pipeline.ts` runs every upload through Sharp — EXIF strip, orientation bake, ICC profile preserved — with HEIC/HEIF converted via `heic-convert` (Sharp's libheif ships without HEVC) and Apple ProRAW DNG via the TIFF path. Camera RAW rejected with a friendly export-as-JPEG error. `news_feed_media` staging table (migration `00088`) lets the proxy serve pre-post composer thumbnails before `post_attachments.drive_file_id` exists; rows promoted on post-create, deleted on discard, swept daily by `sweep-staged-media` pg_cron. File caps held at **4 MB** by Vercel Hobby's platform limit (the 100 MB cap originally planned was a `bodySizeLimit` misread — that setting cannot raise Hobby's edge limit). Drag-drop zone moved up to `DialogContent` so dropping outside the small attachment editor's wrapper no longer falls through to the browser's "navigate to file" default. PR #280: clicking a document attachment now opens an in-app modal with the file rendered in-place — PDFs through our proxy with `Content-Disposition: inline` (Chromium's native viewer), DOCX/XLSX/PPTX/TXT/CSV through Drive's `/preview` URL (Drive's own viewer; files domain-shared with `mcrpathways.org` at upload so Drive lets the user in via their own Google identity). The lightbox adds no toolbar of its own — that would duplicate Chromium's toolbar / Drive's preview header. Two floating frosted-glass buttons sit on the dark backdrop top-right (Open in new tab, Close); neither is provided by the inner viewer, so no duplication. Card itself uses file-type colour convention via new `FILE_TYPE_CONFIG` + `resolveFileType` (Adobe red PDF, Word blue, Excel green, PowerPoint orange, slate fallback) — `docs/design-system.md` Section 1.9 documents the mapping. PDF page count extracted at upload via `unpdf` (pure JS, serverless-safe), rendered as `PDF · 12 pages · 230 KB` on the card and the composer chip. Per-route CSP override on `/api/drive-file/:path*` (`frame-ancestors 'self'`) lets our same-origin lightbox iframe load the proxy URL while every other route stays at the global `frame-ancestors 'none'`. Resources file element keeps download-on-click (its `<a download>` attribute beats the new inline disposition on Chrome and Firefox 82+); a follow-up PR will migrate it to the same colour convention. Smoke-test surfaced two visible-only issues that drove design changes: a parent toolbar on the lightbox duplicated Chromium's PDF toolbar and showed the PDF's `/Title` metadata instead of the user's filename (fixed by dropping our toolbar); floating buttons styled `bg-black/60` blended into the `bg-black/80` backdrop because — unlike `image-lightbox.tsx` — there's no surrounding image to provide contrast (fixed with frosted-glass `bg-white/10 backdrop-blur-md` pills). 7 Gemini comments addressed across the two PRs; the eighth (`filename.includes(".")` extension regex) was rendered moot by the toolbar removal. Lessons routed: don't reuse the `bg-black/60` floating-button pattern on uniform dark backdrops, don't add a parent toolbar that duplicates an iframe's built-in chrome (`src/lib/CLAUDE.md`); Chromium PDF Open Parameters (`#toolbar=0` works, `#navpanes=0` doesn't), Chromium shows PDF `/Title` not filename, Drive `/preview` needs domain-share for embedded auth (`src/app/(protected)/intranet/CLAUDE.md`); use `href={url ?? undefined}` not `href={url || "#"}` for missing URLs (root `CLAUDE.md`). Migration `00089` adds `page_count` to `news_feed_media` + `post_attachments`. New deps: `sharp`, `heic-convert`, `unpdf`. Test count 1,457 → 1,518. |
| 2026-04-24 | Abdulmuiz Adaranijo | Resource article TOC redesign and article header restructure. TOC active state moved from a brand-coloured left accent bar to a Polaris-style rounded `bg-accent` pill in a bordered transparent wrapper — text colour and weight stay identical between active and inactive, the pill alone carries the signal. Width graduated `lg:w-56 xl:w-64`, long headings now wrap (`break-words`) instead of truncating, internal scroll fallback for long TOCs, `text-sm` body, `aria-current="location"` on the active link. Scroll-spy hook rewritten to track intersection state across callbacks and fall back to "last heading above the 80px threshold" when nothing is in the band, fixing a stuck-active bug during slow scroll-up. Bookmark and kebab cluster moved inside the article column on both Google Doc and native views so the dropdown opens within the 720px prose width and never overlaps the TOC. H1 26 → 30px. "Updated" line switched to relative time with absolute on hover via the existing `timeAgo` helper. Breadcrumb separators changed to `ChevronRight` icons; redundant trailing current-page span dropped. Headings gained `prose-headings:scroll-mt-24` so TOC link clicks land headings below the sticky header. Vercel TypeScript caught a third `ArticleBreadcrumb` caller a `grep | head -5` had hidden — fixed in the same PR. Gemini flagged 10 redundant `h-4 w-4` classes on icons inside `DropdownMenuItem` (the primitive auto-applies `size-4`); the old `src/lib/CLAUDE.md` rule encouraging explicit sizing was outdated and is now corrected. Lessons routed to root, `src/lib/`, and resources `CLAUDE.md`: gap-state fallback for IntersectionObserver scroll-spy, no sizing classes inside `DropdownMenuItem`, verify research-agent design claims via real DOM inspection, don't truncate `grep` for caller enumeration. Test count holds at 1,457. |
| 2026-04-23 | Abdulmuiz Adaranijo | Vercel-to-Supabase cron migration finished. `process-emails` and `daily-reminders` now run under Supabase pg_cron + pg_net via migration `00086`, reusing the vault secrets (`app_base_url`, `cron_secret`) set up for `00083`. All three app crons are now on one scheduler; `vercel.json` has no more entries. Both routes gained the `cron_runs` audit-write pattern from `renew-drive-watches`, with the Gemini-driven refinements: `daily-reminders` tracks per-block failures in a `blockErrors` array so the audit status is honest when either L&D or HR crashes; `process-emails` checks every `.update()` in the retry loop, counts a `persistenceFailed` metric, breaks the loop on success-branch persistence drift (the cascade-double-send risk), and writes `status='failed'` with an explicit error message when drift is detected. Type-regen of `database.types.ts` was attempted but abandoned: production Supabase is behind on migrations `00074`, `00077`, and the flexible-working tables, so regen would have lost type coverage across the codebase. Captured as a deferred task with concrete pick-up triggers. Three lessons to root CLAUDE.md: outer try/catch is blind to error-swallowing inner catches, batch loops with external side effects must break on post-send persistence failure, and prod migration parity must be confirmed before any type regen. Test count 1,436 → 1,457. |
| 2026-04-22 | Abdulmuiz Adaranijo | Drive-integration polish. PR #261 corrected the "up to 7 days" Drive watch lifetime assumption — channels observed at ~24h in practice; fallback values, comments, and docs all aligned with reality, plus defensive trim on NEXT_PUBLIC_APP_URL after a trailing-newline env var broke first production watch setup. PR #262 added google_doc_modified_at (migration 00084) with three-state kebab drift signalling (in-sync / drift / never-synced, 60s threshold). PR #263 one-line fix — ARTICLE_SELECT missed the new column. PR #264 native article header parity (BookmarkToggle moved to right cluster to match Google Doc view). PR #265 admin Drive Watches dashboard on /resources/settings — new tab with two stacked sections (linked docs DataTable, 25/page with multi-column sort + title search; recent renewal runs, last 20 cron_runs rows). Row kebab with Sync now / Open in Drive / Unlink. PR #266 last_sync_error column (migration 00085) + red-tonal Sync failed state on both dashboard (Radix Tooltip hover for error text) and article kebab header (native title attribute — Radix Tooltip inside DropdownMenu has z-index issues). New truncateSyncError helper caps stored errors at 500 chars. Dashboard gained a hidden attention sort column so failed/never-synced/drift/not-watched rows cluster at the top by default with soonest-expiring watch as tiebreaker. Gemini flagged per-row TooltipProvider; swept to a single container-level provider across all three uses in the file. Test count 1,432 → 1,436. Two new src/lib/CLAUDE.md patterns captured: hidden-priority sort column for DataTable default grouping, and single TooltipProvider per component. |
| 2026-04-20 | Abdulmuiz Adaranijo | Drive webhook renewal + Google Doc article UX cleanup. PR #259 removed the teal banner on Google Doc articles entirely; Sync now + Edit in Google Docs moved into the kebab alongside Move and Unlink; BookmarkToggle moved from the title cluster to the right-side action cluster. PR #260 adds Supabase pg_cron to renew Drive watch channels before they expire. Migrations 00081 (google_watch_channel_id, google_watch_expires_at, partial index), 00082 (cron_runs audit table), 00083 (pg_cron schedule via pg_net.http_get with Vault-stored secrets). New route at /api/cron/renew-drive-watches with production guard, per-row try/catch, scale-threshold warnings. Supabase pg_cron is now the default for new cron jobs; existing Vercel crons stay. Smoke test revealed Drive returns ~24h-lifetime channels in practice despite docs saying up to 7 days — fallback values and comments updated to match, defensive .trim() added on NEXT_PUBLIC_APP_URL after a trailing newline in the env var broke the first production watch setup. Gemini review refined the fallback from 23h to 25h so rows don't read as expired between renewals while the underlying channel is still live. Root CLAUDE.md Process section gained two new lessons (fold smoke-test corrections into the sync PR; apply rules at their specified scope rather than extrapolating defensive fixes). The existing MEMORY.md rule on passing credentials through Claude was corrected: `!` prefix runs commands in the local shell but the command text still enters Claude's context, so literal secret values embedded inline still leak. Safe pattern is export in a separate terminal first, then reference by variable name. Concrete failure mode captured in memory/feedback_claude_code_bang_prefix.md after a CRON_SECRET leak during smoke-testing forced a rotation. |
| 2026-04-16 | Abdulmuiz Adaranijo | Resources WS5 search improvements. Config-as-code script (scripts/algolia-settings.mjs) for all 3 Algolia indices — sets searchableAttributes, attributesToSnippet, attributesToHighlight, and distinct dedup on resources_articles (1 hit per article instead of 1 per section). Content snippets now rendered in global Cmd+K search for resources and Tool Shed results (data was requested from Algolia but thrown away). Highlight contrast improved from bg-amber-100 to bg-amber-200/60. Used SDK Hit<T> type instead of custom wrapper. 3 files, +77/-6. |
| 2026-04-17 | Abdulmuiz Adaranijo | Table standardisation complete. All 21 data tables now use one visual pattern: rounded-xl with crisp border edge, bg-table-header, odd:bg-muted/50 striping. DataTable component wrapper updated (shadow-md to shadow-sm, border added). 5 non-conforming tables migrated from raw HTML/CSS Grid to Shadcn Table primitives. Fixed text-centre bug in reports-panel (Tailwind only recognises text-center). Sticky column background sync via group-odd/row + group-hover/row. |
| 2026-04-17 | Abdulmuiz Adaranijo | Resources UX overhaul COMPLETE. All 6 workstreams landed. Per-user bookmarks replaced featured articles. Button intent system (success variant). Tap animation on all buttons. |
| 2026-04-16 | Abdulmuiz Adaranijo | Resources WS4 article reading polish. Fixed sticky TOC offset (top-6 to top-20 to clear 71px header). Added card surface to TOC sidebar (border + bg-card). Extracted ArticleBreadcrumb shared component from 3 duplicated inline breadcrumbs — fixed ComponentArticleView starting with "Home" instead of "Resources" and missing category icon. Heading indent in TOC made dynamic (was hardcoded to H2 baseline, now computes from shallowest heading level). 5 files, +113/-134. |
| 2026-04-16 | Abdulmuiz Adaranijo | Resources WS3 landing polish. Dropped category card metadata row (format was inconsistent across cards). Standardised "Updated" date prefix across all landing sections. Grid changed from 3-col to sm:2/md:3/lg:4 for symmetric layout. Recently Updated promoted above Browse by Category. Editor-only placeholder for empty featured section. Heading moved into CategoryGrid component to prevent empty-heading risk. Key Resources section deduplicated. Search input swap attempted and reverted for WCAG 3.2.1 compliance (Radix focus-loop). 5 commits, 2 files. |
| 2026-04-15 | Abdulmuiz Adaranijo | Category parent-join fix. PostgREST self-referential join `parent:resource_categories!parent_id(...)` was resolving as a reverse join (returning children, not the parent). Fix: `parent:parent_id(...)` (column-as-alias forward join). Touched 4 fetcher functions. |
| 2026-04-15 | Abdulmuiz Adaranijo | Resources WS2 contextual editor affordances. Killed the global `resources-editor-mode` localStorage toggle and admin bar. Replaced with contextual kebab menus on category cards and featured cards, drafts pill with count in page header, per-article Edit/Publish buttons, settings cog link. Fixed outline button contrast on 404 pages. Draft-inclusive article counts for editors (count-visibility batch fix across 4 fetchers). 22 files, +521/-234. |
| 2026-04-15 | Abdulmuiz Adaranijo | Resources drafts governance (PR #237). Fixed inverted draft visibility — HR admins without the content-editor flag no longer see drafts in category lists or via article URLs; `canViewDrafts` (content-editor-only) split from `canEdit` (edit-affordance union) at caller level. New `/resources/drafts` view with loading + empty states and a 100-row cap banner. Unpublish now clears `is_featured` + `featured_sort_order` to stop stale rows counting against the featured cap. Postgres 23505 slug-collision handled cleanly in createNativeArticle, linkGoogleDoc, and updateArticle. Drafts gated out of "recently viewed" localStorage. `fetchDraftArticles` logs DB errors instead of silent-swallow. 12 files +356/-19. 4 new tests, 1,426 total passing across 61 files. |
| 2026-04-14 | Abdulmuiz Adaranijo | Native editor WS5b cross-linking (PR #236). Google Doc URLs in article content rewritten to intranet article links at render-time via html-react-parser replace callback. Google redirect URLs (`google.com/url?q=...`) unwrapped before doc-ID extraction. `Object.hasOwn` guard on cross-link map prevents prototype pollution via crafted doc IDs. `APP_ORIGIN` parsed once at module scope in `article-constants.ts` for origin comparison (not `startsWith`). `extractDocId` `?id=` param restricted to `drive.google.com/open`. UNIQUE partial index on `google_doc_id` (migration 00079). 14 new tests. Squash-merged after #235 revert-and-reland. |
| 2026-04-14 | Abdulmuiz Adaranijo | Native editor WS5a visual parity (PR #234). Native articles now match Google Doc article surface — card wrapper, sticky TOC sidebar, heading deep-links with anchor SVGs, freshness indicator, breadcrumbs, Supabase Realtime for status/title updates. Extracted shared `article-constants.ts` (prose classes, slugify, APP_ORIGIN, types), `useScrollSpy` hook (IntersectionObserver), refactored `ArticleOutline`. Table/video/column/image styling aligned. Image alignment (left/centre/right) preserved through Google Docs sanitiser via classes on `<img>` rather than `text-center` on `<p>`. Jotai deduplicated via npm `overrides` (fixed AggregateError on every editor onChange). Category dropdown bug (Radix Dialog onOpenChange not firing on programmatic open) fixed. `addHeadingIds` creates new objects rather than mutating; tracks a `changed` flag to avoid cloning subtrees with no headings. 34 new tests. |
| 2026-04-13 | Abdulmuiz Adaranijo | Native editor WS4 media complete. Image, video embed, and file attachment plugins with Google Drive upload proxy. Algolia removal on soft-delete. Embed edit/delete toolbar. useUploadHandler hook extraction. findPath consistency across all editor elements. 1,374 tests. |
| 2026-04-10 | Abdulmuiz Adaranijo | Native editor WS3 block plugins. 4 block types added to the Plate editor: callout (4 variants with dark mode), table (basic grid with resize and floating toolbar), columns (2-3 column presets with layout switcher), toggle/accordion (indent-based with collapsible details/summary static rendering). Shared infrastructure: Insert dropdown on toolbar, manual Save button, HTML serialisation pipeline (synced_html populated for Algolia), static plugin extraction (plate-static-plugins.tsx + plate-elements.tsx). 20 new tests (serialisation + nestToggleChildren edge cases). 3 rounds of review fixes: confirmation dialogs for destructive actions, retry race condition fix, dark mode callout, colgroup for table widths, focus-only toolbars, flex-basis width conflict. 1,350 tests, 58 files. |
| 2026-04-09 | Abdulmuiz Adaranijo | Database types regeneration. Regenerated database.types.ts from Supabase (70+ tables, was 40). Added Database generic to all 3 Supabase clients for compile-time query checking. Fixed 72 type errors across 52 files: removed 29 `as any` casts, typed insert payloads, updated nullable interfaces. Post-process script at scripts/post-process-types.mjs. 1,330 tests passing. |
| 2026-03-30 | Abdulmuiz Adaranijo | Phase F COMPLETE (PRs #187-194, 8 PRs). Learner UX overhaul: merged Landing + My Courses into single dashboard (#187), catalogue card polish with left-border accents (#188), lesson sidebar section grouping (#189), catalogue search (#190), Coursera-inspired certificate redesign with Playfair Display + MCR logo + charity registration (#191), admin guardrails with certificate toggle + publish warnings + migration 00072 (#192), syllabus preview for unenrolled users + certificate download (#193), completion celebration with confetti (#194). Removed 8 redundancies, deleted /my-courses page, added canvas-confetti dependency. |
| 2026-03-30 | Abdulmuiz Adaranijo | Phase F PR 1: Merge Learning dashboard (PR #187). Deleted /learning/my-courses page. Merged Landing + My Courses into single /learning with tabs (In Progress, Completed, External). Extracted EnrolledCourseCard with category left-border accents. Replaced 4 stat cards with compact inline bar. Removed 8 redundancies. Moved external course actions to learning/actions.ts. Updated sidebar: "My Courses" → "Catalogue". Added borderColor to CategoryConfig. Fixed hydration mismatch (server timestamp for due date calc). 18 files, +385/-707. |
| 2026-03-30 | Abdulmuiz Adaranijo | Tool Shed dialog & draft UX overhaul (PR #186): draft validation fix (partial content allowed), character counters with colour-coded warnings (amber 90%, red 100%), unsaved changes AlertDialog (Keep Editing / Discard), "or save as draft" footer link, partial draft card rendering (fallback preview, skip empty sections). 7 files, +348/-175. |
| 2026-03-27 | Abdulmuiz Adaranijo | Tool Shed card & feed UX overhaul (PR #185): format-coloured left borders (blue/emerald/amber), event name as bold card title with middot date, 3-2-1 accent changed from violet to emerald (badge + all accent tokens), consistent Show more/Show less toggles, auto-scroll on expand, end-of-feed indicator, smoother filter transitions (dim not vanish), search_text column for content-level search (migration 00071), breadcrumb Link fix. Comprehensive UI/UX review identified 30+ issues, planned as 2 PRs. PR 2 (dialog/draft UX) next. |
| 2026-03-27 | Abdulmuiz Adaranijo | API route rate limiting merged (PR #163): Upstash Redis on 7 endpoints. Project review: fixed 8 doc inaccuracies, flagged database.types.ts staleness, added tech debt items. Server action rate limiting investigated and deferred — full analysis in memory/rate-limiting.md. |
| 2026-03-26 | Abdulmuiz Adaranijo | Tool Shed popular tags moved to PostgreSQL RPC (PR #180, migration 00070). JS-side tag aggregation replaced with `get_popular_tags` DB function (unnest + GROUP BY + COUNT). Added function to database.types.ts. Fixed PostgREST .or() filter injection in Tool Shed search (commas could inject extra conditions to view unpublished drafts). Added security lesson to root CLAUDE.md. |
| 2026-03-26 | Abdulmuiz Adaranijo | CLAUDE.md restructured into nested domain-specific files (PR #179). 7 nested CLAUDE.md files auto-load by directory. 8 memory files retired. Humanizer writing patterns added. Resources UX redesign merged (PR #164): sidebar tree removed, grouped index, category grid, "More in [folder]" sibling nav, scroll-spy TOC, recently viewed in search, nested join for parent category. docs/plan.md rewritten. Workflow rules expanded for full knowledge file lifecycle. |
| 2026-03-23 | Abdulmuiz Adaranijo | Learning overhaul Phase 3 complete. PR #167 merged: learner UI (section-accordion.tsx, section-quiz-player.tsx, lesson-renderer.tsx), certificate auto-issue via DB trigger, completion notifications via DB trigger, auth.uid() RPC enforcement, 4 lesson types (text, video, slides, rich_text). Migrations 00065-00068 applied to production. PR #168 pending (wire components into pages + slides/rich_text admin support). PRs #165, #166 (Colin's) closed and superseded. Open PRs: #163 (rate limiting), #164 (resources UX), #168 (learning wire components). 1,267 tests, 53 files. |
| 2026-03-19 | Abdulmuiz Adaranijo | Learning overhaul Phase 1+2. PR 1: 5 migrations (00060-00064), 4 utility files, section-actions.ts. PR 2: admin UI — section-manager.tsx (~350 lines), section-quiz-editor.tsx (~500 lines), rewritten course detail page for section-based hierarchy, combined quiz actions with rollback. LessonType "quiz" removed (knock-on fixes in 4 learner files). All 5 migrations applied to production Supabase. Build + lint clean, all CRUD verified live. Branch: `feature/learning-overhaul-migrations`. |
| 2026-03-19 | Abdulmuiz Adaranijo | Resources post-launch fixes + enhancements. PR #162: Google Docs formatting preservation in HTML sanitiser (bold/italic spans → `<strong>`/`<em>`, first-row `<td>` → `<th>`, column widths converted to responsive percentages). PR #161: cascading category selection (Category → Subcategory → Folder). PR #160: prose rendering fix (`@tailwindcss/typography` was never installed). Earlier: jsdom→linkedom migration (PR #159), category dropdown error handling, error logging. 1,266 tests, 53 files. |
| 2026-03-18 | Abdulmuiz Adaranijo | Resources module redesign (PR #157, 6 sub-PRs #151-156). Tiptap article editor replaced with Google Docs integration (Drive API, webhooks, HTML sanitisation). Category grid replaced with 3-level sidebar tree navigation. Component page system (org chart relocated from `/hr/org-chart`). Editor mode pencil toggle. Settings page (folder registration, featured curation, category management). Algolia search with section-level indexing. 3,081 lines of dead Tiptap code removed. 61 files changed, net +2,321 lines. Migrations 00058-00059. 1,257 tests, 52 files. |
| 2026-03-13 | Abdulmuiz Adaranijo | Badge tonal redesign: Solid fills → subtle/tonal pills (bg-{colour}-50 + text-{colour}-700) across 4 core variants (default, success, warning, destructive). Aligns with Atlassian/Stripe/Shopify industry standard. Fixed 3 semantic variant mismatches (leave approved→success, onboarding Active→success, external-course-card uses shared categoryConfig). Design system §1.8 added. |
| 2026-03-13 | Abdulmuiz Adaranijo | PRs #135-137 merged. PR #135: 132 tests for flexible-working (70) + onboarding (62) with rollback assertions. PR #136: React Compiler (`reactCompiler: true`) + Turbopack filesystem caching (dev-only). Radix unified package migration attempted and dropped (Turbopack dev-mode Module serialisation errors). PR #137 (CLI): HR-only leave types hidden from non-admin views, system permissions visibility fix, notification scroll. 1251 tests, 52 files, zero open PRs. |
| 2026-03-13 | Abdulmuiz Adaranijo | Resources restructure PR D: 9-category taxonomy (migration 00056). Soft-deleted old 3 categories (Policies, Guides, Templates), seeded 9 top-level + 43 subcategories with icons, colours, visibility. Fixed article/editor breadcrumbs for subcategories (parent chain). Updated legacy redirect pages. Route promotion (PR C): `/intranet/resources` → `/resources` top-level sidebar with BookOpen icon. Gemini review fixes: removed 3 redundant type casts. 1119 tests, 50 files. |
| 2026-03-12 | Abdulmuiz Adaranijo | Resources restructure PRs #127, #130, #128 merged. Systems admin permissions broadened (migration 00052). PC user type removed — `pathways_coordinator` → `staff` + `is_external` (migration 00053). Content editor permission added (migration 00054). Proxy redirect loop fix for new_user after induction. Gemini review fixes across all 3 PRs (accessible switch tests, VisibilityBadge extraction, toggle mapping). PR #131 open for subcategories + visibility. 1118 tests, 50 files. |
| 2026-03-12 | Abdulmuiz Adaranijo | Brand colour refinement (4 PRs #121-123, #125): Link colour token (`--link` = teal/light-blue), icon palette (6 MCR brand swatches, darkened light-mode foregrounds, legacy key mapping), avatar hash (3-colour Navy/Teal/Wine djb2), pink WCAG fix (#FF82B2 → #DA417C), Google default avatar filter (`filterAvatarUrl()`). 16 avatar files, 7 link files, 2 icon files + CSS tokens. 1112 tests, 50 files. |
| 2026-03-12 | Abdulmuiz Adaranijo | Input validation hardening (PRs #115-120): SVG upload removal + DB migration, CSS hex colour validation, leave type validation (LEAVE_TYPE_CONFIG), generic error messages (95 instances, 17 files), path traversal + UUID validation, 3-tier string length limits on all HR free-text fields. Shared `src/lib/validation.ts` (isValidHexColour, isValidUUID, validateTextLength). 37 client-side maxLength attributes. 1099 tests, 50 files. Design system doc created (`docs/design-system.md`). |
| 2026-03-11 | Abdulmuiz Adaranijo | Auto-save (PR #114): Notion-style debounced saves (5s), useAutoSave hook with state machine + concurrent save protection, SaveStatusIndicator, create→edit transition, beforeunload safety net. 15 tests, 1073 total. |
| 2026-03-11 | Abdulmuiz Adaranijo | Editor tooltips + toolbar (PR #113): 25+ toolbar buttons with Google Docs-style tooltips, heading dropdown (H1-H4), subscript/superscript, alignment, checklist, indent/outdent, text colour (11), highlight (9), undo/redo, clear formatting. 8 new Tiptap extensions, 3 new files. Post-merge fixes: checklist CSS, Vercel build, reactive indent/outdent + heading state. |
| 2026-03-11 | Abdulmuiz Adaranijo | Breadcrumb consistency (PR #112): Standardised breadcrumbs across all 24 pages. Renamed stale root labels (HR→Admin, Intranet→Home), added breadcrumbs to 8 admin pages, replaced manual headers with PageHeader, visual refresh (/ separator, hover underlines). |
| 2026-03-11 | Abdulmuiz Adaranijo | Sidebar declutter (PR #111): semantic regrouping (Intranet→Home, HR→Me, Working Location→Location), admin separation (single Admin dashboard link), `/hr` now admin-only with non-admin redirect. Resources overhaul PRs #109-110 merged (soft-delete, kebab menus, featured articles, category management, icon picker). |
| 2026-03-11 | Abdulmuiz Adaranijo | Security audit remediation: PRs #106 (open redirect, error leakage, timing-safe webhook, article image proxy) + #107 (SET search_path on 8 early SECURITY DEFINER functions). Rate limiting documented as future work (requires Upstash Redis). |
| 2026-03-10 | Abdulmuiz Adaranijo | Resources editor overhaul: PRs #102-105 merged. Full formatting suite, full-page editor, article outline sidebar. 12 resource components, 5 resource routes, custom callout extension. |
| 2026-03-10 | Abdulmuiz Adaranijo | Sync: PRs #100 and #101 merged. All PRs #92-101 now merged. Clean main, 1057 tests. No open PRs. |
| 2026-03-10 | Abdulmuiz Adaranijo | Initial document creation |
