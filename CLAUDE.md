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

**For proxy** — mock `@/lib/supabase/middleware` (`updateSession`) to control auth state, then mock the `.from().select().eq().single()` chain for profile fetching.

**Use `vi.hoisted()`** when mock variables need to be available inside `vi.mock()` factory functions (which are hoisted above all imports).

See `src/app/(protected)/hr/users/actions.test.ts` and `src/proxy.test.ts` for reference patterns. The mock factory in `src/__mocks__/supabase.ts` documents the full strategy.

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

**Sanitise user-controlled URLs before rendering as `href`.** When rendering rich text JSON (e.g. Tiptap content), always whitelist `href` values to `http://` and `https://` protocols. Unsanitised hrefs allow stored XSS via `javascript:` URLs. See `TiptapRenderer` fix in PR #47.

**Write RLS policies with ownership checks, not blanket `true`.** Even when mutations are gated by server actions, RLS is the last line of defence. INSERT/DELETE policies on junction tables (e.g. `post_mentions`, `comment_mentions`) should verify the current user owns the parent record via `EXISTS` subqueries, not rely on `WITH CHECK (true)`.

**Never trust user-supplied IDs in SECURITY DEFINER functions.** In `notify_mention()`, the `p_mentioner_id` parameter was used to look up the sender's name, allowing impersonation. Always use `auth.uid()` for identity inside SECURITY DEFINER functions — treat all parameters as untrusted input.

**Use case-insensitive checks for URL protocols.** Per RFC 3986, URL schemes are case-insensitive — `HTTPS://example.com` is valid. Use `/^https?:\/\//i.test(href)` instead of `startsWith("http://")`.

**Proxy external URLs at both write-time AND render-time for CSP compliance.** When introducing CSP `img-src 'self'`, new records get proxied URLs at creation, but old records still have raw external URLs in the DB. Add a render-time proxy wrapper (e.g. `proxyImageUrl()` in the component) as a safety net. Exclude protocol-relative URLs (`//attacker.com`) from the "already relative" fast path — check `startsWith("/") && !startsWith("//")`.

**Wrap localStorage access in try/catch.** `localStorage.getItem()` and `setItem()` can throw in private browsing mode or when storage is disabled/full. Always wrap in try/catch and return a sensible default on failure.

**Listen to the `storage` event for cross-tab localStorage sync.** When using `useSyncExternalStore` with localStorage, subscribe to both your custom event (same-tab) and the browser `storage` event (cross-tab). Handle `event.key === null` too, which fires when another tab calls `localStorage.clear()`.

**Raise exceptions for invalid inputs in DB functions, don't silently return.** A silent `RETURN 0` on unexpected input masks bugs. Use `RAISE EXCEPTION` to make programming errors (e.g. typos in calling code) immediately obvious.

**Always set `search_path = ''` on SECURITY DEFINER functions.** Without a fixed search path, an attacker can hijack execution by creating objects in a schema they control. All SECURITY DEFINER functions in this project use `SET search_path = ''` and fully qualify table references (e.g. `public.profiles`, `auth.users`).

**Use `raw_app_meta_data` for proxy JWT claims, not session storage.** Store frequently-checked profile fields (`user_type`, `status`, `induction_completed_at`) in `auth.users.raw_app_meta_data` via a DB trigger on profiles. The proxy reads these from `user.app_metadata` (zero DB queries). Always include a DB fallback for sessions issued before the migration.

**Sanitise user-controlled fields in CSV exports (CSV injection).** When exporting data to CSV, user-controlled text fields (e.g. `other_location`, names, comments) can contain formula-triggering characters (`=`, `+`, `-`, `@`, `\t`, `\r`) that Excel/Sheets interprets as formulas. Prefix these with a single quote (`'`) to force plain-text rendering. See `sanitiseCSVCell()` in `reports-panel.tsx`.

