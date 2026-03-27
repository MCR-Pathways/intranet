# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Style

- **Use British English** in all user-facing text, error messages, comments, and documentation. Examples: colour, organise, catalogue, defence, unauthorised, enrolment. CSS/Tailwind class names and framework terms (e.g. `text-center`, `color` CSS property) are exempt.

### Writing — avoid AI patterns

Apply the humanizer skill (`~/.claude/skills/humanizer/SKILL.md`) to all text output. Key rules:

- **No significance inflation.** Don't say "pivotal", "testament", "vital role", "evolving landscape", "marks a shift". Just state the fact.
- **No AI vocabulary.** Avoid: additionally, crucial, delve, enhance, foster, garner, highlight, intricate, key (adj), landscape (abstract), pivotal, showcase, tapestry, testament, underscore, valuable, vibrant.
- **No promotional tone.** Drop: boasts, vibrant, rich (figurative), profound, nestled, in the heart of, groundbreaking, renowned, breathtaking, stunning.
- **No -ing padding.** Don't tack "highlighting...", "ensuring...", "reflecting...", "contributing to..." onto sentences for fake depth.
- **No copula avoidance.** Use "is" and "has", not "serves as", "stands as", "features", "boasts".
- **No rule of three.** Don't force ideas into triplets. Two is fine. Four is fine. Whatever fits.
- **No negative parallelisms.** Drop "not only X but also Y" and "it's not just X, it's Y".
- **No synonym cycling.** If you said "the function", say "the function" again. Don't rotate through "the method", "the routine", "the procedure".
- **No false ranges.** Don't use "from X to Y" unless X and Y are on a real scale.
- **No em dash overuse.** Use commas or full stops instead. One em dash per page max.
- **No mechanical boldface.** Don't bold every key term.
- **No inline-header lists.** Don't start list items with `**Bold Header:** description`. Just write the point.
- **No filler.** Cut "in order to", "due to the fact that", "it is important to note that", "at its core".
- **No hedging.** Don't say "it could potentially be argued that". Say the thing.
- **No sycophancy.** Drop "Great question!", "Absolutely!", "You're right that...". Just answer.
- **No generic conclusions.** Don't end with "the future looks bright" or "exciting times ahead".
- **No curly quotes.** Use straight quotes ("") not smart quotes.
- **Have a voice.** Vary sentence length. Be direct. Have opinions when appropriate. Short sentences work. So do longer ones that take a different shape.

## Development Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run tests (single run)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Database Migrations

```bash
DATABASE_URL="postgresql://..." node scripts/run-migrations.mjs
DATABASE_URL="postgresql://..." node scripts/run-migrations.mjs --check-only  # Schema health check only
```

Migration files live in `supabase/migrations/` and run in numeric order.

### Local Supabase

Config in `supabase/config.toml`. Ports: API 54321, DB 54322, Studio 54323, Inbucket 54324.

## Architecture

Next.js 16 App Router with Supabase (PostgreSQL) backend. React 19, TypeScript strict mode, Tailwind CSS v4, Shadcn/Radix UI components, Lucide icons.

### Route Groups

- `(auth)/` — Public routes: `/login`, `/auth/callback` (OAuth), `/auth/confirm` (email OTP)
- `(protected)/` — Authenticated routes wrapped in `AppLayout` (header + sidebar)

### Authentication & Authorization

- **Supabase Auth** with Google OAuth and email OTP (magic links)
- **Domain restriction**: Only `@mcrpathways.org` emails allowed
- **Proxy** (`src/proxy.ts`): Checks auth, fetches profile, enforces module access by `user_type` + `is_external`, redirects users needing induction
- **User types**: `staff` (full access for internal, restricted for external), `new_user` (induction only)
- **External staff** (`is_external = true`): School-employed Pathways Coordinators — can access `/learning` and `/intranet` only
- **Module access**: `/hr` and `/sign-in` → internal staff only; `/learning` and `/intranet` → all staff (internal + external)

### Supabase Client Pattern

- **Server**: `createClient()` from `src/lib/supabase/server.ts` — use in Server Components and Server Actions
- **Browser**: `createClient()` from `src/lib/supabase/client.ts` — use in Client Components
- **Supabase Middleware**: `updateSession()` from `src/lib/supabase/middleware.ts` — refreshes session cookies

### Auth Helpers (`src/lib/auth.ts`)

- `getCurrentUser()` — Returns `{ supabase, user, profile }`. Uses `PROFILE_SELECT` to exclude sensitive fields.
- `requireHRAdmin()` — Gate for admin-only server actions. Throws if not authenticated or not `is_hr_admin`.

### Data Flow Pattern

