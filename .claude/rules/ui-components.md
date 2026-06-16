---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - "src/app/globals.css"
---

# React, Radix, CSS, and UI component patterns

These rules load when working on React components (`.tsx`) or stylesheets (`.css`). Path-scoped per Claude Code conventions; root `CLAUDE.md` carries the cross-cutting rules.

## Before you design: read the house design guides

Before designing, redesigning, or restyling any interactive surface, read **`docs/ui-ux-principles.md`** and **`docs/frontend-design-playbook.md`** — these are the project's own intentionality and frontend-design standards. Start with the section at the top of `ui-ux-principles.md`, **"Before you design: interrogate intent"** (Why does this exist? Who for, doing what? Is this generic? Fit for purpose? Did each element earn its place?). That gate decides whether a design is on purpose or generic AI output; running it is not optional.

`ui-ux-principles.md` settles interaction questions: §2 visual hierarchy (weight + spacing first, colour only for behavioural signals), §9 list-vs-table-vs-grid, §6 empty states, §13 anti-patterns (multiple primary CTAs, colour-as-only-hierarchy, etc.). `frontend-design-playbook.md` covers typography, colour, motion, and the AI-slop tells to avoid. `docs/design-system.md` and `docs/button-system.md` sit downstream — brand tokens and button rules win where they apply.

These two docs are only auto-surfaced by a hook when the `frontend-design` skill is explicitly invoked; on routine component work nothing else points to them, so reach for them yourself.

## Radix component contracts

- Use `onSelect`, not `onClick`, for `DropdownMenuItem`. Radix primitives have specific event handler contracts.
- Use `<Link>` with `asChild` on `DropdownMenuItem` for navigation — works correctly with Radix's internal handling.
- Use plain `<div>` with absolute positioning instead of Radix Popover inside a Dialog. Dialog's modal focus trap kills portaled Popovers.
- Custom interactive children inside Radix DropdownMenu need `stopPropagation` on pointerdown + click + keydown. Radix Menu primitives manage focus via roving-tabindex and dismiss the menu on certain interior events. Plain `<button>`/`<input>` children that aren't `DropdownMenuItem` close the popover on click; Radix's keyboard handler intercepts Tab/Esc/Arrow/Enter for menu nav. Wrap the interactive container with `onPointerDown={(e) => e.stopPropagation()}` + `onClick={(e) => e.stopPropagation()}`; on any `<input>` inside, swallow keydown via `onKeyDown={(e) => e.stopPropagation(); ...}` before your own `preventDefault` for Enter/Escape.
- Conditional `onCloseAutoFocus` for Radix popovers/menus when click-outside leaves a stuck focus-visible ring. Track close source with refs: `onPointerDownOutside` flips a `wasMouseCloseRef` to `true`, `onEscapeKeyDown` clears it. Then `onCloseAutoFocus={(e) => { if (wasMouseCloseRef.current) { e.preventDefault(); wasMouseCloseRef.current = false; } }}`. Mouse close stops the focus return (no leftover ring); keyboard close lets focus return naturally so keyboard users keep their position. Unconditional `preventDefault` is the trap — breaks keyboard a11y.

## Navigation

**`router.push()` vs `window.location.href`.** Use `router.push()` for normal client-side navigation. Use `window.location.href` in two cases: (1) inside Radix Dialog handlers (router navigation conflicts with Dialog event handling); (2) when the destination page must re-fetch fresh server data (e.g. completion status, certificates) — a full reload bypasses cached client navigation. `DropdownMenuItem asChild + <Link>` is the right shape for menu navigation; the router-conflict rule applies specifically to Dialog `onOpenChange` handlers, not DropdownMenu.

## Memoisation patterns

- **Memoise inline-literal props passed to memoised children.** Passing `editTarget={{ postId: ..., message: ... }}` directly in JSX recreates the object on every parent render. If the child has `useMemo` deps or `useEffect` deps that include the prop, those re-run for no reason. Wrap parent-side: `const editTarget = useMemo(() => ({ ... }), [post.id, post.content, ...])`. Knock-on: any array literal handed in via `?? []` also needs its own `useMemo` so the parent memo's deps stay stable.
- **Mirror state into a ref when a memoised callback otherwise depends on the state value.** A `useCallback` with `[rows]` in deps changes identity on every state update; if the callback is passed as a prop to many children, every state mutation re-renders all of them. Pattern: `const rowsRef = useRef(rows); useEffect(() => { rowsRef.current = rows; });` then `useCallback(async (id) => { const item = rowsRef.current.find(...); ... }, [])`. Empty deps, stable identity, no child churn.
- **Use `useMemo` for client-side list filtering and derived data.** Prevents unnecessary recalculations and unstable references that trigger re-renders.

## State mutation patterns

**Optimistic-rollback scope: capture the failed item, not the whole list.** Storing `previous = rows` then `setRows(previous)` on failure clobbers other concurrent successful mutations that completed while this one was in flight. Capture `rowToRestore = rows.find(...)` first, optimistically remove it, and on failure re-insert via `setRows((prev) => prev.some((r) => r.id === id) ? prev : [...prev, rowToRestore].sort(...))`. The `.some` guard makes the restore idempotent if React replays the updater in strict mode.

