# Shared Libraries (`src/lib/`)

Utilities, security helpers, design tokens, and table patterns used across all modules.

## Design Tokens

Always consult `docs/design-system.md` before doing anything colour-related — it is the single source of truth for colour tokens, WCAG contrast data, and design decisions. Update it BEFORE implementing colour changes.

**Decouple `--accent` from `--secondary` in ALL theme modes.** They serve different purposes. Give each its own hex value in both light AND dark mode.

**Apply CSS token fixes to ALL theme modes.** Review every theme block (`:root`, `.dark`, `@theme inline`) for the same coupling pattern.

**Use `--table-header` design token for table header backgrounds.** `--muted` and `--background` are nearly identical — headers using `bg-muted` blend into the page. `--table-header` (#E9E4D9 warm light, per ADR-014's P1-A re-tune / hsl(210, 30%, 18%) dark) provides clear contrast.

**Filter Google default avatars at the component level, not the database.** Use `filterAvatarUrl()` from `src/lib/utils.ts` on all `AvatarImage src` props. Returns `undefined` for `googleusercontent.com` URLs, letting the brand-coloured `AvatarFallback` render.

**Reject suggestions that introduce non-brand colours.** Dark-mode colour duplication (teal→light-blue, wine→pink) is by design. Never accept arbitrary hex values outside the approved brand palette.

**`--mcr-pink` changed from `#FF82B2` to `#DA417C`.** Dark-mode icon tokens use the old bright `#FF82B2` intentionally because `#DA417C` is too dark on dark backgrounds.

**Tailwind utility ordering matters — later wins through `tailwind-merge`.** Putting `p-0` AFTER `px-1` in the same className string (or letting a child className with `p-0` follow a base className with `px-1`) collapses horizontal padding to zero. `tailwind-merge` (used by `cn()` and inside Shadcn's primitive className merging) deduplicates conflicting padding/margin/inset utilities, keeping the last one. Watch for shorthand utilities (`p-*`, `m-*`, `inset-*`, `space-*`) appearing after specific-axis ones (`px-*`, `mx-*`, `top-*`) in the same string — the shorthand will override. PR #294 hit this on the bell badge: `px-1 ... p-0` rendered with no horizontal padding and "9+" looked cramped against the edges. Fix is `py-0` instead of `p-0` if the intent was vertical-only.

## Table Patterns (TanStack + Shadcn)

**Use TanStack Table + Shadcn primitives for data tables.** `@tanstack/react-table` for headless data management, Shadcn `<Table>` for styling. Extract row actions into separate `<RowActions>` components.

**Use `border-separate border-spacing-0` with sticky table headers.** CSS `border-collapse: collapse` causes glitches with `position: sticky` on `<th>`.

**Use card-style table wrappers.** `bg-card rounded-xl border border-border shadow-md overflow-clip`. Apply to ALL content surfaces on grey backgrounds, not just tables.

**Add `font-semibold` to `DataTableColumnHeader`.** Override ghost Button's `font-medium` default for consistent headers.

**Use `accessorFn` for computed sortable columns.** Return a numeric sort value while the `cell` renderer shows badges/text.

**Keep multi-field search external to DataTable.** DataTable's `searchKey` filters one column. For multi-field search, use `useMemo` and pass pre-filtered data.

**Generate dynamic TanStack columns from data arrays.** Generate `ColumnDef[]` inside `useMemo` with the data array as a dependency.

**Pass `totalCount` to DataTable when using external filtering.** Shows "Showing X of Y results" in the footer.

**Evaluate each table column's value before migrating.** Fold sparse data into related cells to reduce visual noise.

**Use a hidden priority column to group attention-needed rows at the top.** TanStack's `sorting` state is a multi-key array, so you can ship a hidden `accessorFn` column that returns a numeric priority (higher = more urgent) and list it first in `initialSorting`. Second key is your normal sort. Hide the column via `initialColumnVisibility={{ [columnId]: false }}` plus `enableHiding: false` on the def — `row.getVisibleCells()` skips it, `getSortedRowModel` still sees it, and `column.getCanHide()` returns false so a column-visibility menu (present or future) can never un-hide what renders as an empty column. Clicking any visible column header replaces the sort as expected (user intent wins). Used in `settings-drive-watches.tsx` to cluster failed/never-synced/drift/not-watched rows above healthy ones without breaking user-driven sorts. Pre-sorting the `data` prop in `useMemo` does NOT work for this — TanStack's sort state runs after and overrides input order.

## Lightweight Table Pattern

**Use raw Shadcn Table primitives for lightweight read-only lists (2-10 rows).** Full DataTable (TanStack + sorting + pagination) is for data management surfaces (HR Users, Assets, Compliance). For activity feeds, bookmarks, and recent items, use the same visual wrapper as DataTable.

```tsx
<div className="bg-card rounded-xl border border-border shadow-md overflow-clip">
  <Table>
    <TableHeader>
      <TableRow className="hover:bg-table-header odd:bg-table-header">
        <TableHead>Title</TableHead>
        <TableHead>Category</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item) => (
        <TableRow key={item.id}>
          <TableCell className="font-medium">{item.title}</TableCell>
          <TableCell>{item.category}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

- Wrapper: `bg-card rounded-xl border border-border shadow-md overflow-clip` — same as the DataTable component. Crisp border edge with subtle shadow
- Use default `TableHead` styling (no overrides) — `bg-table-header`, `h-12`, `font-semibold`
- Use default `TableCell` styling (no overrides) — `px-4 py-3`
- Zebra striping is built in: `TableRow` has `odd:bg-muted/50`. Header rows need `hover:bg-table-header odd:bg-table-header` to reset the inherited stripe and hover (pinned to the header-band token — `bg-background` would leak ivory into white cards since ADR-014)
- Clickable rows: put a `<Link>` in the title cell, not `onClick` on the row

**Use `group/row` + `group-odd/row` for sticky column backgrounds.** Sticky cells need an explicit background to cover content that scrolls underneath. Use `bg-card` as the base (covers even rows), then add `group-odd/row:bg-muted/50` and `group-hover/row:bg-muted` to sync with row state. Put `className="group/row"` on the `<TableRow>`. See `team-schedule-grid.tsx` for the full pattern.

**Outer `overflow-clip` and inner `overflow-auto` coexist on nested elements.** The standard wrapper uses `overflow-clip` (clips rounded corners). The Shadcn `<Table>` component wraps `<table>` in `<div className="relative w-full overflow-auto">` (handles horizontal scroll). These are on different DOM elements and work independently. Don't remove one thinking it conflicts with the other.

## Button Intent

**Use button variants by intent, not just hierarchy.**
- `default` (primary, navy fill) — routine actions: Save, Close, generic Submit. One primary CTA per view.
- `success` (green fill) — high-stakes positive confirmations: Publish, Approve, Submit Leave Request. Use when the action has a meaningful positive outcome beyond "OK".
- `destructive` (red fill) — irreversible or high-impact negative actions: Delete, Remove, Unlink. Always behind a confirmation dialog.
- `outline` — secondary navigation: Bookmarks, Drafts, filter controls. The variant fills `bg-card` natively (since ADR-014's ivory sweep), so the old explicit `bg-card` override at call sites is redundant — harmless where it remains, unnecessary on new ones.
- `ghost` — utility actions that should recede: Settings cog, kebab triggers, toolbar icons.
- `action` (pink fill) — reserved for special brand actions.

**Destructive items in dropdown menus** use `className="text-destructive focus:text-destructive"` — red text, not a variant. The icon inherits the red colour from the parent text class.

**Inline delete triggers in tables** (e.g. Trash2 icon in a table row) use `variant="ghost"` — not destructive. The destructive styling goes on the confirmation button inside the AlertDialog, not the trigger. Keeps table rows visually clean.

**All buttons have tap animation.** `motion-safe:active:scale-95` is in the base Button component — Tailwind's `motion-safe:` prefix makes the tap feedback respect the user's `prefers-reduced-motion` setting automatically (no CSS override needed). Every button shrinks slightly on press for tactile feedback. Disabled buttons don't scale (`disabled:pointer-events-none` prevents the active state). Filled primaries (default/success/destructive) also use `motion-safe:hover:-translate-y-px` for a subtle lift on hover.

## Tiptap / Editor Patterns

**`@tiptap/extension-table` uses named exports, not default exports.** `import { Table, TableRow, TableCell, TableHeader }`.

**Extract shared config between editor and renderer as a single source of truth.** `CALLOUT_CONFIG` in `tiptap-callout.ts` prevents style drift.

**Use `useEditorState` for reactive Tiptap v3 toolbar state.** `editor.isActive("bold")` directly doesn't trigger re-renders. Use `useEditorState({ editor, selector })` which subscribes to changes.

**Target Tiptap v3 DOM attributes, not assumed ones, for editor CSS.** Renders `<li data-checked="false">` inside `<ul data-type="taskList">`. Always inspect the rendered DOM first.

**Make props optional when values come from `useEditorState`.** Returns `null` during initialisation, so `editorState?.isBold` is `boolean | undefined`.

## Tab Patterns

**Use Shadcn v4 `variant="line"` pattern for underline tabs directly on the page background.** Default pill tabs sat near-invisible on the old grey `bg-background`; since ADR-014 the active pill fills `bg-card` (white on the muted track), which helps, but line tabs still read better directly on the ivory canvas. For nested tabs, use `variant="line"` on outer tabs and `variant="default"` (pill) on inner tabs.

## Sidebar Navigation

**Use child-path-only active state matching when multiple nav items share a URL prefix.** For items with children, only check if a child path matches. Items without children can use prefix matching. See `isItemActive()` in `sidebar.tsx`.

**Update breadcrumb root labels when renaming sidebar navigation items.** Breadcrumb labels are hardcoded in individual page files, not derived from sidebar config. Grep for old labels.

**Use `/` text separator for breadcrumbs, not icon components.** `text-muted-foreground/50 select-none` with `hover:underline underline-offset-4` on links.

## Radix Component Patterns

**Don't add any sizing classes to icons inside Shadcn `DropdownMenuItem`.** The primitive has `[&>svg]:size-4 [&>svg]:shrink-0` on its base className (see `src/components/ui/dropdown-menu.tsx:86`). Explicit `h-4 w-4` is redundant. Even smaller sizes like `h-3 w-3` are silently overridden — CSS specificity of `.parent > svg` (0,1,1) beats `.h-3` (0,1,0). If you genuinely need a non-default icon size inside a menu item, raise specificity with `!size-3` or restructure.

**Don't add explicit `h-X w-X` to SVG icons inside `Button` either.** Each size variant injects its own `[&_svg]:size-X` rule (see `src/components/ui/button.tsx:41-47`): `default` → `size-4`, `sm` → `size-3.5`, `lg`/`hero`/`icon` → `size-5`, `icon-sm` → `size-4`, `icon-xs` → `size-3.5`. Explicit sizing is redundant and may conflict with the intended size for the variant. Button also has `gap-2` in its base className (`src/components/ui/button.tsx:11`), so explicit `mr-2` on icons inside a Button is unnecessary; the gap handles icon-label spacing. Both DropdownMenuItem and Button: just write the icon, let the parent size it.

**One `TooltipProvider` per component, not per cell.** Radix recommends a single provider at the app root or wrapping the table/section — each `TooltipProvider` runs its own event listeners and delay state. Per-row instantiation inside table cells works but wastes render work on every visible row. Wrap the component's top-level `<div>` once with `<TooltipProvider delayDuration={200}>`; bare `<Tooltip>` children all use it. Caught by Gemini review on PR #266.

## Lightbox / Modal Backdrops

**Floating buttons on a uniform dark backdrop need higher contrast than `bg-black/60`.** The `bg-black/60` pattern from `image-lightbox.tsx` only works there because the image itself provides colour contrast around the buttons. In a document lightbox where the backdrop is uniformly dark and the document panel is a small centred white card, those same buttons disappear into the backdrop — smoke test on PR #280 confirmed they were nearly invisible at the top-right corner. Use frosted-glass instead: `bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg`. The blur creates a distinct visual layer between the backdrop and the document panel, and the white border ring gives the button a crisp edge. Bump padding from `p-2` to `p-2.5` and gap from `gap-2` to `gap-2.5` so the cluster reads as intentional.

**When iframe content has its own toolbar, don't add a parent toolbar that duplicates buttons.** PR #280 originally rendered a top toolbar in the document lightbox (filename, page count, open-in-new-tab, download, close) and then loaded the iframe — which brought Chrome's full PDF viewer toolbar inside, plus Drive's preview header for non-PDFs. Two stacked toolbars, conflicting filenames (Chrome shows the PDF's `/Title` metadata, not the user's filename), duplicate download buttons. Final design: drop the parent toolbar entirely, defer to whatever chrome the iframe provides, and add only floating dismissal-style buttons (Open in new tab, Close) on the dark backdrop top-right — neither is provided by Chromium's PDF viewer or Drive's `/preview` embed, so no duplication.

## Global Search

**Global search is an always-visible bar in the header, not a Cmd+K modal.** The bar is a `cmdk` input; its command list is a panel anchored beneath it (the old Radix Dialog overlay is retired). Cmd/Ctrl+K focuses the bar; dismiss (Esc / click-outside / blur) keeps the typed query, only selecting a result clears it. Multi-index Algolia query across three indices: `resources_articles`, `learning_courses`, `news_posts` (plain news + polls; kudos and weekly round-ups excluded via `shouldIndexPostForSearch`). Scope tabs (All / Resources / Courses / News) filter the fetched results client-side via `filterResultsByScope` (`src/lib/search-scope.ts`, also the single source for the `SearchScope` union). Index settings in `scripts/algolia-settings.mjs`; backfill via `scripts/index-posts.ts`. Resources landing dispatches `open-global-search` to focus the bar. See `global-search.tsx`, `src/lib/algolia.ts`, `src/lib/search-scope.ts`.

**cmdk's inline combobox: keep the List mounted.** `Command.Input` hardcodes `role="combobox"`, `aria-expanded={true}` and `aria-controls={listId}`, and you can't override them via props (cmdk sets them after spreading yours). So the `Command.List` (which carries `listId`) must stay in the DOM whenever the bar renders, or `aria-controls` points at nothing. Render the dropdown panel always and hide it with `hidden` when closed — not `{open && <panel>}`. The hardcoded `aria-expanded={true}`-when-closed is an unavoidable cmdk limitation for the inline (non-dialog) pattern.

**The header search bar centres over the feed by mirroring `<main>`, and only at xl+.** The header is full-width above the sidebar; the feed lives in `<main>` (offset `md:ml-64` / `md:ml-16`, centred in `max-w-7xl`). To line the bar up over the feed, its container reuses the same offset + `container` + 590px centre-column and reads the same `isCollapsed` (passed down from `AppLayout`); the logo and bell/avatar are `absolute` so they don't shove the centred bar. This only holds at `xl:` (≥1280px) — below ~1086px the 590px bar collides with the absolute clusters, so the bar is `hidden` below xl (narrower-viewport search is a deferred pass). Resting fill is `bg-muted` (not `bg-card`) — a documented exception, since the bar sits on the white header where `bg-card` is invisible.

## Process Reminders

**Research before redesigning — don't iterate blindly.** Check how top platforms handle it, verify claims against actual products, then cherry-pick the best patterns. Always ask: does the scale (~80 staff) justify the complexity? Evaluate cherry-picked features for overkill before implementing — personal bookmarks and Cmd+K quick actions were rejected as overkill for ~80 staff.

**Update documentation BEFORE implementing features.** Update `docs/plan.md`, `docs/PROJECT.md`, `memory/MEMORY.md`, and `CLAUDE.md` in Phase 0.


## Buttons

Button rules live in `docs/button-system.md` (single source of truth for variants, sizes, label casing, a11y, helpers, per-context patterns). Never put `h-X w-X` on a Button `className` — use the `size` prop; an ESLint rule enforces this.