1. **Server Component** calls `getCurrentUser()`, fetches data via Supabase, passes props to Client Components
2. **Client Components** use `useState`/`useMemo` for UI state, call Server Actions via `useTransition()`
3. **Server Actions** (in `actions.ts` files) authenticate, sanitize inputs, mutate DB, call `revalidatePath()`

### Server Actions Location

Each route group has its own `actions.ts` (20 action files total):
- `src/app/(auth)/actions.ts` — sign out
- `src/app/(protected)/hr/` — `users/`, `profile/`, `leave/`, `absence/`, `assets/`, `compliance/`, `departments/`, `key-dates/`, `leaving/`, `flexible-working/`, `onboarding/` (each has `actions.ts`, requires `requireHRAdmin()`)
- `src/app/(protected)/intranet/actions.ts` — news feed posts, polls, comments, mentions
- `src/app/(protected)/intranet/induction/actions.ts` — induction progress
- `src/app/(protected)/notifications/actions.ts` — notification read status
- `src/app/(protected)/sign-in/actions.ts` — sign-in entries, team history, Google Calendar sync
- `src/app/(protected)/learning/` — `my-courses/actions.ts`, `admin/courses/actions.ts`, `admin/reports/actions.ts`, `courses/[id]/actions.ts`, `tool-shed/actions.ts`
- `src/app/(protected)/resources/` — `actions.ts` (categories, articles), `drive-actions.ts` (Google Docs linking, sync, webhooks)

### Key Patterns

- **Input sanitization**: Whitelist allowed fields before DB writes (see `updateUserProfile()` in HR actions)
- **Explicit SELECT**: Always use explicit column lists, never `select("*")`. Sensitive fields like `google_refresh_token` are excluded via `PROFILE_SELECT`.
- **`useUser()` hook** (`src/hooks/use-user.ts`): Client-side auth state with `isStaff`, `isHRAdmin`, `isLineManager` helpers and `hasModuleAccess()` check
- **`cn()` utility** (`src/lib/utils.ts`): Combines `clsx` + `tailwind-merge` for className composition

### Database

Types auto-generated in `src/types/database.types.ts`. Key tables: `profiles`, `teams`, `manager_teams`, `courses`, `course_enrolments`, `section_quizzes`, `induction_progress`, `notifications`, `resource_articles`, `resource_categories`, `tool_shed_entries`, `course_feedback`, `leave_requests`, `absence_records`, `sign_in_entries`.

### Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-only)
- `NEXT_PUBLIC_APP_URL` — App URL (e.g. `http://localhost:3000`)
- `NEXT_PUBLIC_ALGOLIA_APP_ID` — Algolia application ID (`CFRPCC52U5`)
- `NEXT_PUBLIC_ALGOLIA_SEARCH_KEY` — Algolia search-only API key (public)
- `ALGOLIA_ADMIN_KEY` — Algolia admin API key (server-only)
- `GOOGLE_SERVICE_ACCOUNT_KEY` — Base64-encoded Google service account JSON (server-only)
- `GOOGLE_DRIVE_WEBHOOK_SECRET` — Secret for Drive webhook verification (server-only)
- `GOOGLE_CALENDAR_WEBHOOK_SECRET` — Secret for Calendar webhook verification (server-only)
- `GOOGLE_DRIVE_ADMIN_EMAIL` — Email to impersonate for Drive API (server-only)
- `KIOSK_TOKEN` — Shared secret for kiosk confirmation endpoint (server-only)
- `RESEND_API_KEY` — Resend email API key (server-only, dormant until setup)
- `CRON_SECRET` — Vercel Cron job authentication (server-only, dormant until setup)
- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST URL (server-only, optional — rate limiting disabled without it)
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token (server-only, optional)

## Workflow

- Create a feature branch for every piece of work: `feature/<name>` for new features, `fix/<name>` for bug fixes.
- PRs target the `main` branch. Always create a PR via `gh pr create` before merging.

## Testing

Vitest 4 + React Testing Library + jsdom. Config in `vitest.config.ts`, setup in `vitest.setup.ts`, test-specific types in `tsconfig.test.json`.

### Test File Convention

Test files are co-located with source files using `.test.ts` / `.test.tsx` suffix.

### Mocking Supabase in Tests

**For server actions** — mock `@/lib/auth` (`requireHRAdmin` / `getCurrentUser`) instead of the low-level Supabase client. Then mock only the simple `.from().update().eq()` chain the action itself uses.

**For proxy** — mock `@/lib/supabase/middleware` (`updateSession`) to control auth state, then mock the `.from().select().eq().single()` chain for profile fetching.

