# MCR Pathways Intranet — Project Documentation

> **Owner:** Abdul-Muiz Adaranijo
> **Status:** Active development
> **Last reviewed:** 2026-03-26
> **Document updated during:** Periodic syncs

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

Migration files are in `supabase/migrations/` and run in numeric order (69 files, `00001` through `00068` plus a combined migration).

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

**Routes:** 22 pages under `/hr`

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

**Server Actions:** 11 action files, 84+ server actions total
**Components:** 59 files in `src/components/hr/`
**Shared config:** `src/lib/hr.ts` (938 lines — leave types, statuses, formatters, constants)

For the detailed HR roadmap, see `docs/hr-plan.md`.

### Learning & Development Module (Phase 1+2+3 complete)

Replacing LearnDash (WordPress LMS) with a custom-built LMS. Section-based courses with section quizzes, learner UI, certificate auto-issue, completion notifications, 4 lesson types (text, video, slides, rich_text), and `auth.uid()` RPC enforcement. See `docs/learning-overhaul.md` for comprehensive handover document.

**Status:** Phase 1 (schema + utilities + actions), Phase 2 (admin UI), and Phase 3 (learner UI + certificates + security) complete. PR #167 merged to main. PR #168 (wire components into pages + slides/rich_text admin support) pending. Migrations 00060-00068 applied to production Supabase. PRs #165 and #166 (Colin's) closed and superseded by #167.

**Routes:** 12 pages under `/learning`

| Feature | Route |
|---|---|
| Dashboard | `/learning` |
| Course Catalogue | `/learning/courses` |
| Course Detail | `/learning/courses/[id]` |
| Lesson View | `/learning/courses/[id]/lessons/[lessonId]` |
| Section Quiz | `/learning/courses/[id]/sections/[sectionId]/quiz` |
| My Courses | `/learning/my-courses` |
| Tool Shed | `/learning/tool-shed` |
| Admin: Courses | `/learning/admin/courses` |
| Admin: Course Detail | `/learning/admin/courses/[id]` |
| Admin: Reports | `/learning/admin/reports` |
| Certificate PDF | `/api/certificate/[id]/route` |

**New routes (planned, not yet built):** `/learning/certificates` (certificate wall), `/learning/certificates/[id]`, `/learning/tool-shed/new`, `/learning/tool-shed/[id]`, `/learning/tool-shed/[id]/edit`, `/learning/admin/tool-shed`

**Key components (Phase 3):** `section-accordion.tsx` (expandable sections in course detail), `section-quiz-player.tsx` (quiz UI with `submit_section_quiz_attempt` RPC), `lesson-renderer.tsx` (renders text/video/slides/rich_text lessons), rewritten `lesson-sidebar.tsx` (section-grouped, LinkedIn-style checkmarks).

**Key changes in overhaul:** Course→Sections→Lessons hierarchy, section quizzes (gate progression), 4 lesson types (text, video, slides, rich_text), PDF certificates (auto-issued via DB trigger on course completion), completion notifications (DB trigger), `auth.uid()` enforcement on all RPCs. Remaining: course feedback dialog, Tool Shed social learning rewrite, global Cmd+K search (Algolia), email notifications (Resend), course duplication, resume course, dashboard redesign.

**New DB tables:** `course_sections`, `section_quizzes`, `section_quiz_questions`, `section_quiz_options`, `section_quiz_attempts`, `certificates`, `course_feedback`, `tool_shed_entries`, `email_notifications`. Migrations 00060-00068.

**Migrations 00065-00068:** `00065` reconciliation (clean up old quiz tables, add slides/rich_text to lesson_type CHECK), `00066` delete empty courses, `00067` certificate auto-issue trigger (`generate_certificate_on_completion`), `00068` completion notification trigger.

**New dependencies:** `@react-pdf/renderer`, `resend`. New env var: `RESEND_API_KEY`.

### Intranet Module (complete)

Internal communications — news feed, resources/knowledge base, and induction.

**Routes:** 12 pages under `/intranet` + `/resources`

