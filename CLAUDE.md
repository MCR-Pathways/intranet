# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Style

- **Use British English** in all user-facing text, error messages, comments, and documentation. Examples: colour, organise, catalogue, defence, unauthorised, enrolment. CSS/Tailwind class names and framework terms (e.g. `text-center`, `color` CSS property) are exempt.

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
- **Middleware** (`src/middleware.ts`): Checks auth, fetches profile, enforces module access by `user_type`, redirects users needing induction
- **User types**: `staff` (full access), `pathways_coordinator` (learning + intranet), `new_user` (induction only)
- **Module access map**: `/hr` and `/sign-in` → staff only; `/learning` and `/intranet` → staff + pathways_coordinator

### Supabase Client Pattern

- **Server**: `createClient()` from `src/lib/supabase/server.ts` — use in Server Components and Server Actions
- **Browser**: `createClient()` from `src/lib/supabase/client.ts` — use in Client Components
- **Middleware**: `updateSession()` from `src/lib/supabase/middleware.ts` — refreshes session cookies

### Auth Helpers (`src/lib/auth.ts`)

- `getCurrentUser()` — Returns `{ supabase, user, profile }`. Uses `PROFILE_SELECT` to exclude sensitive fields.
- `requireHRAdmin()` — Gate for admin-only server actions. Throws if not authenticated or not `is_hr_admin`.

### Data Flow Pattern

1. **Server Component** calls `getCurrentUser()`, fetches data via Supabase, passes props to Client Components
2. **Client Components** use `useState`/`useMemo` for UI state, call Server Actions via `useTransition()`
3. **Server Actions** (in `actions.ts` files) authenticate, sanitize inputs, mutate DB, call `revalidatePath()`

### Server Actions Location

Each route group has its own `actions.ts`:
- `src/app/(auth)/actions.ts` — sign out
- `src/app/(protected)/hr/users/actions.ts` — user management (requires `requireHRAdmin()`)
- `src/app/(protected)/intranet/induction/actions.ts` — induction progress
- `src/app/(protected)/notifications/actions.ts` — notification read status

### Key Patterns

- **Input sanitization**: Whitelist allowed fields before DB writes (see `updateUserProfile()` in HR actions)
- **Explicit SELECT**: Always use explicit column lists, never `select("*")`. Sensitive fields like `google_refresh_token` are excluded via `PROFILE_SELECT`.
- **`useUser()` hook** (`src/hooks/use-user.ts`): Client-side auth state with `isStaff`, `isHRAdmin`, `isLineManager` helpers and `hasModuleAccess()` check
- **`cn()` utility** (`src/lib/utils.ts`): Combines `clsx` + `tailwind-merge` for className composition

### Database

Types auto-generated in `src/types/database.types.ts`. Key tables: `profiles`, `teams`, `manager_teams`, `courses`, `course_enrolments`, `induction_progress`, `notifications`.

### Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## Workflow

- Create a feature branch for every piece of work: `feature/<name>` for new features, `fix/<name>` for bug fixes.
- PRs target the `main` branch. Always create a PR via `gh pr create` before merging.

## Testing

Vitest 4 + React Testing Library + jsdom. Config in `vitest.config.ts`, setup in `vitest.setup.ts`, test-specific types in `tsconfig.test.json`.

### Test File Convention

Test files are co-located with source files using `.test.ts` / `.test.tsx` suffix.

### Mocking Supabase in Tests

**For server actions** — mock `@/lib/auth` (`requireHRAdmin` / `getCurrentUser`) instead of the low-level Supabase client. Then mock only the simple `.from().update().eq()` chain the action itself uses. This avoids the shared `mockEq` problem where select and update chains both need different return types from the same mock.

**For middleware** — mock `@/lib/supabase/middleware` (`updateSession`) to control auth state, then mock the `.from().select().eq().single()` chain for profile fetching.

**Use `vi.hoisted()`** when mock variables need to be available inside `vi.mock()` factory functions (which are hoisted above all imports).

See `src/app/(protected)/hr/users/actions.test.ts` and `src/middleware.test.ts` for reference patterns. The mock factory in `src/__mocks__/supabase.ts` documents the full strategy.

## Lessons Learned

**Never use the browser Supabase client for mutations.** Client-side Supabase operations hang indefinitely in this app. All database writes and auth operations (sign-out, inserts, updates) must go through Server Actions using the server-side Supabase client. Pass auth data from server layouts as props rather than using client-side auth hooks.

**Never use `select("*")`.** Wildcard selects leak sensitive fields like `google_refresh_token`. Always use explicit column lists. Use `PROFILE_SELECT` from `src/lib/auth.ts` for profile queries.

**Whitelist fields in Server Actions.** Even when called from your own frontend, server actions must validate input with an allowed-fields whitelist before writing to the database. This prevents column injection and privilege escalation.

**Use `onSelect` not `onClick` for Radix UI `DropdownMenuItem`.** Radix primitives have specific event handler contracts that differ from standard HTML elements.

**Handle `NEXT_REDIRECT` errors in Server Actions.** When a server action calls `redirect()`, Next.js throws a `NEXT_REDIRECT` error. Catch blocks must re-throw this error or check for it to avoid swallowing redirects.

**Make all migrations idempotent.** Use `IF NOT EXISTS` / `DROP IF EXISTS` guards so migrations can be re-run safely.

**Avoid PostgreSQL ENUMs.** This project uses TEXT columns with CHECK constraints instead. ENUMs cause transaction failures when the type doesn't exist during trigger execution and are difficult to modify in production.

**Use `useMemo` for client-side list filtering.** Wrap filter logic in `useMemo` with proper dependencies to avoid recalculating on every render.

**Use `window.location.href` instead of `router.push()` inside Radix dialogs.** Router navigation conflicts with dialog event handling and causes hangs.

**Mock auth helpers, not the Supabase client, in server action tests.** Mocking `requireHRAdmin()` / `getCurrentUser()` from `@/lib/auth` is far simpler than mocking the low-level Supabase fluent chain. The fluent API shares `mockEq` across select and update chains, causing fragile test state. Mock one level higher to avoid this.

**Use CSS `drop-shadow` for speech bubble arrows, not `border`.** When building a speech bubble (card + arrow), don't use CSS `border` on either element — the arrow and card borders will always create a visible seam at their junction. Instead, use `filter: drop-shadow(...)` on the wrapper div to trace a unified outline around the entire composite shape. See `src/components/sign-in/sign-in-nudge-bubble.tsx`.
