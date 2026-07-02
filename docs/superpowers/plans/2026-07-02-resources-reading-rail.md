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
4. **Spread (first build).** The column fills the width to the rail; text uncapped so there's one uniform right edge; grids reflow to use the width. No slack pools anywhere because nothing is capped — the void can't exist. Breadcrumb and title stay anchored to the card's top-left (they live inside the body column, so they spread with it). Simplest in code, but the mandated prose check killed it (see 5).
5. **Capped column at 90ch (final).** The build-time prose check measured real policy text at **151 characters per line** on a wide external (~126ch on a Chromebook) — well past the ~90ch readable limit. Three options went head-to-head live on real articles (fill / prose-only cap with grid breakout / whole-column cap): the prose-only cap re-opened the void on prose-only pages, exactly where reading matters most, while the column cap stayed readable AND tidy on both page types. The user chose the column cap: `max-w-[90ch]` on the article content, everything sharing one edge, the leftover reading as a deliberate gutter before the borderless rail.

The one-standard-width rule (every page shares the `max-w-7xl` shell; only the home feed is exempt) ruled out capping the card itself. The card keeps the standard width; the measure lives inside it.

## Locked decisions

- **Wide screens: capped column at the 90ch measure** (final, 2026-07-02 — see the addendum below; supersedes the first-build "text uncapped" position). The body column stays `flex-1` and the article content inside it caps at `max-w-[90ch]` of the prose-sm font (~823px): text, grids and tables share one uniform right edge, and the card's leftover becomes a quiet, deliberate gutter before the borderless rail. The rail still sits flush at the card's right edge. On a 1366px Chromebook the column is naturally narrower than the cap, so nothing changes there.
- **Rail look.** Borderless. Bold "On this page" label. Left track line (2px hairline). Active item = 3px teal left bar + teal text + bolder weight. H3s indented and lighter than H2s. Scroll-spy preserved (`aria-current="location"`).
- **Headings shown: the top two levels present** (corrected in review, 2026-07-02; was "levels 2 and 3 only"). On well-formed bodies that is exactly H2 + H3 (Group Work: 9 rail items instead of 23). The general rule survives irregular content the hardcoded filter deleted the rail for: H1-sectioned Google Docs (Docs' default heading style, and the sanitiser does not demote levels, despite its stale docstring) rail H1 + H2; a document that skips H3 rails H2 + H4. Deeper levels keep their anchors (deep link, `scroll-mt`), they just aren't listed.
- **Ancestor fallback (free).** Pass the filtered rail list to `useScrollSpy`, not all headings. The hook's existing "last heading whose top < 80px" branch then lands on the nearest listed ancestor when the reader is inside an unlisted deeper section. No hook change required. (A second behaviour, default-to-first when the hook returns `""`, was built and then cut in review: it asserts `aria-current="location"` on a section the reader has not reached, and a stale-but-truthy active id bypasses it anyway. Above the first heading the rail now deliberately marks nothing, like React.dev.)
- **Narrow (< lg / 1024px): collapsed disclosure.** Today the rail vanishes below `lg` — a WCAG reflow (1.4.10) / zoom gap, since a user zoomed to 200% loses the TOC entirely. Replace `hidden lg:block` with: at `lg+`, the sticky side rail; below `lg`, a full-width "On this page" `<button aria-expanded>` above the content that expands the list inline (tap a heading → scroll + collapse). This is primarily an accessibility fix (zoom/reflow), not a mobile feature.
- **Grid follows the column.** The §2 `resource_grid` moves from fixed `grid-cols-2 lg:grid-cols-3` to `grid-cols-[repeat(auto-fill,minmax(min(210px,100%),1fr))]`: container-relative, so it reflows smoothly (no crushed word-per-line slivers) and never overflows a column narrower than one tile. Inside the 90ch measure that's 3-up on wide externals and Chromebooks alike; the column cap, not the viewport, decides.

## Files

| File | Change |
|------|--------|
| `src/components/resources/article-outline.tsx` | Rewrite: borderless rail, track line, weight-by-level, teal marker, named nav landmark, `lg`+ sticky rail / below-`lg` disclosure (Shadcn Button, CSS-only breakpoint, collapse-then-scroll). |
| `src/lib/article-constants.ts` | Add `filterRailHeadings(headings)` (pure, level 2\|3). `ARTICLE_PROSE_CLASSES`: `max-w-[720px]` → `max-w-[90ch]` (the reading measure; caps text + grids together). |
| `src/components/resources/native-article-view.tsx` | Derive `railHeadings = filterRailHeadings(visibleHeadings)`; pass to both `useScrollSpy` and `ArticleOutline`. Layout becomes the shared three-child grid (`ARTICLE_LAYOUT_CLASSES`: header, rail, content); the old 720px body cap drops (site 2 of 2); GlossaryFilter and the empty state carry the measure themselves. |
| `src/components/resources/google-doc-article-view.tsx` | Same container + body + `railHeadings` changes (derive from `headings`). |
| `src/lib/plate-static-plugins.tsx` | `ResourceGrid` grid classes → `auto-fill` minmax. |
| `src/app/(protected)/resources/CLAUDE.md` | Rewrite the `bg-accent` pill rule (§4 supersedes it — teal marker is now correct). |
| `docs/design-system.md` | Note the reading-rail marker + the article spread layout. |
| `docs/superpowers/specs/2026-06-30-resources-redesign-design.md` | Update §4: record the spread layout and the narrow disclosure (the "no expand/collapse" line applies to the desktop rail only). |

## Tests (TDD where there's logic)

- `article-constants.test.ts` — **update** the assertions on `ARTICLE_PROSE_CLASSES` to expect the `max-w-[90ch]` measure; add a test that the content modifiers survive. **New:** `filterRailHeadings` keeps the top two levels present (H2+H3 well-formed, H1+H2 Doc-shaped, H2+H4 skip-shaped, single-level intact), preserves document order, returns `[]` for none.
- `article-outline.test.tsx` (new, RTL) — one link per rail heading; marks `activeHeadingId` with `aria-current="location"`; marks nothing when scroll-spy is empty; named nav landmark; hides when fewer than 2 rail headings; the disclosure button carries `aria-expanded` + `aria-controls`, toggles the list, and collapses when a heading is picked.
- Ancestor fallback and scroll-spy movement are **not** unit-tested (IntersectionObserver + layout don't run in jsdom — the existing `use-scroll-spy.ts` is untested for the same reason). Verified live instead.

## Build-time visual checks (mandatory — these are the decisions the mockup couldn't settle)

1. **Prose-heavy article at 1920px.** ~~Uncapped text is the riskiest call.~~ **Ran 2026-07-02, and it failed as feared:** the AI FAQs measured 151ch/line. Surfaced to the user with a live three-way comparison (per this check's instruction); resolved as the 90ch column cap — see locked decisions. Re-run the check after the cap lands to confirm the measure reads well.
2. **~1600px mid-width.** No awkward in-between (margins neither snug nor deliberate); grid column count sensible.
3. **1366px Chromebook regression.** The common case must be unchanged in feel: body + rail fill the card, 3-up grid, no new whitespace.
4. **Resize sweep + narrow disclosure.** Drag the width down: grid steps 4→3→2→1 with no slivers; at `<lg` the rail becomes the disclosure, expands/collapses, and a keyboard/zoom user can reach it.

## Out of scope

- Sticky/floating disclosure on narrow screens (MDN's pattern — reach it from anywhere deep in the page). Ship the simple inline disclosure first; add sticky only if zoomed-in users ask.
- H1-starting article support (no such content today).
- The wide-screen TOC whitespace memo (`memory/resources-toc-widescreen-whitespace.md`) is **resolved** by spread — delete it after merge.