**Use `vi.hoisted()`** when mock variables need to be available inside `vi.mock()` factory functions (which are hoisted above all imports).

See `src/app/(protected)/hr/users/actions.test.ts` and `src/proxy.test.ts` for reference patterns. The mock factory in `src/__mocks__/supabase.ts` documents the full strategy.

## Domain-Specific Rules

Domain-specific lessons and patterns live in nested CLAUDE.md files that auto-load when working in that directory:

| Directory | Contents |
|-----------|----------|
| `src/app/(protected)/resources/CLAUDE.md` | Google Docs integration, Algolia indexing, category hierarchy, HTML sanitisation |
| `src/app/(protected)/learning/CLAUDE.md` | Course/quiz architecture, Tool Shed, feedback, admin builder |
| `src/app/(protected)/hr/CLAUDE.md` | HR module patterns, action file structure, config-driven badges |
| `src/app/(protected)/sign-in/CLAUDE.md` | Working location, Google Calendar sync, CSV export |
| `src/lib/CLAUDE.md` | Shared utilities, security, Supabase patterns, design tokens, table patterns |
| `src/__mocks__/CLAUDE.md` | Testing patterns, Supabase mocking strategy, reference test files |

Always consult `docs/design-system.md` before doing anything colour-related.

## Lessons Learned

These are universal rules that apply to every task regardless of which module you're working in.

### Server Actions & Data

**Never use the browser Supabase client for mutations.** Client-side Supabase operations hang indefinitely in this app. All database writes and auth operations must go through Server Actions using the server-side Supabase client.

**Handle `NEXT_REDIRECT` errors in Server Actions.** When a server action calls `redirect()`, Next.js throws a `NEXT_REDIRECT` error. Catch blocks must re-throw this error or check for it to avoid swallowing redirects.

**All exports in "use server" files must be async.** Sync exports cause Vercel deployment failures.

**Split large action files by feature area.** When an actions.ts file exceeds ~800 lines, create a separate actions file for the new feature (e.g. `section-actions.ts` alongside `actions.ts`).

**Always add `.catch()` and `.finally()` to server action promises in client components.** Without `.catch()`, a rejected server action leaves UI state stuck (loading spinners, disabled inputs).

**Don't block user actions on non-critical follow-up failures.** Log a warning but don't return an error when a non-critical follow-up (e.g. `refreshSession()`) fails after the core action succeeded.

**Order multi-step mutations: update "main" record first, dependent records second.** Add rollback logic for multi-step Supabase mutations. Wrap non-critical follow-up operations in try/catch. Delete DB records before files, not after.

### Database & Migrations

**Make all migrations idempotent.** Use `IF NOT EXISTS` / `DROP IF EXISTS` guards so migrations can be re-run safely.

**Avoid PostgreSQL ENUMs.** Use TEXT columns with CHECK constraints instead. ENUMs cause transaction failures and are difficult to modify in production.

**Run migrations immediately after merging schema-changing PRs.** Supabase `.select()` silently returns `{ data: null }` when a column doesn't exist — the symptom looks like an auth bug (infinite redirect loop), not a missing column.

**Raise exceptions for invalid inputs in DB functions, don't silently return.** Use `RAISE EXCEPTION` to make programming errors immediately obvious.

**Split RPCs into single-responsibility functions.** More modular — admin can recalculate without completing a lesson (data fixes, bulk ops).

### Security

**Write RLS policies with ownership checks, not blanket `true`.** INSERT/DELETE policies on junction tables should verify the current user owns the parent record via `EXISTS` subqueries.

**Never trust user-supplied IDs in SECURITY DEFINER functions.** Always use `auth.uid()` for identity — treat all parameters as untrusted input.

**Always set `search_path = ''` on SECURITY DEFINER functions.** Without a fixed search path, an attacker can hijack execution by creating objects in a schema they control.

**Sanitise user-controlled URLs before rendering as `href`.** Whitelist `href` values to `http://` and `https://` protocols. Use case-insensitive checks (`/^https?:\/\//i`).

**Validate redirect target parameters in auth callbacks.** User-controlled `next` query params must be validated via `sanitizeRedirectPath()` from `src/lib/url.ts`.

**Return generic error messages to clients, log details server-side.** Raw Supabase error messages expose schema details and table names.

**Use `timingSafeTokenCompare` consistently for ALL token/secret comparisons.** Even low-risk cases should use timing-safe comparison for defence-in-depth.

**Guard Record lookups from user input with `Object.hasOwn()`.** Keys like `"constructor"` or `"__proto__"` return `Object.prototype` properties instead of `undefined`.

