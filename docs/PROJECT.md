# MCR Pathways Intranet — Project Documentation

> **Owner:** Abdul-Muiz Adaranijo
> **Status:** Active development
> **Last reviewed:** 2026-03-10
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
- **Staff** — full access to all modules (HR, Sign-In, Learning, Intranet)
- **Pathways Coordinators** — access to Learning and Intranet modules only
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
| Google APIs | googleapis (Calendar integration) | 171.4.0 |
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

Migration files are in `supabase/migrations/` and run in numeric order (49 files, `00001` through `00048` plus a combined migration).

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
| Dashboard | `/hr` | HR metrics, charts |
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
| Org Chart | `/hr/org-chart` | Visual tree (react-d3-tree) |
| My Team | `/hr/team` | Line manager team view |

**Server Actions:** 11 action files, 84+ server actions total
**Components:** 59 files in `src/components/hr/`
**Shared config:** `src/lib/hr.ts` (938 lines — leave types, statuses, formatters, constants)

For the detailed HR roadmap, see `docs/hr-plan.md`.

### Learning & Development Module (complete)

Course management with admin dashboard, progress tracking, and compliance training.

**Routes:** 10 pages under `/learning`

| Feature | Route |
|---|---|
| Dashboard | `/learning` |
| Course Catalogue | `/learning/courses` |
| Course Detail | `/learning/courses/[id]` |
| Lesson View | `/learning/courses/[id]/lessons/[lessonId]` |
| My Courses | `/learning/my-courses` |
| Tool Shed | `/learning/tool-shed` |
| Admin: Courses | `/learning/admin/courses` |
| Admin: Course Detail | `/learning/admin/courses/[id]` |
| Admin: Reports | `/learning/admin/reports` |

**Key features:** Course enrolment, lesson completion tracking, quiz system, compliance due dates, admin CRUD, notifications on course publish.

### Intranet Module (complete)

Internal communications — news feed, resources/knowledge base, and induction.

**Routes:** 16 pages under `/intranet`

| Feature | Route |
|---|---|
| News Feed | `/intranet` |
| Guides (redirect) | `/intranet/guides` → `/intranet/resources` |
| Policies (redirect) | `/intranet/policies` → `/intranet/resources` |
| Weekly Roundup | `/intranet/weekly-roundup` |
| Resources | `/intranet/resources` |
| Resource Category | `/intranet/resources/[categorySlug]` |
| Article View | `/intranet/resources/[categorySlug]/[articleSlug]` |
| New Article (admin) | `/intranet/resources/[categorySlug]/new` |
| Edit Article (admin) | `/intranet/resources/[categorySlug]/[articleSlug]/edit` |
| Induction Hub | `/intranet/induction` (9 sub-pages) |

**Key features:** Rich text posts (Tiptap), @mentions with notifications, reactions, comments, link previews with SSRF protection, image lightbox, file attachments, pin/unpin (HR admin), weekly roundup.

**Resources/Knowledge Base:** Full-page editor (Confluence-style) with fixed toolbar, full formatting suite (headings, inline styles, lists, blockquotes, links, images, tables, callouts, code blocks with syntax highlighting, horizontal rules). Custom callout extension (info/tip/warning/danger). Article outline sidebar (table of contents) with IntersectionObserver-based active heading tracking. Two-column reading view (content + outline). 12 component files, `tiptap-callout.ts` custom extension, shared `CALLOUT_CONFIG`.

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

**49 migration files** in `supabase/migrations/`, numbered `00001` through `00048` plus a combined migration.

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

Key functions: `complete_lesson_and_update_progress`, `generate_weekly_roundup`, `has_module_access`, `is_hr_admin`, `is_line_manager`, `notify_course_published`, `submit_quiz_attempt`, `unpin_expired_roundups`.

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

| Module | `staff` | `pathways_coordinator` | `new_user` |
|---|---|---|---|
| `/hr` | Yes | No | No |
| `/sign-in` | Yes | No | No |
| `/learning` | Yes | Yes | No |
| `/intranet` | Yes | Yes | No |
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
- **Files:** 48 test files, co-located with source files (`.test.ts` / `.test.tsx`)
- **Coverage:** 1057+ tests across 48 files

