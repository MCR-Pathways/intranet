# §4 — Reading rail + spread layout

**Date:** 2026-07-02
**Spec:** `docs/superpowers/specs/2026-06-30-resources-redesign-design.md` (§4)
**Branch:** `feature/resources-reading-rail`
**Status:** design approved via six rounds of live mockup on the Group Work article (2026-07-02); building.

## What this is

The last of the four resources fixes. §1 (sticky toolbar), §2/§2.1/§2.1b (resource grid + editor-controlled cards), and §3 (folder promotion) shipped. §4 turns the boxed "On this page" table of contents into a borderless reading rail, and — this grew past the original spec during the design sessions — reworks the article's wide-screen layout so the content column fills the card instead of stranding a void beside the rail.

## The design, and how it got here

The spec locked the rail's own look (teal active marker, H2+H3 only, bold "On this page" label). The open question was the wide-screen layout, and it moved through four positions under the user's eye, each rejected for a concrete reason:

1. **Boxed TOC, today.** A bordered panel floats beside the body with a ~246px dead band to its right (measured live at 1920px). Reads as broken.
2. **Rail flush right, body capped at 720px.** Relocates the void to the middle of the card. Same hole, different place.
3. **Centred column.** Splits the slack into symmetric left/right margins. Clean at reading depth, but the breadcrumb detaches from the card corner and the middle still carries visible air.
4. **Spread (chosen).** The column fills the width to the rail; text uncapped so there's one uniform right edge; grids reflow to use the width. No slack pools anywhere because nothing is capped — the void can't exist. Breadcrumb and title stay anchored to the card's top-left (they live inside the body column, so they spread with it). This is also the simplest option in code: the body just grows.

The one-standard-width rule (every page shares the `max-w-7xl` shell; only the home feed is exempt) ruled out capping the card. Spread keeps the standard width and fills it.

## Locked decisions

- **Wide screens: spread.** Body column fills (`flex-1`, no max-width); rail sits flush at the card's right edge; text uncapped (uniform right edge — no ragged "text stops midway"). On a 1366px Chromebook the body + gap + rail already fill the card, so nothing changes there; spread only expresses itself on ~1920px externals, where the card is still capped at `max-w-7xl` (~1408px) so the body maxes at ~1000px (≈107ch — GitHub-docs territory, acceptable for our grid-heavy content).
- **Rail look.** Borderless. Bold "On this page" label. Left track line (2px hairline). Active item = 3px teal left bar + teal text + bolder weight. H3s indented and lighter than H2s. Scroll-spy preserved (`aria-current="location"`).
- **Headings shown: levels 2 and 3 only.** H4+ keep their anchors (still reachable by deep link, still `scroll-mt`) but are not listed — on Group Work that's 9 rail items instead of 23. Assumes body content starts at H2 (verified: our Plate editor and the WP-migration convention both start section headings at H2; H1 is the article title, rendered separately). H1-only or H1-starting bodies would get a reduced rail; none exist today.
- **Marker never blank.** Two behaviours emerge/are added so the teal marker is always on something sensible:
  - *Ancestor fallback (free):* pass the H2+H3 list to `useScrollSpy`, not all headings. The hook's existing "last heading whose top < 80px" branch then lands on the nearest listed ancestor when the reader is inside an unlisted H4 section. No hook change required.
  - *Default to first:* when the hook returns `""` (reader is above the first heading, at the very top), the rail marks the first item. Handled in the component (`activeId || headings[0].slug`).
- **Narrow (< lg / 1024px): collapsed disclosure.** Today the rail vanishes below `lg` — a WCAG reflow (1.4.10) / zoom gap, since a user zoomed to 200% loses the TOC entirely. Replace `hidden lg:block` with: at `lg+`, the sticky side rail; below `lg`, a full-width "On this page" `<button aria-expanded>` above the content that expands the list inline (tap a heading → scroll + collapse). This is primarily an accessibility fix (zoom/reflow), not a mobile feature.
- **Grid uses the width.** The §2 `resource_grid` moves from fixed `grid-cols-2 lg:grid-cols-3` to `grid-cols-[repeat(auto-fill,minmax(210px,1fr))]` — container-relative, so it's 4-up in the spread column, 3-up when the rail is present on a Chromebook, and reflows smoothly (no crushed word-per-line slivers) at any width. The `max-w-7xl` card caps it at 4-up even on huge monitors.