**Sign-in module key files**: Shared types (`SignInEntry`, `TeamSignInEntry`) and config (`LOCATION_CONFIG`, formatters) in `src/lib/sign-in.ts`. `LocationBadge` component in `src/components/sign-in/location-badge.tsx`. Server actions in `src/app/(protected)/sign-in/actions.ts` — `getSignInHistory()` (single query, splits today/history), `getTeamMemberHistory()` (single member with line-manager verification), `getTeamSignInsToday()`, `getTeamSignInHistory()` (date-range report).

**Don't block user actions on non-critical follow-up failures.** When `refreshSession()` fails after induction completion, log a warning but don't return an error — the core action (profile update) succeeded. The stale JWT resolves on the next natural token refresh.

**Use `bg-card` not `bg-background` for dialogs, sheets, and modals.** When `--background` is a visible grey (e.g. #F2F4F7), form inputs (which also use `bg-background`) become invisible inside modals — zero contrast. Facebook, GitHub, and Vercel all use white for modal surfaces. Shadcn's default Dialog uses `bg-background` because their default background is white, but when customising to a grey page background, modals must switch to `bg-card`.

**Turbopack aggressively caches CSS custom properties.** After editing `globals.css`, clearing `.next/` and restarting the dev server is required — `touch` and hot reload alone won't invalidate cached CSS variable values. Always hard-refresh (Cmd+Shift+R) after restarting.

**Use TanStack Table + Shadcn primitives for data tables.** `@tanstack/react-table` provides headless data management (sorting, filtering, pagination) while Shadcn `<Table>` primitives handle styling. Extract row actions into separate `<RowActions>` components for `ColumnDef.cell` renderers — keeps column definitions clean and action state isolated.

**Use `border-separate border-spacing-0` with sticky table headers.** CSS `border-collapse: collapse` causes visual glitches when combined with `position: sticky` on `<th>` elements. Use `border-separate` with `border-spacing: 0` and apply borders to `<th>` cells (not `<tr>` rows — `<tr>` borders are invisible in `border-separate` mode).

**Use card-style table wrappers, not thin borders.** DataTable uses `bg-card shadow-md rounded-xl overflow-clip` instead of `rounded-md border`. Gives tables visual weight on grey page background. Footer (result count / pagination) sits inside the card with `border-t`. Use `overflow-clip` (not `overflow-hidden`) to clip rounded corners without breaking sticky headers or child scroll containers.

**Use `bg-card` for input/select backgrounds, not `bg-background`.** On grey page backgrounds (`bg-background`), form controls with `bg-background` are nearly invisible. `bg-card` (white) provides contrast on grey pages; on white dialogs (`bg-card`), the border provides sufficient contrast.

**Use `accessorFn` for computed sortable columns.** To create sortable computed columns (e.g. Priority = overdue/upcoming/completed), use `accessorFn` returning a numeric sort value while the `cell` renderer shows the visual display (badges/text). TanStack sorts by the accessor value, not the rendered output.

**Keep multi-field search external to DataTable.** DataTable's `searchKey` filters one column. When search spans multiple fields (e.g. asset_tag + make + model + serial_number + assignee), keep the manual `useMemo` filter and pass pre-filtered data to DataTable.

**Generate dynamic TanStack columns from data arrays.** When table columns depend on data (e.g. document types in a compliance grid), generate `ColumnDef[]` inside `useMemo` with the data array as a dependency. Use `for...of` to push dynamic columns onto a base array.

**Update documentation BEFORE implementing features, not after.** The colour overhaul lost context because docs were done post-implementation. Always update `docs/plan.md`, `docs/PROJECT.md`, `memory/MEMORY.md`, and `CLAUDE.md` in a Phase 0 before writing any code.

**Evaluate each table column's value before migrating.** Don't blindly migrate every column — fold sparse/secondary data into related cells (e.g. Reference → Document subtitle, Category → Type subtitle). Reduces visual noise and column count without losing information.

**Use a dedicated `--table-header` design token for table header backgrounds.** `--muted` (#F0F2F5) and `--background` (#F2F4F7) are nearly identical — headers using `bg-muted` blend into the page. The `--table-header` token (#E4E7EC light / hsl(210, 30%, 18%) dark) provides clear contrast against both the page and card backgrounds. Registered as `--color-table-header` in `@theme inline`.

**Add `font-semibold` to `DataTableColumnHeader` for consistent header text.** The ghost Button uses `font-medium` by default, making sortable column headers lighter than non-sortable ones (which inherit `font-semibold` from `<th>`). Override with `font-semibold` on the Button className.

**Don't use `mr-2` on icons inside Shadcn `DropdownMenuItem`.** `DropdownMenuItem` already applies `gap-2` via its className (`items-center gap-2`), so `mr-2` creates double spacing. Use just `h-4 w-4` on icons. This applies to all Radix components with built-in `gap-2`: `DropdownMenuItem`, `DropdownMenuSubTrigger`, etc. `Button` does NOT have `gap-2`, so `mr-2` is still needed for icons inside buttons.

**Use `<Link>` with `asChild` on `DropdownMenuItem` for navigation, not `window.location.href`.** The CLAUDE.md lesson about avoiding `router.push()` in Radix components applies specifically to Dialog `onOpenChange` handlers. `DropdownMenuItem asChild` + `<Link>` is the standard Shadcn pattern and works correctly for client-side navigation.

**Use specific sr-only text on row action buttons, not generic "Actions".** Screen reader users can't distinguish between multiple "Actions" buttons on a table page. Include the entity name: `Actions for {dept.name}`, `Actions for {profile.full_name}`. Column headers can remain generic "Actions" since they describe the column. Update tests to query `{ name: /^Actions for/ }` or the specific name.

**Pass `totalCount` to DataTable when using external filtering.** When data is filtered outside DataTable (e.g. multi-field search), the footer only shows the filtered count. Pass `totalCount={allData.length}` so the footer shows "Showing X of Y results" for context.

**Decouple `--accent` from `--secondary` in ALL theme modes.** `--accent` (hover/focus states) and `--secondary` (badges/buttons) serve different purposes. Aliasing them (`--accent: var(--secondary)`) makes independent tuning impossible. Give each its own hex value in both light AND dark mode — don't fix one and forget the other.

**Use Shadcn v4's `variant="line"` pattern for underline tabs.** Add `cva` with `default` (pill on `bg-muted`) and `line` (border-b, bg-transparent) variants to `TabsList`. Propagate variant via `data-variant` attribute. `TabsTrigger` uses `group-data-[variant=...]` to respond to parent's variant. Line variant uses `after:` pseudo-element for active underline indicator. Both variants get `hover:text-foreground` for consistent hover feedback. For nested tabs, use `variant="line"` on outer tabs and `variant="default"` (pill) on inner tabs for visual hierarchy.

**Don't re-declare inherited styles on child components.** If a parent sets `text-muted-foreground`, children inherit it via CSS inheritance — don't redundantly add it to children via `group-data-[variant=...]` selectors. Only add styles that differ from the inherited value.

**Apply CSS token fixes to ALL theme modes.** When decoupling tokens (e.g. `--accent` from `--secondary`) in light mode, check and fix dark mode too. Review every theme block (`:root`, `.dark`, `@theme inline`) for the same coupling pattern.

**Add `group` class to parent when using `group-data-[...]` on children.** Tailwind's `group-data-*` utility targets the nearest ancestor with `class="group"`. Without it, the data attribute selectors won't match. Always include `group` in the parent's `cva` base classes.

**Consolidate repeated `toLocaleDateString` calls into shared utilities.** `formatDate()` for "3 Feb 2026" style, `formatShortDate()` for "3 Feb" style — both in `src/lib/utils.ts`. Domain wrappers (e.g. `formatHRDate` in `hr.ts`, `formatDayMonth` in `sign-in.ts`) should delegate to these rather than inlining `toLocaleDateString`. Check for duplicates before adding new inline date formatting.

**Guard Record lookups from user input with `Object.hasOwn()`.** When looking up a user-controlled key in a Record (e.g. `CALLOUT_STYLES[calloutType]`), the key `"constructor"` or `"__proto__"` will return `Object.prototype` properties instead of `undefined`, causing crashes. Always guard: `Object.hasOwn(RECORD, key) ? RECORD[key] : RECORD.default`.

**`@tiptap/extension-table` uses named exports, not default exports.** Use `import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table"`. A default import causes "export default not found" build errors.

**Extract shared config between editor and renderer as a single source of truth.** When both the Tiptap composer toolbar and the article renderer need the same config (e.g. callout types, icons, colours), define it once in a shared module (e.g. `CALLOUT_CONFIG` in `tiptap-callout.ts`). Prevents style drift between editing and reading views.

**Reserve route-colliding slugs in auto-generated slugs.** When dynamic routes like `[articleSlug]` coexist with static routes like `/new` and `/edit`, add them to a `RESERVED_SLUGS` set in the slug generation function. Otherwise an article titled "New" gets slug "new" which collides with the `/new` route.

**Use `useMemo` for derived data used as a `useEffect` dependency.** Without memoisation, calling `extractHeadings(doc)` on every render creates a new array reference, causing `useEffect` to run cleanup/setup every render (e.g. IntersectionObserver disconnecting and reconnecting). Wrap in `useMemo` with the source data as dependency.

**Skip already-merged commits during chain rebase after squash-merge.** When squash-merging PR A to main, then rebasing child PR B onto main, git doesn't recognise A's original commits as duplicates (different hashes). Use `git rebase --skip` for each conflicting commit from A until reaching B's own commits.

**Validate redirect target parameters in auth callbacks.** User-controlled `next` query params (e.g. `/auth/callback?next=...`) must be validated via `sanitizeRedirectPath()` from `src/lib/url.ts`. Without this, `next=@evil.com` produces `https://origin@evil.com` — an open redirect where the browser treats the origin as a username. Never redirect to unvalidated user input.

**Return generic error messages to clients, log details server-side.** Raw Supabase error messages (e.g. `error.message`) expose schema details, table names, and constraint info. Return "Authentication failed" / "Check-in failed" to the client and `logger.error()` the real message server-side.

**Use `timingSafeTokenCompare` consistently for ALL token/secret comparisons.** Using `!==` for token comparison in one endpoint while using timing-safe comparison in another is an inconsistency bug. Even low-risk cases (e.g. webhook secrets from trusted sources) should use timing-safe comparison for defence-in-depth.

**Extract shared logic to `src/lib/` immediately, not after review.** `proxyImageUrl()` was local to `link-preview-card.tsx` until a second consumer appeared; `sanitizeRedirectPath()` was duplicated inline in two auth routes. Both were caught in review. Extract to `src/lib/url.ts` on first write when the logic is non-trivial or security-sensitive — don't wait for the duplication to happen.

**Always verify exploration agent claims against actual code.** In the Mar 2026 security audit, agents reported: `.env.local` was "committed to git" (FALSE — never committed, `.gitignore` covers it), missing `search_path` was "CRITICAL" (OVERSTATED — all functions used schema-qualified refs), calendar webhook timing attack was "CRITICAL" (OVERSTATED — header comes from Google, not end users), kiosk "lacks ownership verification" (BY DESIGN — shared office tablet), "missing CSRF protection" (FALSE — Next.js Server Actions have built-in CSRF). Always run your own `git log`, `grep`, and `read` to verify before acting on agent findings.

**Rate limiting on Vercel serverless requires an external store.** In-memory rate limiters don't persist across cold starts on Vercel. Use Upstash Redis (`@upstash/ratelimit`) for production rate limiting. Priority endpoints: `/api/kiosk/confirm`, `/auth/confirm`, `/api/calendar/webhook`.

**Use child-path-only active state matching when multiple nav items share a URL prefix.** When "Me" (`/hr/profile`) and "Admin" (`/hr`) both start with `/hr/`, naive `pathname.startsWith(item.href)` activates both. For items with children, only check if a child path matches — don't activate on the parent href prefix alone. Items without children can use prefix matching. See `isItemActive()` in `sidebar.tsx`.

**Use plain `<div>` with absolute positioning instead of Radix Popover inside Dialog.** Dialog's modal focus trap kills portaled Popovers — clicks outside the Popover close the entire Dialog. Use a manually positioned `<div>` with `useRef` + `useEffect` on `mousedown` for outside-click detection. See `icon-picker-popover.tsx`.

**Use `createElement()` for dynamic Lucide icons to satisfy React Compiler.** The `react-hooks/static-components` rule flags `<DynamicIcon />` when the component reference comes from a lookup. `useMemo` doesn't help because the component itself changes. `createElement(resolveIcon(name), props)` avoids the lint violation entirely.

**Run migrations immediately after merging schema-changing PRs — not just for child PRs, for the entire app.** Supabase `.select()` queries silently return `{ data: null }` when a column doesn't exist instead of throwing an error. This makes missing-column failures extremely subtle: `getCurrentUser()` finds the user via JWT but the profile query fails silently → profile is null → pages check `if (!profile) redirect("/login")` → infinite redirect loop. The symptom looks like an auth bug, not a missing column. When PR #128 merged (adding `is_content_editor` to `PROFILE_SELECT`), the code deployed but the migration wasn't applied — the entire app broke with a login redirect loop. Always run migrations via Supabase SQL Editor or `scripts/run-migrations.mjs` immediately after merging any PR that includes a migration file.

**Update breadcrumb root labels when renaming sidebar navigation items.** Breadcrumb labels like `{ label: "HR", href: "/hr" }` are hardcoded in individual page files, not derived from sidebar config. When sidebar items are renamed (HR→Me, Intranet→Home), breadcrumbs become stale. Grep for the old label across all page files to catch every instance. Admin sub-pages should use `{ label: "Admin", href: "/hr" }`, not the old module name.

**Use `/` text separator for breadcrumbs, not icon components.** `ChevronRight` icons are visually heavier than needed. A simple `/` text span (`text-muted-foreground/50 select-none`) matches GitHub, Linear, and Notion. Pair with `hover:underline underline-offset-4` on links for clear click affordance.

**Apply card-style wrappers to ALL content surfaces, not just tables.** The `bg-card shadow-md rounded-xl overflow-clip` pattern applies to editors, forms, and any content area on a grey `bg-background` page — not only DataTables. Wrap related inputs (e.g. title + editor) in a single card surface so they read as one cohesive unit, matching Google Docs / Notion. Never use `border border-input` with `focus-within:ring-2` on full content areas.

**Use `useEditorState` for reactive Tiptap v3 toolbar state, not `editor.isActive()` directly.** In Tiptap v3, calling `editor.isActive("bold")` in the render body doesn't trigger re-renders when the selection changes — the toolbar buttons won't update. Use `useEditorState({ editor, selector: ({ editor: e }) => ({ isBold: e.isActive("bold"), ... }) })` which subscribes to editor state changes and returns a memoised snapshot. Always guard `if (!e) return null` inside the selector since the editor can be null during initialisation.

**Target Tiptap v3 DOM attributes, not assumed ones, for editor CSS.** Tiptap v3 renders task list items as `<li data-checked="false">` inside `<ul data-type="taskList">` — NOT `<li data-type="taskItem">`. CSS selectors must target the actual DOM output (`ul[data-type='taskList'] > li`), not assumed ProseMirror node names. Always inspect the rendered DOM with `document.querySelector` before writing editor CSS. Use `!flex` to override Tailwind Typography's `display: list-item` on `<li>` elements inside task lists.

**Make props optional when values come from `useEditorState`.** `useEditorState` returns `null` during editor initialisation, so `editorState?.isBold` is `boolean | undefined`. Component props receiving these values must be typed as optional (`active?: boolean`) or the caller must provide a fallback (`?? false`). TypeScript strict mode catches this at build time — Vercel deployments will fail even if `npm run lint` passes locally.

**Always consult `docs/design-system.md` before doing anything colour-related.** This doc is the single source of truth for colour tokens, WCAG contrast data, and design decisions. Read it first, then implement. Update it BEFORE implementing colour changes (Phase 0 documentation). Never add colour tokens or change colour values without checking this doc for existing conventions and contrast requirements.

**Use tonal/subtle fills for badges, never solid fills.** Badge variants use `bg-{colour}-50 text-{colour}-700` (light tinted background + dark text) — the industry standard from Atlassian, Stripe, and Shopify. Never use solid fills like `bg-green-500 text-white` for status badges — they create visual noise in dense tables. Use semantic variants: `success` (green) for positive states, `destructive` (red) for negative states, `warning` (amber) for attention needed, `default` (blue) for info/general. HR config-driven badges in `src/lib/hr.ts` follow the same tonal pattern via className overrides. See `docs/design-system.md` §1.8 for the full pattern reference.

**Use Badge `variant` prop, never `variant="outline"` with className colour overrides.** When a status config maps to a standard Badge variant (blue, red, green, amber, grey), add `badgeVariant` to the config and use `<Badge variant={config.badgeVariant}>`. Never use `variant="outline" className={...colour...bgColour..."border-0"}` — this defeats the Badge component abstraction. For non-standard colours (purple, teal, orange) where no variant exists, use `<Badge className={cn(config.bgColour, config.colour, "border-0")}>` without a variant prop. See `LEAVE_TYPE_CONFIG`, `RTW_STATUS_CONFIG`, `LEAVING_STATUS_CONFIG`, and `ONBOARDING_STATUS_CONFIG` for the `badgeVariant` pattern.

**Use `muted` variant for inactive/disabled states, never `destructive`.** Red (`destructive`) implies something went wrong or needs attention. Inactive/disabled is a neutral state — use `muted` (grey). Active→`success`, Inactive→`muted`. This applies to user status, department status, template status, and any boolean active/inactive toggle.

**Filter Google default avatars at the component level, not the database.** Google OIDC default avatars and real photos use the same `lh3.googleusercontent.com/a/` URL structure — URL-based detection cannot distinguish them. Use `filterAvatarUrl()` from `src/lib/utils.ts` on all `AvatarImage src` props to return `undefined` for `googleusercontent.com` URLs, letting the brand-coloured `AvatarFallback` render instead. When real photo sync is added via the Google People API, replace with a DB-level `is_default_avatar` flag.

**When squash-merging a PR whose branch is another PR's base, recreate the child PR.** GitHub auto-closes PRs whose base branch is deleted by squash-merge. The child's commits aren't included in the parent's squash. Cherry-pick the child's commit onto a new branch from main (`git cherry-pick <sha>`) and create a fresh PR. Don't try to reopen or retarget the closed PR.

**Reject Gemini suggestions that introduce non-brand colours.** Gemini suggested hex values like `#5DB3CE` and `#D479A4` to differentiate dark-mode icon colours, but these are not MCR brand colours and have unverified WCAG contrast. Dark-mode colour duplication (teal→light-blue, wine→pink) is by design — fewer distinguishable brand colours are available on dark backgrounds. Always reject suggestions that invent arbitrary hex values outside the approved brand palette.

**Be aware that `--mcr-pink` changed from `#FF82B2` to `#DA417C`.** Dark-mode icon tokens use the old bright pink `#FF82B2` intentionally because `#DA417C` is too dark on dark backgrounds. Using `var(--mcr-pink)` in dark mode would break contrast. The hardcoded `#FF82B2` is correct — it's the bright variant needed for dark backgrounds.

**Use `html-react-parser` instead of `dangerouslySetInnerHTML` for Google Doc content.** Parsing HTML into React elements enables: heading IDs for deep linking + TOC, custom rendering of links/images, and better type safety. Use the `replace` callback to add `id` attributes to heading elements via `createElement()` (not JSX with dynamic tag names — TypeScript can't resolve `keyof JSX.IntrinsicElements` as a component type).

**Use Algolia for search, not PostgreSQL FTS.** Manager directive (2026-03-18). Algolia App ID: `CFRPCC52U5`. Use `react-instantsearch` + `react-instantsearch-nextjs` for client-side search UI. Index content at section level (DocSearch pattern: hierarchy_lvl0 → category, lvl1 → article title, lvl2 → heading). Indexing happens server-side in drive-actions.ts (link/sync/unlink). Environment variables: `NEXT_PUBLIC_ALGOLIA_APP_ID`, `NEXT_PUBLIC_ALGOLIA_SEARCH_KEY` (public), `ALGOLIA_ADMIN_KEY` (server-only).

**Supabase `.select()` with joined tables returns arrays, not objects.** When using `resource_categories!category_id(name, slug)` in a select, the result is typed as an array (even for single FK joins). Cast via `unknown` first: `const cat = (Array.isArray(catData) ? catData[0] : catData) as { name: string; slug: string } | null`.

**Always return 200 from webhook endpoints, even on error.** Google Drive (and most webhook providers) retry on non-2xx responses. If processing fails (DB error, missing article, etc.), log the error server-side but return 200 to prevent retry storms. The webhook is best-effort — manual sync is always available as a fallback. See `src/app/api/drive/webhook/route.ts`.

**Strip ALL inline styles, classes, and data-* attributes from Google Docs HTML.** Google's HTML export includes excessive cruft (proprietary classes, inline colour/font styles, empty spans). `sanitiseGoogleDocsHtml()` aggressively strips everything and lets Tailwind `prose` classes handle styling. Insert a space before block elements (`<p>`, `<h1>`, etc.) before calling `textContent` to prevent word merging in plaintext extraction.

**Delete external records (Algolia, webhooks) BEFORE hard-deleting DB records.** When unlinking a Google Doc: (1) stop watch channel, (2) remove from Algolia, (3) hard-delete article. If steps 1-2 fail, the article still exists and can be retried. If step 3 fails after 1-2 succeed, the index is stale but recoverable via re-indexing. Wrap steps 1-2 in try-catch so step 3 always runs.

**Component pages require static imports + migration seed.** Next.js code-splitting requires hardcoded dynamic imports — the component registry maps `component_name` to a `next/dynamic` import. Adding a new component page requires: (1) add to `COMPONENT_REGISTRY` in `src/lib/resource-components.ts`, (2) add static dynamic import in `component-article-view.tsx`, (3) add DB migration to seed the `resource_articles` row with `content_type = 'component'`.

**Encode compound webhook tokens as `{secret}:{id}`.** When a webhook needs to verify both the caller's identity and the resource being updated, encode both in the token. Google Doc IDs use only `[a-zA-Z0-9_-]`, so a colon is a safe delimiter. Split on first colon, verify secret with `timingSafeTokenCompare()`, then use the ID to look up the article. See `drive-actions.ts` watch channel setup.

**Use `linkedom` instead of `jsdom` for server-side HTML parsing.** `jsdom` v28 is ESM-only and fails with `ERR_REQUIRE_ESM` on Vercel serverless functions — even with `serverExternalPackages`. `linkedom` is lightweight (~50x smaller), ESM-native, and works in serverless. Import: `import { parseHTML } from "linkedom"`. Usage: `const { document } = parseHTML(html)`. Keep `jsdom` in devDependencies for Vitest's jsdom test environment only.

**Never put server-only packages in `devDependencies` if production code imports them.** Vercel prunes devDependencies after build. If production code (server actions, API routes) imports a package, it MUST be in `dependencies`. This caused all `/resources` server actions to 500 when `jsdom` was in devDependencies.

**Always add `.catch()` and `.finally()` to server action promises in client components.** Without `.catch()`, a rejected server action leaves UI state stuck (e.g. loading spinners, disabled inputs). Use `.finally()` to always clear loading state. See `link-google-doc-dialog.tsx` for the pattern.

**Hard-refresh (Cmd+Shift+R) after Vercel deployments that change server action modules.** Stale cached JS bundles contain old server action IDs that don't match the new deployment. The server returns "Server Components render error" and all server actions fail silently. A hard refresh loads the new JS bundles.

**Google Docs must be shared with the service account for linking.** The service account email is `mcr-pathways@appspot.gserviceaccount.com`. Share the Google Doc with this email as Viewer before linking. Alternatively, place docs in a registered Drive folder already shared with the service account.

**Verify Tailwind plugins are installed, not just referenced.** Adding `prose` classes to components does nothing if `@tailwindcss/typography` is not installed and registered via `@plugin` in `globals.css`. The `prose` class was used in 13+ components for months with zero effect because the plugin was never added. Always check `package.json` dependencies + `globals.css` `@plugin` directives when prose styles aren't applying.

**Use cascading selects for hierarchical data, not flat dropdowns.** When a data model has parent-child nesting (e.g. categories → subcategories → folders), show progressive `<Select>` components: mandatory top level, then optional child levels that appear only when the parent has children. Derive child lists via `useMemo` from a single flat fetch. Reset child selections when parent changes. Use a `resolveParentChain()` loop to pre-select all levels from a `defaultId`. See `link-google-doc-dialog.tsx`.

**Allow articles at any category hierarchy level.** The original leaf-only constraint (articles only in categories with no children) was removed in PR #161. `fetchCategoriesForMove()` now returns all categories. `moveArticle()` no longer checks for child categories. The sidebar tree, breadcrumbs, category pages, and article counts all work correctly with articles at any level — verified against actual code.

**Preserve semantic formatting from Google Docs inline styles before stripping.** Google Docs never uses semantic HTML (`<strong>`, `<em>`, `<th>`). It uses `<span style="font-weight:700">` for bold, `<span style="font-style:italic">` for italic, and `<td>` for all table cells (including headers). The sanitiser must extract these semantics BEFORE stripping styles: convert bold spans → `<strong>`, italic spans → `<em>`, first-row `<td>` → `<th>`. Also extract `width:XXXpx` from table cells, convert to percentages, and preserve as `style="width:XX%"` for responsive column proportions. This applies to ALL linked Google Docs, not just individual articles. See `sanitiseGoogleDocsHtml()` in `src/lib/google-drive.ts`.

**Split large action files by feature area.** When an actions.ts file exceeds ~800 lines, create a separate actions file for the new feature (e.g. `section-actions.ts` alongside `actions.ts`). Both are `"use server"` files in the same directory. This keeps each file focused and maintainable.

**Learning module uses section-level quizzes, not lesson-level.** The `lesson_type` CHECK was changed from `('video', 'text', 'quiz')` to `('video', 'text')`. Quizzes now live in the `section_quizzes` table (one per section), not as a lesson type. The section quiz gates progression to the next section. See migrations 00060-00064.

**Tool Shed is a social learning framework, NOT a resource library.** Based on the MCR Pathways Social Learning Framework document. Staff share insights from external training via structured formats (Digital Postcards, 3-2-1 Model, 10-Minute Takeover). Content stored as JSONB in `tool_shed_entries`. The old hardcoded Tool Shed page must be completely rewritten.

**Course feedback is private to L&D, not public ratings.** The `course_feedback` table stores 5 structured fields (overall, relevance, clarity, duration, free text). User_id is stored for dedup (UNIQUE constraint) but hidden from L&D reports at the application layer. No star ratings on course catalogue cards.

**Global search uses Cmd+K overlay, not per-module search bars.** A search icon in the header opens a centered command palette overlay. Uses Algolia multi-index query across `resources_articles` + `learning_courses`. Results grouped by type. See `global-search.tsx` (planned) and `src/lib/algolia.ts` for index constants.
