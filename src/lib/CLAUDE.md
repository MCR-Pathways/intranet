# Shared Libraries (`src/lib/`)

Utilities, security helpers, design tokens, and table patterns used across all modules.

## Design Tokens

Always consult `docs/design-system.md` before doing anything colour-related — it is the single source of truth for colour tokens, WCAG contrast data, and design decisions. Update it BEFORE implementing colour changes.

**Decouple `--accent` from `--secondary` in ALL theme modes.** They serve different purposes. Give each its own hex value in both light AND dark mode.

**Apply CSS token fixes to ALL theme modes.** Review every theme block (`:root`, `.dark`, `@theme inline`) for the same coupling pattern.

**Use `--table-header` design token for table header backgrounds.** `--muted` and `--background` are nearly identical — headers using `bg-muted` blend into the page. `--table-header` (#E4E7EC light / hsl(210, 30%, 18%) dark) provides clear contrast.

**Filter Google default avatars at the component level, not the database.** Use `filterAvatarUrl()` from `src/lib/utils.ts` on all `AvatarImage src` props. Returns `undefined` for `googleusercontent.com` URLs, letting the brand-coloured `AvatarFallback` render.

**Reject suggestions that introduce non-brand colours.** Dark-mode colour duplication (teal→light-blue, wine→pink) is by design. Never accept arbitrary hex values outside the approved brand palette.

**`--mcr-pink` changed from `#FF82B2` to `#DA417C`.** Dark-mode icon tokens use the old bright `#FF82B2` intentionally because `#DA417C` is too dark on dark backgrounds.

## Table Patterns (TanStack + Shadcn)

**Use TanStack Table + Shadcn primitives for data tables.** `@tanstack/react-table` for headless data management, Shadcn `<Table>` for styling. Extract row actions into separate `<RowActions>` components.

**Use `border-separate border-spacing-0` with sticky table headers.** CSS `border-collapse: collapse` causes glitches with `position: sticky` on `<th>`.

**Use card-style table wrappers.** `bg-card shadow-md rounded-xl overflow-clip` instead of `rounded-md border`. Apply to ALL content surfaces on grey backgrounds, not just tables.

**Add `font-semibold` to `DataTableColumnHeader`.** Override ghost Button's `font-medium` default for consistent headers.

**Use `accessorFn` for computed sortable columns.** Return a numeric sort value while the `cell` renderer shows badges/text.

**Keep multi-field search external to DataTable.** DataTable's `searchKey` filters one column. For multi-field search, use `useMemo` and pass pre-filtered data.

**Generate dynamic TanStack columns from data arrays.** Generate `ColumnDef[]` inside `useMemo` with the data array as a dependency.

**Pass `totalCount` to DataTable when using external filtering.** Shows "Showing X of Y results" in the footer.

**Evaluate each table column's value before migrating.** Fold sparse data into related cells to reduce visual noise.

## Lightweight Table Pattern (Finder-style)

**Use raw Shadcn Table primitives for lightweight read-only lists (2-10 rows).** Full DataTable (TanStack + sorting + pagination) is for data management surfaces (HR Users, Assets, Compliance). For activity feeds, bookmarks, and recent items, use `Table`/`TableHeader`/`TableHead`/`TableBody`/`TableRow`/`TableCell` with these overrides. This is an intentional exception to the card-wrapped, sticky-header DataTable rules above — lightweight tables sit directly on the page with minimal chrome.

- Header: `bg-background h-8 px-3 text-xs font-medium text-muted-foreground border-b border-border` on `TableHead` (override default `bg-table-header h-12 px-4 font-semibold`). Use `bg-background` not `bg-transparent` so content doesn't bleed through if the table is in a scrollable container.
- Cells: `px-3 py-2` (tighter than default `px-4 py-3`)
- Header row: add `hover:bg-transparent` to prevent hover highlight
- Zebra striping is built in: `TableRow` has `even:bg-muted/50`
- No card wrapper — sits directly on `bg-background`
- Clickable rows: put a `<Link>` in the title cell, not `onClick` on the row

## Button Intent

**Use button variants by intent, not just hierarchy.**
- `default` (primary, navy fill) — routine actions: Save, Close, generic Submit. One primary CTA per view.
- `success` (green fill) — high-stakes positive confirmations: Publish, Approve, Submit Leave Request. Use when the action has a meaningful positive outcome beyond "OK".
- `destructive` (red fill) — irreversible or high-impact negative actions: Delete, Remove, Unlink. Always behind a confirmation dialog.
- `outline` + `bg-card` — secondary navigation on grey `bg-background` pages: Bookmarks, Drafts, filter controls. Without `bg-card`, outline buttons are invisible on grey (the variant uses `bg-background` as fill).
- `ghost` — utility actions that should recede: Settings cog, kebab triggers, toolbar icons.
- `action` (pink fill) — reserved for special brand actions.

**Destructive items in dropdown menus** use `className="text-destructive focus:text-destructive"` — red text, not a variant. The icon inherits the red colour from the parent text class.

## Tiptap / Editor Patterns

**`@tiptap/extension-table` uses named exports, not default exports.** `import { Table, TableRow, TableCell, TableHeader }`.

**Extract shared config between editor and renderer as a single source of truth.** `CALLOUT_CONFIG` in `tiptap-callout.ts` prevents style drift.

**Use `useEditorState` for reactive Tiptap v3 toolbar state.** `editor.isActive("bold")` directly doesn't trigger re-renders. Use `useEditorState({ editor, selector })` which subscribes to changes.

**Target Tiptap v3 DOM attributes, not assumed ones, for editor CSS.** Renders `<li data-checked="false">` inside `<ul data-type="taskList">`. Always inspect the rendered DOM first.

**Make props optional when values come from `useEditorState`.** Returns `null` during initialisation, so `editorState?.isBold` is `boolean | undefined`.

## Tab Patterns

**Use Shadcn v4 `variant="line"` pattern for underline tabs on grey backgrounds.** Default pill tabs have near-zero contrast on `bg-background`. Line tabs with underline indicators work on any background. For nested tabs, use `variant="line"` on outer tabs and `variant="default"` (pill) on inner tabs.

## Sidebar Navigation

**Use child-path-only active state matching when multiple nav items share a URL prefix.** For items with children, only check if a child path matches. Items without children can use prefix matching. See `isItemActive()` in `sidebar.tsx`.

**Update breadcrumb root labels when renaming sidebar navigation items.** Breadcrumb labels are hardcoded in individual page files, not derived from sidebar config. Grep for old labels.

**Use `/` text separator for breadcrumbs, not icon components.** `text-muted-foreground/50 select-none` with `hover:underline underline-offset-4` on links.

## Radix Component Patterns

**Don't use `mr-2` on icons inside Shadcn `DropdownMenuItem`.** Already has `gap-2`. Use just `h-4 w-4`. `Button` does NOT have `gap-2`, so `mr-2` is still needed there.

## Global Search

**Global search uses Cmd+K overlay, not per-module search bars.** Uses Algolia multi-index query across `resources_articles` + `learning_courses` + `tool_shed_entries`. Index settings tracked in `scripts/algolia-settings.mjs` (searchableAttributes, snippets, distinct dedup). Resources landing page opens the overlay via `CustomEvent` dispatch. See `global-search.tsx` and `src/lib/algolia.ts`.

## Process Reminders

**Research before redesigning — don't iterate blindly.** Check how top platforms handle it, verify claims against actual products, then cherry-pick the best patterns. Always ask: does the scale (~80 staff) justify the complexity? Evaluate cherry-picked features for overkill before implementing — personal bookmarks and Cmd+K quick actions were rejected as overkill for ~80 staff.

**Update documentation BEFORE implementing features.** Update `docs/plan.md`, `docs/PROJECT.md`, `memory/MEMORY.md`, and `CLAUDE.md` in Phase 0.