**Never interpolate user input into PostgREST `.or()` filter strings.** Commas, periods, and parentheses are PostgREST operators. A user searching for `x,is_published.eq.false` can inject extra filter conditions and bypass visibility rules. Strip `,%_\\.()\"'` from any value interpolated into `.or()` template literals, or use parameterised methods (`.eq()`, `.ilike()`, `.contains()`) instead.

### React & Radix UI

**Use `onSelect` not `onClick` for Radix UI `DropdownMenuItem`.** Radix primitives have specific event handler contracts.

**Use `window.location.href` instead of `router.push()` inside Radix dialogs.** Router navigation conflicts with dialog event handling.

**Use `<Link>` with `asChild` on `DropdownMenuItem` for navigation.** The `router.push()` lesson applies specifically to Dialog `onOpenChange` handlers. `DropdownMenuItem asChild` + `<Link>` works correctly.

**Use plain `<div>` with absolute positioning instead of Radix Popover inside Dialog.** Dialog's modal focus trap kills portaled Popovers.

**Use `createElement()` for dynamic Lucide icons to satisfy React Compiler.** `createElement(resolveIcon(name), props)` avoids the `react-hooks/static-components` lint violation.

**Use `suppressHydrationWarning` for platform-specific rendering.** Values that depend on `navigator.platform` differ between server and client.

**Use custom DOM events, not synthetic KeyboardEvents, for cross-component communication.** Synthetic `KeyboardEvent` dispatch is fragile across browsers.

**Don't nest interactive elements — use sibling layout instead.** A `<Link>` inside a `<button>` is invalid HTML. Split into sibling elements.

**Add `group` class to parent when using `group-data-[...]` on children.** Tailwind's `group-data-*` targets the nearest ancestor with `class="group"`.

### CSS & Styling

**Use `bg-card` not `bg-background` for dialogs, modals, and form inputs.** When `--background` is grey, inputs with `bg-background` become invisible. Use `bg-card` for all elevated surfaces.

**Use `useMemo` for client-side list filtering and derived data.** Prevents unnecessary recalculations and unstable references that trigger re-renders.

**Consolidate `toLocaleDateString` calls into `formatDate()` / `formatShortDate()` from `src/lib/utils.ts`.** Check for duplicates before adding new inline date formatting.

**Don't re-declare inherited styles on child components.** If a parent sets `text-muted-foreground`, children inherit it via CSS inheritance.

**Use `className` not `style` for Tailwind colour values.** `getAvatarColour()` returns Tailwind classes — using `style={{ backgroundColor }}` puts the class name as a CSS value.

**Turbopack aggressively caches CSS custom properties.** After editing `globals.css`, clear `.next/` and restart the dev server. Always hard-refresh (Cmd+Shift+R).

**Use specific sr-only text on row action buttons.** Include the entity name: `Actions for {dept.name}`, not generic "Actions".

### Deployment & Infrastructure

**Never put server-only packages in `devDependencies` if production code imports them.** Vercel prunes devDependencies after build.

**Hard-refresh (Cmd+Shift+R) after Vercel deployments that change server action modules.** Stale cached JS bundles contain old server action IDs.

**Verify Tailwind plugins are installed, not just referenced.** `prose` classes do nothing if `@tailwindcss/typography` isn't installed and registered via `@plugin` in `globals.css`.

**Rate limiting on Vercel serverless requires an external store.** Use Upstash Redis (`@upstash/ratelimit`). Priority: `/api/kiosk/confirm`, `/auth/confirm`, `/api/calendar/webhook`, `/api/drive/webhook`.

**Always verify exploration agent claims against actual code.** Agents report false negatives AND false positives. Run your own `git log`, `grep`, and `read` to verify before acting.

### Process

**Extract shared logic to `src/lib/` immediately, not after review.** Don't wait for duplication to happen — extract on first write when the logic is non-trivial or security-sensitive.

**Push feature branches as PRs immediately, don't leave them local.** Even as draft — so the team can see work in progress.

**Wrap localStorage access in try/catch.** Can throw in private browsing mode or when storage is disabled/full.

**Listen to the `storage` event for cross-tab localStorage sync.** Subscribe to both your custom event (same-tab) and the browser `storage` event (cross-tab). Handle `event.key === null`.

**Use `raw_app_meta_data` for proxy JWT claims, not session storage.** Store frequently-checked profile fields in `auth.users.raw_app_meta_data` via a DB trigger. The proxy reads these from `user.app_metadata` (zero DB queries).

**Proxy external URLs at both write-time AND render-time for CSP compliance.** Old records still have raw external URLs. Exclude protocol-relative URLs (`//attacker.com`) from the "already relative" fast path.