| Feature | Route |
|---|---|
| News Feed | `/intranet` |
| Weekly Roundup | `/intranet/weekly-roundup` |
| Induction Hub | `/intranet/induction` (9 sub-pages) |
| Resources Landing | `/resources` |
| Category View | `/resources/[...slug]` (1-3 level catch-all) |
| Article View | `/resources/article/[slug]` (flat, globally unique) |
| Settings (editor) | `/resources/settings` |

**Key features:** Rich text posts (Tiptap), @mentions with notifications, reactions, comments, link previews with SSRF protection, image lightbox, file attachments, pin/unpin (HR admin), weekly roundup.

**Resources/Knowledge Base (redesigned — PR #157):** Google Docs integration replaces Tiptap article editor. Content editors link Google Docs from Drive, HTML synced via webhooks, rendered with Tailwind `prose` classes. Sidebar tree navigation (3-level, collapsible to icon-only). Component page system for developer-created pages (e.g. org chart). Editor mode pencil toggle shows/hides admin controls. Settings page for folder registration, featured article curation, and category management. Algolia search with section-level indexing and deep links. Supabase Realtime for live content updates while viewing.

### Sign-In / Working Location Module (v2 complete)

Replaced the original daily sign-in with a schedule-based working location system.

**Route:** `/sign-in`

**Key features:** Weekly pattern planner, month calendar, Google Calendar sync (read + write-back via domain-wide delegation), team schedule grid (managers), kiosk check-in (`/kiosk`), daily reconciliation banners, CSV export.

**Key files:** `src/lib/sign-in.ts` (shared types, config), `src/app/(protected)/sign-in/actions.ts`, `docs/google-calendar-setup.md`

### Notifications

**Route:** `/notifications`

Bell icon in header with dropdown. Server-pushed notifications for @mentions, course publishing, etc.

---

## Database

### Overview

PostgreSQL on Supabase with Row Level Security (RLS) on all tables.

**69 migration files** in `supabase/migrations/`, numbered `00001` through `00068` plus a combined migration.

**26+ tables** — key ones:

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

Plus HR-specific tables added via migrations (leave, absence, assets, compliance, key dates, flexible working, onboarding, leaving).

### Database Functions (RPCs)

Key functions: `complete_lesson_and_update_progress`, `submit_section_quiz_attempt`, `generate_certificate_on_completion` (trigger), `generate_weekly_roundup`, `has_module_access`, `is_hr_admin`, `is_line_manager`, `notify_course_published`, `unpin_expired_roundups`. All RPCs enforce `auth.uid()` for identity.

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
- **Files:** 53 test files, co-located with source files (`.test.ts` / `.test.tsx`)
- **Coverage:** 1,267 tests across 53 files

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

- No E2E tests for multi-step HR workflows

---

## Deployment & Infrastructure

### Hosting

Vercel — automatic deployments from `main` branch.

### CI/CD

No GitHub Actions workflows configured. Deployments rely on Vercel's Git integration.

### Image Remotes

Allowed domains for `next/image`: `*.googleusercontent.com`, `*.supabase.co`.

### Error Monitoring

`src/lib/logger.ts` is a stub ready for Sentry/Datadog integration. Currently logs to console.

### Google Calendar Integration

Domain-wide delegation via Google service account. Setup documented in `docs/google-calendar-setup.md`. Webhook endpoint at `/api/calendar/webhook`.

### Google Drive Integration (Resources)

Service account accesses files shared with it directly (domain-wide delegation not yet configured for Drive — requires Super Admin). Webhook endpoint at `/api/drive/webhook` with timing-safe token verification. Watch channels expire after 7 days — renewal cron needed. Shared auth in `src/lib/google-auth.ts`. Env vars: `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_DRIVE_WEBHOOK_SECRET`.

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

### ADR-001: Supabase over custom backend

**Context:** Needed a backend with auth, database, storage, and RLS without building from scratch.

**Decision:** Use Supabase (hosted PostgreSQL with built-in auth, storage, and Row Level Security).

**Consequences:** Faster development, built-in auth flows (OAuth + magic links), RLS for security. Trade-off: vendor lock-in on Supabase-specific features (RLS policies, auth triggers, storage buckets).

### ADR-002: Server Actions over API routes

**Context:** Need a pattern for data mutations from the frontend.

**Decision:** Use Next.js Server Actions for all mutations. API routes only for webhooks and external integrations.

**Consequences:** Type-safe mutations, no REST API layer to maintain, automatic revalidation. Trade-off: all business logic lives in Next.js — harder to extract into a separate backend later.

### ADR-003: TEXT + CHECK over PostgreSQL ENUMs

**Context:** ENUMs caused transaction failures when the type didn't exist during trigger execution and are difficult to modify in production.

**Decision:** Use TEXT columns with CHECK constraints instead of ENUMs everywhere.

**Consequences:** Easier schema evolution, no migration issues with enum types. Trade-off: slightly less strict typing at the DB level.

### ADR-004: Tiptap for rich text

**Context:** News feed needed rich text (bold, italic, links, lists) with @mention support.

**Decision:** Use Tiptap editor with `content_json` (JSONB) storage and plain-text fallback for backward compatibility.

**Consequences:** Full rich text support with mention notifications. `TiptapRenderer` handles rendering stored JSON. Trade-off: Tiptap is a heavier dependency than a simple textarea.

### ADR-005: JWT app_metadata for auth claims

**Context:** Proxy was making a DB query on every request to check user type and induction status.

**Decision:** Store frequently-checked fields in `auth.users.raw_app_meta_data` via a DB trigger on profiles. Proxy reads from JWT claims (zero DB queries).

**Consequences:** Significant performance improvement — proxy is now DB-free in the common path. Trade-off: JWT claims can be stale until the next token refresh. DB fallback exists for pre-migration sessions.

### ADR-006: TanStack Table + Shadcn for data tables

**Context:** 17 tables across the app with inconsistent sorting, filtering, and pagination.

**Decision:** Standardise on `@tanstack/react-table` (headless) + Shadcn `<Table>` primitives. Shared `DataTable` component with `DataTableColumnHeader` and `DataTablePagination`.

**Consequences:** Consistent UX across all tables, built-in sorting/filtering/pagination. 15 of 17 tables migrated (2 skipped: calendar grid and simple report table).

### ADR-007: CSP-compliant image proxying

**Context:** Enforcing `img-src 'self'` CSP broke external images (Google profile photos, OG preview images).

**Decision:** Proxy external images through `/api/og-image` endpoint. New records store proxied URLs at creation; old records get render-time proxy via `proxyImageUrl()`.

**Consequences:** Full CSP compliance. Trade-off: extra request hop for images, 24hr cache needed to manage load.

### ADR-008: No browser Supabase mutations

**Context:** Client-side Supabase operations (inserts, updates, auth calls) hang indefinitely in this application.

**Decision:** All database writes and auth operations must go through Server Actions using the server-side Supabase client. The browser client is only used for real-time subscriptions.

**Consequences:** Reliable mutations, consistent auth handling. Trade-off: every mutation requires a Server Action, even simple ones.

### ADR-009: Full-page editor over dialog for articles (superseded by ADR-010)

> **Note:** This ADR was superseded by ADR-010. The Tiptap full-page editor was replaced by Google Docs integration in the Resources Redesign (PR #157).


**Context:** The original Resources module used a Dialog (modal) for creating/editing articles. Research across Notion, Confluence, GitBook, Guru, Slite, BreatheHR, CharlieHR, BambooHR, Personio, and HiBob confirmed every serious knowledge base platform uses a full-page editor, not a modal.

**Decision:** Replace the article form dialog with dedicated full-page editor routes (`/new` and `/edit`). Use a fixed toolbar (Confluence-style) rather than bubble menu or slash commands, since HR admins are not tech-savvy. Reserve "new" and "edit" as forbidden article slugs to prevent route collisions.

**Consequences:** Better editing experience with more screen space, Confluence-familiar toolbar for non-technical users. Trade-off: two new route files instead of a single dialog component. The dialog approach was deleted entirely (`article-form-dialog.tsx`).

### ADR-010: Google Docs integration over Tiptap editor for Resources

**Context:** The Tiptap article editor required content editors to learn a new tool. MCR Pathways already uses Google Workspace — staff create documents in Google Docs. Research across Guru, Tettra, Slite, and SharePoint confirmed that convert-and-store (export HTML from Google Docs) is the industry standard for organisations already on Google Workspace.

**Decision:** Replace the Tiptap article editor with Google Docs integration. Content editors link existing Google Docs, which are synced via Drive API webhooks. HTML is sanitised, cached in the DB (`synced_html`), and rendered with Tailwind `prose` classes. Editing stays in Google Docs — the intranet is read-only with live updates via Supabase Realtime.

**Consequences:** Zero learning curve for content editors (they already use Google Docs). Live sync via webhooks (~4-10s). Trade-offs: dependency on Google Drive API (7-day webhook expiry needs renewal cron), base64 images in exported HTML can make large docs heavy, requires Google service account setup.

### ADR-011: Algolia over PostgreSQL FTS for search

**Context:** Manager directive (2026-03-18). PostgreSQL full-text search works but lacks section-level results and deep linking. Algolia provides instant search with section-level indexing (DocSearch pattern).

**Decision:** Use Algolia for Resources search. Section-level indexing (heading + content pairs) enables deep linking to specific sections within articles. Client-side React InstantSearch for the search UI. Indexing happens server-side during link/sync/unlink operations.

**Consequences:** Superior search UX with section-level results and deep links. Trade-off: external service dependency, requires env vars for API keys, free tier sufficient for current scale.

### ADR-012: Component pages via registry pattern

**Context:** Some resources (e.g. org chart) are interactive React components, not documents. Needed a way for developers to create component pages that content editors can manage (metadata, category, visibility).

**Decision:** Component registry pattern (`src/lib/resource-components.ts`). Maps `component_name` → `{ component, getData }`. Content editors see component pages in the tree and can manage metadata. Developers create the React component + register it.

**Consequences:** Clean separation: developers own the code, editors own the metadata. Org chart relocated from `/hr/org-chart` to Resources as the first component page. Trade-off: adding new component pages requires a code change + migration.

---

## Known Issues & Technical Debt

### High Priority

- **No error monitoring** — `src/lib/logger.ts` is a console stub. No Sentry/Datadog integration.
- **No rate limiting** — API endpoints have no request throttling. Requires Upstash Redis for Vercel serverless (in-memory limiters don't persist across cold starts).

### Medium Priority

- **Large action files** — `absence/actions.ts` (966 lines), `flexible-working/actions.ts` (1167 lines), `onboarding/actions.ts` (1140 lines) could benefit from splitting.
- **Flat HR component structure** — all 59 HR components in `src/components/hr/`. Consider grouping by feature as Phase 3 grows.
- **No CI/CD pipeline** — no GitHub Actions; relies entirely on Vercel's Git integration.
- **Absence hard-deletes** — line 381 of `absence/actions.ts` hard-deletes records. Soft-delete with `deleted_at` would be safer for audit trails.
- **No scheduled notifications** — key dates, compliance expiry, stale leave requests require manual dashboard checks. A daily digest would help.
- **No bulk operations** — leave entitlements, compliance assignments, onboarding checklists are all one-at-a-time.

### Low Priority / UX

- Weekend calendar cells nearly invisible (`bg-muted/30` on `bg-background`)
- ~~"HR" sidebar naming unintuitive for employees~~ (addressed by sidebar declutter, PR #111)
- ~~Maternity leave showing for regular employees~~ (fixed in PR #137)
- ~~Notification dropdown scroll~~ (fixed in PR #137)
- ~~System Permissions visible on non-admin Profile view~~ (fixed in PR #137)

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

- Rate limiting on API endpoints (Upstash Redis for Vercel serverless). Priority: `/api/kiosk/confirm`, `/auth/confirm`, `/api/calendar/webhook`, `/api/drive/webhook`
- Error monitoring integration (Sentry or Datadog)
- CI/CD pipeline (GitHub Actions)
- Scheduled notification jobs (daily digest for HR)

---

## Changelog

| Date | Author | Summary |
|---|---|---|
| 2026-03-26 | Abdul-Muiz Adaranijo | CLAUDE.md restructured into nested domain-specific files (PR #179). 7 nested CLAUDE.md files auto-load by directory. 8 memory files retired. Humanizer writing patterns added. Resources UX redesign merged (PR #164): sidebar tree removed, grouped index, category grid, "More in [folder]" sibling nav, scroll-spy TOC, recently viewed in search, nested join for parent category. docs/plan.md rewritten. Workflow rules expanded for full knowledge file lifecycle. |
| 2026-03-23 | Abdul-Muiz Adaranijo | Learning overhaul Phase 3 complete. PR #167 merged: learner UI (section-accordion.tsx, section-quiz-player.tsx, lesson-renderer.tsx), certificate auto-issue via DB trigger, completion notifications via DB trigger, auth.uid() RPC enforcement, 4 lesson types (text, video, slides, rich_text). Migrations 00065-00068 applied to production. PR #168 pending (wire components into pages + slides/rich_text admin support). PRs #165, #166 (Colin's) closed and superseded. Open PRs: #163 (rate limiting), #164 (resources UX), #168 (learning wire components). 1,267 tests, 53 files. |
| 2026-03-19 | Abdul-Muiz Adaranijo | Learning overhaul Phase 1+2. PR 1: 5 migrations (00060-00064), 4 utility files, section-actions.ts. PR 2: admin UI — section-manager.tsx (~350 lines), section-quiz-editor.tsx (~500 lines), rewritten course detail page for section-based hierarchy, combined quiz actions with rollback. LessonType "quiz" removed (knock-on fixes in 4 learner files). All 5 migrations applied to production Supabase. Build + lint clean, all CRUD verified live. Branch: `feature/learning-overhaul-migrations`. |
| 2026-03-19 | Abdul-Muiz Adaranijo | Resources post-launch fixes + enhancements. PR #162: Google Docs formatting preservation in HTML sanitiser (bold/italic spans → `<strong>`/`<em>`, first-row `<td>` → `<th>`, column widths converted to responsive percentages). PR #161: cascading category selection (Category → Subcategory → Folder). PR #160: prose rendering fix (`@tailwindcss/typography` was never installed). Earlier: jsdom→linkedom migration (PR #159), category dropdown error handling, error logging. 1,266 tests, 53 files. |
| 2026-03-18 | Abdul-Muiz Adaranijo | Resources module redesign (PR #157, 6 sub-PRs #151-156). Tiptap article editor replaced with Google Docs integration (Drive API, webhooks, HTML sanitisation). Category grid replaced with 3-level sidebar tree navigation. Component page system (org chart relocated from `/hr/org-chart`). Editor mode pencil toggle. Settings page (folder registration, featured curation, category management). Algolia search with section-level indexing. 3,081 lines of dead Tiptap code removed. 61 files changed, net +2,321 lines. Migrations 00058-00059. 1,257 tests, 52 files. |
| 2026-03-13 | Abdul-Muiz Adaranijo | Badge tonal redesign: Solid fills → subtle/tonal pills (bg-{colour}-50 + text-{colour}-700) across 4 core variants (default, success, warning, destructive). Aligns with Atlassian/Stripe/Shopify industry standard. Fixed 3 semantic variant mismatches (leave approved→success, onboarding Active→success, external-course-card uses shared categoryConfig). Design system §1.8 added. |
| 2026-03-13 | Abdul-Muiz Adaranijo | PRs #135-137 merged. PR #135: 132 tests for flexible-working (70) + onboarding (62) with rollback assertions. PR #136: React Compiler (`reactCompiler: true`) + Turbopack filesystem caching (dev-only). Radix unified package migration attempted and dropped (Turbopack dev-mode Module serialisation errors). PR #137 (CLI): HR-only leave types hidden from non-admin views, system permissions visibility fix, notification scroll. 1251 tests, 52 files, zero open PRs. |
| 2026-03-13 | Abdul-Muiz Adaranijo | Resources restructure PR D: 9-category taxonomy (migration 00056). Soft-deleted old 3 categories (Policies, Guides, Templates), seeded 9 top-level + 43 subcategories with icons, colours, visibility. Fixed article/editor breadcrumbs for subcategories (parent chain). Updated legacy redirect pages. Route promotion (PR C): `/intranet/resources` → `/resources` top-level sidebar with BookOpen icon. Gemini review fixes: removed 3 redundant type casts. 1119 tests, 50 files. |
| 2026-03-12 | Abdul-Muiz Adaranijo | Resources restructure PRs #127, #130, #128 merged. Systems admin permissions broadened (migration 00052). PC user type removed — `pathways_coordinator` → `staff` + `is_external` (migration 00053). Content editor permission added (migration 00054). Proxy redirect loop fix for new_user after induction. Gemini review fixes across all 3 PRs (accessible switch tests, VisibilityBadge extraction, toggle mapping). PR #131 open for subcategories + visibility. 1118 tests, 50 files. |
| 2026-03-12 | Abdul-Muiz Adaranijo | Brand colour refinement (4 PRs #121-123, #125): Link colour token (`--link` = teal/light-blue), icon palette (6 MCR brand swatches, darkened light-mode foregrounds, legacy key mapping), avatar hash (3-colour Navy/Teal/Wine djb2), pink WCAG fix (#FF82B2 → #DA417C), Google default avatar filter (`filterAvatarUrl()`). 16 avatar files, 7 link files, 2 icon files + CSS tokens. 1112 tests, 50 files. |
| 2026-03-12 | Abdul-Muiz Adaranijo | Input validation hardening (PRs #115-120): SVG upload removal + DB migration, CSS hex colour validation, leave type validation (LEAVE_TYPE_CONFIG), generic error messages (95 instances, 17 files), path traversal + UUID validation, 3-tier string length limits on all HR free-text fields. Shared `src/lib/validation.ts` (isValidHexColour, isValidUUID, validateTextLength). 37 client-side maxLength attributes. 1099 tests, 50 files. Design system doc created (`docs/design-system.md`). |
| 2026-03-11 | Abdul-Muiz Adaranijo | Auto-save (PR #114): Notion-style debounced saves (5s), useAutoSave hook with state machine + concurrent save protection, SaveStatusIndicator, create→edit transition, beforeunload safety net. 15 tests, 1073 total. |
| 2026-03-11 | Abdul-Muiz Adaranijo | Editor tooltips + toolbar (PR #113): 25+ toolbar buttons with Google Docs-style tooltips, heading dropdown (H1-H4), subscript/superscript, alignment, checklist, indent/outdent, text colour (11), highlight (9), undo/redo, clear formatting. 8 new Tiptap extensions, 3 new files. Post-merge fixes: checklist CSS, Vercel build, reactive indent/outdent + heading state. |
| 2026-03-11 | Abdul-Muiz Adaranijo | Breadcrumb consistency (PR #112): Standardised breadcrumbs across all 24 pages. Renamed stale root labels (HR→Admin, Intranet→Home), added breadcrumbs to 8 admin pages, replaced manual headers with PageHeader, visual refresh (/ separator, hover underlines). |
| 2026-03-11 | Abdul-Muiz Adaranijo | Sidebar declutter (PR #111): semantic regrouping (Intranet→Home, HR→Me, Working Location→Location), admin separation (single Admin dashboard link), `/hr` now admin-only with non-admin redirect. Resources overhaul PRs #109-110 merged (soft-delete, kebab menus, featured articles, category management, icon picker). |
| 2026-03-11 | Abdul-Muiz Adaranijo | Security audit remediation: PRs #106 (open redirect, error leakage, timing-safe webhook, article image proxy) + #107 (SET search_path on 8 early SECURITY DEFINER functions). Rate limiting documented as future work (requires Upstash Redis). |
| 2026-03-10 | Abdul-Muiz Adaranijo | Resources editor overhaul: PRs #102-105 merged. Full formatting suite, full-page editor, article outline sidebar. 12 resource components, 5 resource routes, custom callout extension. |
| 2026-03-10 | Abdul-Muiz Adaranijo | Sync: PRs #100 and #101 merged. All PRs #92-101 now merged. Clean main, 1057 tests. No open PRs. |
| 2026-03-10 | Abdul-Muiz Adaranijo | Initial document creation |