## React details

**Use `createElement()` for dynamic Lucide icons to satisfy React Compiler.** `createElement(resolveIcon(name), props)` avoids the `react-hooks/static-components` lint violation.

**Use `suppressHydrationWarning` for platform-specific rendering.** Values depending on `navigator.platform` differ between server and client.

**Pass server timestamps to client components for date calculations.** `new Date()` inside a `"use client"` component can differ between server render and client hydration (e.g. crossing midnight changes due-date status). Pass `Date.now()` from the server component as a prop.

**Use `url.toString()` not `url.pathname` when stripping query params.** `url.pathname` drops ALL params, not just the one you deleted via `searchParams.delete()`. Always use `url.toString()` after modifying searchParams.

**Use custom DOM events, not synthetic KeyboardEvents, for cross-component communication.** Synthetic `KeyboardEvent` dispatch is fragile across browsers.

**Don't nest interactive elements. Use sibling layout instead.** A `<Link>` inside a `<button>` is invalid HTML. Split into sibling elements.

**Add `group` class to parent when using `group-data-[...]` on children.** Tailwind's `group-data-*` targets the nearest ancestor with `class="group"`.

**`href={url ?? undefined}` for anchors with optionally-missing URLs, not `href={url || "#"}`.** A `"#"` fallback turns clicks into a page-jump-to-top side effect when the URL is unresolved. `href={undefined}` keeps the anchor inert.

**Lucide `MapPin` filled with `currentColor` collapses to a balloon shape.** The pin's inner circle (the "hole") fills along with the teardrop, losing the iconic shape. Drop the `fill` attribute and rely on stroke-only colour (e.g. `text-red-500` on the icon className).

## CSS & styling

**`overflow: clip` does NOT break `position: sticky`.** Unlike `overflow: hidden/scroll/auto`, `overflow: clip` does not create a scroll container. Sticky elements work inside `overflow-clip` parents. The `ARTICLE_CARD_CLASSES` constant uses `overflow-clip` intentionally for rounded-corner clipping without affecting the sticky TOC.

**Use `bg-card` not `bg-background` for dialogs, modals, and form inputs.** `--background` is ivory (ADR-014); inputs with `bg-background` read tinted inside white cards and blend into the page. Use `bg-card` for all elevated surfaces. `bg-background` is reserved for canvas-level surfaces that should match the page (app shell, full-bleed calendars, sticky masks over the canvas).

**Enforce className invariants with an AST ESLint rule, not a hand-grep.** When a class is banned or redundant in a context (sizing on a Button, `bg-card` on an `outline` Button), don't sweep it by grep — a single-line grep misses multi-line JSX where attributes span lines, even `grep -A3` misses a class that sits >3 lines from the attribute that makes it redundant, and removing a class orphans the comment that justified it. Write a rule in `eslint-rules/` (the `mcr-button` plugin): AST-based, so it catches every formatting, autofixes, blocks new ones, and *verifies a manual sweep was complete*. Two hard rules when adding one: (1) wire it into BOTH the plugin's `rules` map AND the active `rules` block with a severity — a registered-but-unenabled rule passes silently; (2) prove it FIRES against a known-bad snippet before trusting a clean run, because a clean codebase from a broken/disabled rule means nothing. PR #347 missed three `bg-card`-on-outline buttons across two grep passes (one even a reviewer missed); the AST rule found the last one in seconds and now blocks regressions.

**Consolidate `toLocaleDateString` calls into `formatDate()` / `formatShortDate()` from `src/lib/utils.ts`.** Check for duplicates before adding new inline date formatting.

**Don't re-declare inherited styles on child components.** If a parent sets `text-muted-foreground`, children inherit it via CSS inheritance.

**Use `className` not `style` for Tailwind colour values.** `getAvatarColour()` returns Tailwind classes. Using `style={{ backgroundColor }}` puts the class name as a CSS value.

**Turbopack aggressively caches CSS custom properties.** After editing `globals.css`, clear `.next/` and restart the dev server. Always hard-refresh (Cmd+Shift+R).

**Use specific sr-only text on row action buttons.** Include the entity name: `Actions for {dept.name}`, not generic "Actions".

## UI component conventions

**All data tables use `bg-card rounded-xl border border-border shadow-md overflow-clip` wrapper.** DataTable (TanStack) has this built in. Lightweight tables use Shadcn Table primitives with the same wrapper. Add `hover:bg-table-header odd:bg-table-header` on header `TableRow`. See `src/lib/CLAUDE.md` for code example.

**Buttons: follow `docs/button-system.md`.** Single source of truth for variants, sizes, label casing, a11y, helpers (`TooltipButton`, `ButtonSpinner`, `DestructiveMenuItem`), and per-context patterns (Edit, kebab migration, AlertDialog footers, long labels, toggle buttons). Never use `className="h-X w-X"` on Button; an ESLint rule enforces this. Cancel uses `secondary`; destructive inline uses `ghost` or moves to kebab; primary CTAs must be `default`, `lg`, or `hero` (never `sm`).