## Files

| File | Change |
|------|--------|
| `src/components/resources/article-outline.tsx` | Rewrite: borderless rail, track line, weight-by-level, teal marker, H2+H3 filter, default-to-first, `lg`+ sticky rail / below-`lg` disclosure. |
| `src/lib/article-constants.ts` | Add `filterRailHeadings(headings)` (pure, level 2\|3). Remove `max-w-[720px]` from `ARTICLE_PROSE_CLASSES` (uncap text — cap site 1 of 2). |
| `src/components/resources/native-article-view.tsx` | Derive `railHeadings = filterRailHeadings(visibleHeadings)`; pass to both `useScrollSpy` and `ArticleOutline`. Flex container `flex gap-8` → `flex flex-col gap-6 lg:flex-row lg:gap-8`; body `flex-1 min-w-0 max-w-[720px]` → `min-w-0 lg:flex-1` (drop cap — site 2 of 2). |
| `src/components/resources/google-doc-article-view.tsx` | Same container + body + `railHeadings` changes (derive from `headings`). |
| `src/lib/plate-static-plugins.tsx` | `ResourceGrid` grid classes → `auto-fill` minmax. |
| `src/app/(protected)/resources/CLAUDE.md` | Rewrite the `bg-accent` pill rule (§4 supersedes it — teal marker is now correct). |
| `docs/design-system.md` | Note the reading-rail marker + the article spread layout. |
| `docs/superpowers/specs/2026-06-30-resources-redesign-design.md` | Update §4: record the spread layout and the narrow disclosure (the "no expand/collapse" line applies to the desktop rail only). |

## Tests (TDD where there's logic)

- `article-constants.test.ts` — **update** the two assertions that expect `max-w-[720px]` in `ARTICLE_PROSE_CLASSES` (now uncapped); add a test that the content modifiers survive. **New:** `filterRailHeadings` keeps H2/H3, drops H1 and H4+, preserves document order, returns `[]` for none.
- `article-outline.test.tsx` (new, RTL) — renders one item per H2/H3; excludes H4; marks `activeHeadingId` with `aria-current="location"`; **default-to-first** when `activeHeadingId=""`; hides when fewer than 2 rail headings; the below-`lg` disclosure button carries `aria-expanded` + `aria-controls` and toggles the list.
- Ancestor fallback and scroll-spy movement are **not** unit-tested (IntersectionObserver + layout don't run in jsdom — the existing `use-scroll-spy.ts` is untested for the same reason). Verified live instead.

## Build-time visual checks (mandatory — these are the decisions the mockup couldn't settle)

1. **Prose-heavy article at 1920px.** Uncapped text is the riskiest call. Confirm a real long-prose article (a policy, not the grid-heavy Group Work) reads acceptably at ~107ch. If it genuinely doesn't, the fix is **not** re-capping text (that reintroduces the ragged edge the user rejected) — stop and surface it to the user as a fresh decision.
2. **~1600px mid-width.** No awkward in-between (margins neither snug nor deliberate); grid column count sensible.
3. **1366px Chromebook regression.** The common case must be unchanged in feel: body + rail fill the card, 3-up grid, no new whitespace.
4. **Resize sweep + narrow disclosure.** Drag the width down: grid steps 4→3→2→1 with no slivers; at `<lg` the rail becomes the disclosure, expands/collapses, and a keyboard/zoom user can reach it.

## Out of scope

- Sticky/floating disclosure on narrow screens (MDN's pattern — reach it from anywhere deep in the page). Ship the simple inline disclosure first; add sticky only if zoomed-in users ask.
- H1-starting article support (no such content today).
- The wide-screen TOC whitespace memo (`memory/resources-toc-widescreen-whitespace.md`) is **resolved** by spread — delete it after merge.
