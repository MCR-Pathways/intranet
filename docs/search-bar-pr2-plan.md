# Global search bar — PR2 implementation plan (the bar + dropdown)

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Follow the build-anything loop in `CLAUDE.md` (run `/code-review` before each commit; Gemini rounds after push; never merge unprompted).

**Goal:** Replace the hidden header search icon with an always-visible, centred search bar whose results drop down in place, and surface news posts (indexed in PR1) alongside resources and courses.

**Architecture:** The search is already a `cmdk` command list wrapped in a Radix `Dialog`. PR2 keeps the `cmdk` list (so keyboard nav + combobox a11y come for free) and moves it out of the `Dialog` into a panel anchored under an always-visible bar in the header. The bar is centred over the content column at the feed width; the modal is retired; ⌘K focuses the bar. News results query the `news_posts` index PR1 created.

**Tech stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, `cmdk`, `algoliasearch` v5, Vitest + RTL.

**Spec:** `docs/search-bar-redesign.md`. **Mockup:** https://zip.mcrpathways.org/search-bar-spec.html. **Depends on:** PR1 (merged, `cbb2022`) + the `news_posts` index being backfilled.

## Global constraints

- **British English** in all user-facing text, comments, copy.
- **Reuse `cmdk`** — move the existing `Command` list from the `Dialog` to an inline anchored panel. Do **not** hand-roll combobox a11y.
- **Query three indices** via `Promise.allSettled` (one failing must not blank the others): `RESOURCES_INDEX`, `COURSES_INDEX`, `NEWS_INDEX` — all from `@/lib/algolia`.
- **News result row:** orange `Newspaper` tile, title = `excerpt`, subtitle = `${authorName} · ${timeAgo(createdAt)}` (reuse `timeAgo` from `@/lib/utils`), matched-term highlight; navigate to `/intranet/post/${postId}`.
- **Scope tabs:** All / Resources / Courses / News — client-filter the already-fetched results, reset to All on each open.
- **Placement:** bar centred over the content area at `CENTRE_COLUMN_WIDTHS.intranet` (590px, `src/lib/layout.ts`); the "MCR Pathways" wordmark caps the sidebar (`w-64` = 256px, collapsible to 64px); bell + avatar stay in the far-right corner.
- **Dismissal:** Esc / click-outside / blur close the panel and keep the typed text; selecting a result clears it. ⌘K (Ctrl K off-Mac) focuses the bar.
- **Placeholder:** `Search resources, courses and news`. ⌘K hint chip, hidden on focus, platform label via `suppressHydrationWarning`.
- **Recessed fill:** the bar needs a warm off-white fill that reads on the white header — **not** `bg-card` (white-on-white). Add/choose a token in `docs/design-system.md` + `globals.css` before using it; this is a deliberate token decision, not an ad-hoc colour.
- **No focus trap** (it isn't a modal); panel has `max-height` + internal scroll. `jsx-a11y` is enforced at `error`.
- Follow `docs/button-system.md`, `docs/design-system.md`, `.claude/rules/ui-components.md`.

---

### Task 1: News in the search results (still inside the current modal)

Surface news first, with the search still in its existing modal — smallest change that's independently verifiable. The structural move to the inline bar is Task 3; the results markup built here carries over unchanged.

**Files:**
- Modify: `src/components/layout/global-search.tsx` (the `SearchResults` type ~line 41, `EMPTY_RESULTS`, the debounced query ~line 159, the results render ~line 410)
- Reuse: `@/lib/algolia` (`NEWS_INDEX`, `AlgoliaPostRecord`), `@/lib/utils` (`timeAgo`)

**Interfaces:**
- Consumes: `NEWS_INDEX: string`, `AlgoliaPostRecord` (`{ objectID, postId, excerpt, content, authorName, createdAt, _type: "news" }`) from PR1.
- Produces: a `news: Hit<AlgoliaPostRecord>[]` field on `SearchResults`; a News result group rendering pattern reused by Task 3.

- [ ] **Step 1: Extend the results type + empty value**

```tsx
interface SearchResults {
  resources: Hit<AlgoliaResourceRecord>[];
  courses: Hit<AlgoliaCourseRecord>[];
  news: Hit<AlgoliaPostRecord>[];
}
const EMPTY_RESULTS: SearchResults = { resources: [], courses: [], news: [] };
```

- [ ] **Step 2: Add the news index to the parallel query**

In the debounced effect, add a third `searchSingleIndex` to the `Promise.allSettled` array, and map its hits into `results.news` (mirror the resources/courses branches; `hitsPerPage: 5`):

```tsx
client.searchSingleIndex<AlgoliaPostRecord>({
  indexName: NEWS_INDEX,
  searchParams: { query, hitsPerPage: 5 },
}),
// ...
news: newsResult.status === "fulfilled" ? newsResult.value.hits : [],
```

- [ ] **Step 3: Render a News group**

After the Courses group, add a News group (reuse `groupClassName` / `itemClassName`). Orange tile, `Newspaper` icon (from `lucide-react`), title = highlighted `excerpt`, subtitle = `${hit.authorName} · ${timeAgo(hit.createdAt)}`; on select, `handleSelect(\`/intranet/post/${hit.postId}\`)`. Tile colour: `bg-orange-50 text-orange-600` (matches the mockup; confirm against `docs/design-system.md` orange token).

- [ ] **Step 4: Include news in `totalResults`**

`const totalResults = results.resources.length + results.courses.length + results.news.length;`

- [ ] **Step 5: Update the placeholder + hidden description**

`CommandPrimitive.Input` placeholder → `Search resources, courses and news`. Update the visually-hidden `DialogDescription` to drop "Tool Shed" / "insights".

- [ ] **Step 6: Verify at localhost**

`npm run dev`, open the search (icon / ⌘K), type a term that matches a news post (after running the PR1 backfill against your local/dev data, or seed one). Confirm the News group renders with the orange tile, excerpt, "author · Xd ago", and that selecting it opens `/intranet/post/[id]`. (This path is client-side Algolia + `cmdk`; the verification is visual, not a unit test.)

- [ ] **Step 7: Commit** (`/code-review` first, per the loop)

---

### Task 2: Scope tabs (All / Resources / Courses / News)

A tab row in the panel that narrows the rendered groups. The filter is a pure function so it's unit-testable; the wiring is in the component.

**Files:**
- Create: `src/lib/search-scope.ts`, `src/lib/search-scope.test.ts`
- Modify: `src/components/layout/global-search.tsx` (tab row + `activeScope` state)

**Interfaces:**
- Produces: `type SearchScope = "all" | "resources" | "courses" | "news"`; `filterResultsByScope(results: SearchResults, scope: SearchScope): SearchResults`.

- [ ] **Step 1: Write the failing test** (`src/lib/search-scope.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { filterResultsByScope } from "@/lib/search-scope";

const R = {
  resources: [{ objectID: "r1" }],
  courses: [{ objectID: "c1" }],
  news: [{ objectID: "n1" }],
} as never;

describe("filterResultsByScope", () => {
  it("returns everything for 'all'", () => {
    expect(filterResultsByScope(R, "all")).toBe(R);
  });
  it("keeps only the selected type otherwise", () => {
    const r = filterResultsByScope(R, "news");
    expect(r.news).toHaveLength(1);
    expect(r.resources).toHaveLength(0);
    expect(r.courses).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails** — `npx vitest run src/lib/search-scope.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** (`src/lib/search-scope.ts`)

```ts
import type { SearchResults } from "@/components/layout/global-search";

export type SearchScope = "all" | "resources" | "courses" | "news";

/** Narrow grouped results to one type. "all" returns the input unchanged. */
export function filterResultsByScope(
  results: SearchResults,
  scope: SearchScope
): SearchResults {
  if (scope === "all") return results;
  return {
    resources: scope === "resources" ? results.resources : [],
    courses: scope === "courses" ? results.courses : [],
    news: scope === "news" ? results.news : [],
  };
}
```

(Export `SearchResults` from `global-search.tsx` so the helper + test can import it.)

- [ ] **Step 4: Run it, confirm it passes.**

- [ ] **Step 5: Wire the tabs into the panel** — render a tab row above the list (All / Resources / Courses / News), hold `const [activeScope, setActiveScope] = useState<SearchScope>("all")`, derive `const shown = filterResultsByScope(results, activeScope)` and render the groups from `shown`. Reset `setActiveScope("all")` in the open→true transition (the existing `useEffect` on `open`). Active tab styling per the mockup (navy pill); inactive = muted.

- [ ] **Step 6: Verify at localhost** — type a query, click each tab, confirm the panel narrows; reopen confirms it resets to All.

- [ ] **Step 7: Commit** (`/code-review` first).

---

### Task 3: The centred bar + inline dropdown (retire the modal)

The structural change. Restructure the header for a centred always-visible bar, and refactor `GlobalSearch` from a `Dialog`-wrapped `cmdk` to an inline anchored one. The `cmdk` list content (groups, tabs, recents from Tasks 1–2) is unchanged — only its container and trigger change.

**Files:**
- Modify: `src/components/layout/header.tsx` (right cluster → centred layout: brand zone, centred bar, corner cluster) + accept a new `isCollapsed` prop
- Modify: `src/components/layout/app-layout.tsx` (pass `isCollapsed` down to `<Header>` — it already owns the value, line 71)
- Modify: `src/components/layout/global-search.tsx` (drop `Dialog`; render `Command` inline; open/close mechanics; ⌘K focuses)
- Modify: `docs/design-system.md` + `src/app/globals.css` (recessed-fill token, if not already present)
- Reuse: `CENTRE_COLUMN_WIDTHS` from `@/lib/layout` (import the constant; the header is outside `<main>`, where the `--centre-column` var lives)

**Interfaces:**
- Consumes: `CENTRE_COLUMN_WIDTHS.intranet` (590), the Task 1–2 list markup.
- Produces: the always-visible bar; `Dialog` removed.

- [ ] **Step 1: Header layout.** Verified shell (`app-layout.tsx:108-160`): the header is full-width *above* the `flex` row holding the fixed sidebar + `<main>`; `<main>` is offset by `md:ml-64` (collapsed: `md:ml-16`) and centres the feed via `mx-auto max-w-[var(--centre-column,…)]`. So a naive `mx-auto` in the full-width header sits at viewport centre — left of the feed. To sit the bar *over the feed*, its container must mirror main's offset: apply the same responsive left-margin (`md:ml-64` / `md:ml-16`) and centre the bar (`mx-auto`, `max-width: CENTRE_COLUMN_WIDTHS.intranet`px) inside that offset zone, so bar-centre tracks feed-centre in both sidebar states and at every width. Wordmark stays far-left (over the sidebar band); bell + avatar pinned far-right. The collapsed state arrives via the new `isCollapsed` prop (see Files). Verify alignment at localhost across both sidebar states + 1366/1920px.

- [ ] **Step 2: Recessed fill token.** Add (or confirm) a warm off-white token in `docs/design-system.md` + `globals.css` for the bar's resting fill; light-blue focus ring. Do not use `bg-card` (invisible on the white header).

- [ ] **Step 3: Inline `cmdk`.** In `GlobalSearch`, remove the `Dialog`/`DialogContent` wrapper. Render `<CommandPrimitive>` directly: the `CommandPrimitive.Input` becomes the always-visible bar (styled per Steps 1–2, with the placeholder + ⌘K hint), and `CommandPrimitive.List` becomes a panel absolutely positioned under the bar (`top: 100%`, the bar's width, `max-height` + `overflow-y-auto`, high `z-index`). Keep `shouldFilter={false}` and all the existing groups/tabs/recents.

- [ ] **Step 4: Open/close mechanics.** Open the panel on input focus; close on Esc, click-outside, and blur, **keeping the query text** (drop the existing `handleOpenChange` clear-on-close); clear only in `handleSelect` (already does). Click-outside: a `useRef` + `pointerdown` listener on `document`, or reuse a small outside-click hook. The ⌘K handler (existing) now focuses the input + opens, instead of toggling a dialog. Keep the `open-global-search` custom-event listener (resources landing dispatches it) → focus the bar.

- [ ] **Step 5: ⌘K hint.** Render the hint chip on the right of the bar at rest; hide it on focus/typing. Platform label ("⌘K" / "Ctrl K") with `suppressHydrationWarning` (per `.claude/rules/ui-components.md`).

- [ ] **Step 6: Verify at localhost (required).** `npm run dev`. Confirm: the bar is centred over the feed on `/intranet`, left edge near the content column; the panel drops over the feed (not the sidebar, not the bell); bell + avatar uncrowded; ⌘K focuses the bar; click-outside/Esc/blur keep the text; selecting clears + navigates. Check both sidebar states (expanded + collapsed) and at 1366px. Capture before/after.

- [ ] **Step 7: Commit** (`/code-review` first — this is the logic-bearing task; a full review is warranted).

---

### Task 4: Accessibility + final polish

- [ ] **Step 1: Combobox semantics.** Confirm `cmdk` emits the combobox roles inline (input `role`/`aria-expanded`/`aria-controls`, list `role="listbox"`, items `role="option"`, `aria-activedescendant` on arrow nav). Add any missing `aria-label` on the bar.
- [ ] **Step 2: No focus trap.** Verify Tab moves out of the bar and closes the panel (it must not trap like the old modal did).
- [ ] **Step 3: Panel scroll.** Confirm `max-height` + internal scroll so the panel never pushes the page; it overlays.
- [ ] **Step 4: Lint.** `npx eslint src/components/layout/global-search.tsx src/components/layout/header.tsx` → clean (jsx-a11y at error). Add justified disables only where genuinely warranted, per the rules doc.
- [ ] **Step 5: Keyboard + screen-reader smoke.** ↑/↓ move the highlight, Enter opens, Esc closes; VoiceOver/NVDA announces the listbox + options.
- [ ] **Step 6: File size.** If `global-search.tsx` now exceeds ~800 lines, extract the results list (groups + rows) into `src/components/layout/global-search-results.tsx` (per the split rule in root `CLAUDE.md`).
- [ ] **Step 7: Commit** (`/code-review` first), then push and run the Gemini loop for the whole PR.

---

## Out of scope (deferred)

People search; a full `/search` results page (dropdown-only); per-user course annotations; mobile/responsive bar; kudos + round-ups in search; resources/courses ranking changes.

## Self-review

- **Spec coverage:** placement (T3), inline dropdown + retire modal (T3), scope tabs (T2), news results + orange tile + recency-ranked index (T1, PR1), dismissal-keeps-text (T3 S4), placeholder/⌘K (T1, T3 S5), a11y (T4), recessed-fill token (T3 S2) — all mapped.
- **Type consistency:** `SearchResults` gains `news` (T1) and is imported by `search-scope.ts` (T2); `SearchScope` defined once in T2 and used in the component. `AlgoliaPostRecord` / `NEWS_INDEX` come from PR1's `@/lib/algolia`.
- **Visual-judgement steps** (header centring T3 S1, fill token T3 S2) are explicitly flagged as localhost-settled per the spec, not fabricated CSS — the spec acknowledges these are build-time visual calls.