### Test Categories

| Category | Count | Examples |
|---|---|---|
| Action tests | 19 | Server action validation, auth gating |
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

- `flexible-working/actions.ts` (1167 lines, 12 actions) — zero tests
- `onboarding/actions.ts` (1140 lines, 18 actions) — zero tests
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

---

## Key Files Reference

### Configuration

| File | Purpose |
|---|---|
| `next.config.ts` | Next.js config, security headers, CSP, image remotes |
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
| `src/lib/learning.ts` | L&D utilities |
| `src/lib/intranet.ts` | Intranet utilities |
| `src/lib/tiptap.ts` | Tiptap rich text utilities (extractPlainText, extractMentionIds, extractHeadings, slugifyHeading) |
| `src/lib/tiptap-callout.ts` | Custom Tiptap callout extension + shared CALLOUT_CONFIG |
| `src/lib/url.ts` | URL utilities (isValidHttpUrl, extractUrls, linkifyText, proxyImageUrl, sanitizeRedirectPath) |
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

### ADR-009: Full-page editor over dialog for articles

**Context:** The original Resources module used a Dialog (modal) for creating/editing articles. Research across Notion, Confluence, GitBook, Guru, Slite, BreatheHR, CharlieHR, BambooHR, Personio, and HiBob confirmed every serious knowledge base platform uses a full-page editor, not a modal.

**Decision:** Replace the article form dialog with dedicated full-page editor routes (`/new` and `/edit`). Use a fixed toolbar (Confluence-style) rather than bubble menu or slash commands, since HR admins are not tech-savvy. Reserve "new" and "edit" as forbidden article slugs to prevent route collisions.

**Consequences:** Better editing experience with more screen space, Confluence-familiar toolbar for non-technical users. Trade-off: two new route files instead of a single dialog component. The dialog approach was deleted entirely (`article-form-dialog.tsx`).

---

## Known Issues & Technical Debt

### High Priority

- **Missing tests for flexible working** — `flexible-working/actions.ts` (1167 lines, 12 actions) has zero tests. This module has statutory compliance requirements (Employment Rights Act 1996).
- **Missing tests for onboarding** — `onboarding/actions.ts` (1140 lines, 18 actions) has zero tests.
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

- Maternity leave showing for regular employees (filter `HR_ONLY_LEAVE_TYPES`)
- Notification dropdown has no scroll for many notifications
- Weekend calendar cells nearly invisible (`bg-muted/30` on `bg-background`)
- ~~"HR" sidebar naming unintuitive for employees~~ (addressed by sidebar declutter)
- System Permissions visible on non-admin Profile view

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

- Rate limiting on API endpoints (Upstash Redis for Vercel serverless). Priority: `/api/kiosk/confirm`, `/auth/confirm`, `/api/calendar/webhook`
- Error monitoring integration (Sentry or Datadog)
- CI/CD pipeline (GitHub Actions)
- Scheduled notification jobs (daily digest for HR)

---

## Changelog

| Date | Author | Summary |
|---|---|---|
| 2026-03-11 | Abdul-Muiz Adaranijo | Security audit remediation: PRs #106 (open redirect, error leakage, timing-safe webhook, article image proxy) + #107 (SET search_path on 8 early SECURITY DEFINER functions). Rate limiting documented as future work (requires Upstash Redis). |
| 2026-03-10 | Abdul-Muiz Adaranijo | Resources editor overhaul: PRs #102-105 merged. Full formatting suite, full-page editor, article outline sidebar. 12 resource components, 5 resource routes, custom callout extension. |
| 2026-03-10 | Abdul-Muiz Adaranijo | Sync: PRs #100 and #101 merged. All PRs #92-101 now merged. Clean main, 1057 tests. No open PRs. |
| 2026-03-10 | Abdul-Muiz Adaranijo | Initial document creation |
