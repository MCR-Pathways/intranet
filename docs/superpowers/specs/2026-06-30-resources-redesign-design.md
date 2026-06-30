# Resources redesign — design spec

**Date:** 2026-06-30
**Status:** Awaiting review. No feature code until this is approved.
**Visual companion:** the MCR plan page (private): https://zip.mcrpathways.org/resources-redesign-plan.html

## Goal

Four targeted fixes to the resources reading and authoring experience, each shipped as its own small PR through the build loop:

1. **§1** Sticky editor toolbar
2. **§2** Content-aware resource grid
3. **§3** Single-item folder promotion
4. **§4** Reading-rail contents list

Everything below was verified against the live code (2026-06-29/30). The brief's intent is followed; several of its literal instructions were refined after reading the code (the §1 sticky offset and `overflow` mode, and the §2 node model).

## Locked decisions

- **Render-time guardrail.** We accept render-time transformation of stored content, bounded: every such transform must be presentation-only (it never changes what is stored, indexed, or anchored) and previewable by the editor. We don't add more render magic beyond the grid and promotion without meeting that bar.
- **§1** One sticky bar (format tools + Save/View/Publish), not two stacked bars. Built via a right-hand slot on the editor toolbar.
- **§2** The grid is auto-detected (no author opt-out for now). Threshold is 4 consecutive resource cells.
- **§2** Collapsible themes are **cut**. The reading rail (§4) handles navigation.
- **§2** Grid cells are typed by URL, reusing `FileStatic` logic: proxy files (PDF/image/text) open the lightbox; Office docs and external links open a new tab with the ↗.
- **§2** Lightbox scope = **grid only** (Option A). Prose links and file-attachment blocks keep today's new-tab behaviour.
- **§3** Promote any folder with exactly one **published** article. Drafts in a promoted folder stay reachable via `/resources/drafts` and the admin audit. No per-folder override.
- **§4** Active marker = teal text + a 3px teal left bar + bolder weight, with a bold "On this page" label (colour + weight, belt-and-braces).
- **§4** The rail shows all headings, **H2 + H3 only** (never H4), with scroll-spy. No expand/collapse — matches React.dev and MDN.

## Workflow

Each fix is a separate PR on its own feature branch off `main`. Per fix: build, run `/code-review` and address findings, commit, push as a PR, request `/gemini review`, verify and reply to every comment, loop (cap 3 rounds), then wait for explicit merge approval. Phase-0 docs (this spec, the `resources/CLAUDE.md` marker-rule rewrite, `design-system.md`, `docs/plan.md`) are updated before the code they describe.

---

## §1 — Sticky editor toolbar

### Problem
Editing a long native article, the formatting toolbar scrolls out of view. It sits at the top of the editor card with no sticky behaviour, and the card wrapper's `overflow-hidden` would defeat sticky even if added.

### Corrections to the brief
- `sticky top-0` is wrong: the app header (`header.tsx:70`) is `sticky top-0 z-50`, 64px tall, so a toolbar at `top-0` parks behind it. Use `top-16`.
- "Remove `overflow-hidden`" → change it to `overflow-clip`, which keeps the rounded-corner clip and does not create a scroll container that breaks sticky (documented in `.claude/rules/ui-components.md`).

### Design
One sticky bar, not two. `EditorToolbar` in `plate-editor.tsx` gains a `rightSlot` prop so the component stays reusable; `native-article-editor.tsx` passes its Save / View / Publish cluster into that slot and drops its separate header bar. The single bar is `sticky top-16 z-10` with an opaque fill (`bg-muted`, not `bg-muted/30`, so body text doesn't bleed through). The editor card wrapper (`plate-editor.tsx:646`) changes `overflow-hidden` → `overflow-clip`. The optional Plate `FloatingToolbar` selection bubble (Bold/Italic/Underline/Strikethrough/Link/turn-into-H2-H3, Esc to dismiss) ships only if positioning behaves; otherwise the sticky bar alone is the fix.

A11y: the toolbar stays keyboard-reachable; the bubble, if built, dismisses on Esc, never traps focus, and exposes buttons to screen readers.

### Files
- `src/components/resources/plate-editor.tsx` — `rightSlot` on `EditorToolbar`, sticky `top-16` + opaque fill, card `overflow-clip`.
- `src/components/resources/native-article-editor.tsx` — pass Save/View/Publish into the slot; remove the standalone bar.

### Tests
- Component test: toolbar renders the `rightSlot` content; sticky classes present.
- Manual: scroll a long article in the editor, confirm the bar stays put below the header and content doesn't bleed through.

---

## §2 — Content-aware resource grid

### Problem
Article bodies are capped at `max-w-[720px]` (`article-constants.ts:18`, plus inlined in `native-article-view.tsx:243` and `google-doc-article-view.tsx:342`). On resource hub pages the per-theme link lists stack one-per-line, leaving two-thirds of the width empty. Group Work is the worst case (~71 resources across 7 themes).

### Correction to the brief (verified node model)
The resources are **not** link nodes. The WP migration hoists each PDF/doc into a standalone `file` void block (`html-to-plate.ts:626`), because Plate's static renderer can't render void blocks inside list-styled paragraphs. So a resource run is consecutive `file` nodes, not "list items containing a link." The detector targets `file` nodes (and, optionally, single-link list paragraphs for editor-made link lists).

### Design

**Detector (shared).** A `file` node qualifies as a resource cell. Optionally, an indent-list paragraph (`p` with `listStyleType`) whose only non-empty child is a single `a` qualifies too. A run is 4+ consecutive resource cells; a heading or any non-resource block ends a run, so a run at the start or end of the article still qualifies. The same detector drives the read-view grid and the editor hint, so the rule is defined once.

**Read path (render-only).** In `prepareNativeArticle` (`plate-static-plugins.tsx`), after `addHeadingIds` (so headings come from the flat tree and the TOC is unaffected) and before `createStaticEditor`, a `groupResourceGrids` transform wraps qualifying runs in a `resource_grid` node. A registered `ResourceGrid` static component renders a real `<ul role="list">` as a row-major CSS grid: 3-up at ≥1024px, 2-up below. The Algolia path (`createNativeStaticEditor`) is untouched, so the flat list is indexed exactly as today.

**Cell behaviour, typed by URL (reusing `FileStatic`).** Proxy files (`/api/drive-file/{id}`: PDF, image, text, CSV) open the in-app lightbox. Office docs (a Drive `/preview` URL) and external links open a new tab with the ↗ and an accessible "opens in a new tab" name. Internal intranet links (relative `/…` or an `i.mcrpathways.org` URL) navigate in-app, same tab. The cell shows an extension-based label, not a hardcoded "PDF".

**Labels wrap, never truncate.** Long resource names wrap to two lines; cells in a row equalise height (`align-items: stretch`). No ellipsis.

**Lightbox (scope = grid only).** Reuse the news-feed `DocumentLightbox`, genericised: drop its coupling to the `PostAttachment` type and take plain props (`open`, `onOpenChange`, `title`, `iframeSrc`, `newTabUrl`). The mime branching moves to the news-feed call site; its existing test is updated. Resources passes the proxy URL as `iframeSrc`. The grid is a browser-only node type, so its interactivity never touches the Algolia-shared `LinkStatic`/`FileStatic` serialisers; `LinkStatic` and `FileStatic` stay pure. The read view is already a client component (scroll-spy, realtime, glossary filter), so lightbox open/close state fits with no architecture change.

**Editor hint.** The shared detector flags qualifying runs in the editor with a quiet "displays as a grid when published · Preview" affordance. Authoring stays a flat list, so all ~80 existing native articles upgrade with no re-editing. (Preview opens the read view in a new tab.)

**Collapsible themes: cut.** The reading rail navigates long pages; folding the content too is redundant, adds an interactive component plus expand-on-anchor and default-state decisions, and would have risked the `toggle_v2` trap (a toggle summary isn't a heading, so it would strip a theme's Algolia section, anchor, and TOC row).

### Index-safety (must hold)
Indexing runs server-side from the stored `content_json` via `createNativeStaticEditor`. The grid is a render-only transform on the browser path only. Stored JSON, headings, and anchors are unchanged. This is locked by a regression test (below).

### Files
- `src/lib/plate-static-plugins.tsx` — `isResourceCell` detector, `groupResourceGrids` in `prepareNativeArticle`, `BaseResourceGridPlugin` + `ResourceGrid` component, per-type cell rendering, lightbox state hook-up.
- `src/components/resources/native-article-view.tsx` — host the lightbox open/close state for grid cells.
- `src/components/news-feed/document-lightbox.tsx` — genericise props (drop `PostAttachment` coupling).
- `src/components/news-feed/attachment-display.tsx` (+ `document-lightbox.test.tsx`) — pass computed `iframeSrc`/`newTabUrl`; update the test.
- `src/components/resources/plate-editor.tsx` (or the editor element module) — the "displays as a grid · Preview" hint.

### Tests
- Detector: qualifying run of 4+ `file` nodes grids; a prose paragraph containing a link does not; a non-resource item breaks a run; fewer than 4 stays a list; mixed file types classify correctly.
- Algolia regression (extend `plate-static-plugins.test.tsx`): the grid transform produces the same indexed sections as the flat tree (the "one heading → one section" contract still holds).
- Lightbox refactor: `document-lightbox.test.tsx` stays green (news-feed not regressed); a resources grid cell opens the lightbox with the proxy URL.

### Edge cases
- Row-major preserves document order; an odd count leaves the last row part-filled and left-aligned (never CSS `columns`).
- A11y: real `<ul role="list">` in DOM order; ↗ has an accessible name; the lightbox traps and restores focus (Radix Dialog).

---

## §3 — Single-item folder promotion

### Problem
In some categories a subcategory folder wraps a single article with a near-duplicate name (e.g. "Jargon Buster" → "MCR Jargon Buster"). That's an extra click and a redundant label, an artefact of flattening old WordPress pages one-to-one.

### Design
A shared predicate `isPromotableFolder(group)` returns true when the group has exactly one **published** article (counted by `status === "published"`, not the editor's draft-inclusive view). It drives both the index and the redirect, so they can't disagree.

**Index.** Server-side, where the groups are built (`fetchGroupedSubcategoryArticles` in `actions.ts`, consumed by `[...slug]/page.tsx`), promotable groups lift their single article into the direct-article list and drop the folder. Multi-item folders are unchanged. Folders and direct articles already coexist in one list.

**Redirect.** In `[...slug]/page.tsx`, after a category resolves, if it is promotable, redirect to `/resources/article/{slug}` reusing the existing `articleRedirectSlug` destination shape (the trigger is new; the mechanism is reused). Old folder bookmarks survive.

**Drafts.** A draft in a promoted folder doesn't appear in the category view; it stays reachable via `/resources/drafts` and the admin audit. Readers and editors see the same structure. No per-folder override: publishing a second article naturally un-promotes the folder, and the audit surfaces every promoted folder for review.

**Audit.** An editor-only list of all one-article folders, extended to flag very long flat link lists with no sub-headings. Location to confirm at build (extend `/resources/drafts` or a small new view).

### Files
- `src/app/(protected)/resources/actions.ts` — `isPromotableFolder`; promotion in `fetchGroupedSubcategoryArticles`; redirect trigger in/around `fetchCategoryBySlugPath`.
- `src/app/(protected)/resources/[...slug]/page.tsx` — apply promotion + redirect with the shared predicate.
- Audit view (location TBD) + reuse of `/resources/drafts`.

### Tests
- `isPromotableFolder`: 1 published → true; 1 published + drafts → true; 2 published → false; 0 published → false.
- Index promotes a single-published folder to a direct row; multi-item folders unchanged.
- Redirect: visiting a promotable folder's path 301s to the article; the redirect predicate matches the index predicate (shared function).

### Edge cases
- A promoted folder that later gains a second published article reverts to a folder (no migration needed; computed on read).

---

## §4 — Reading-rail contents list

### Problem
The "On this page" list is a bordered box whose only depth cue is indentation plus a faint opacity step, and it's `hidden lg:block`, so below 1024px it vanishes entirely (a reflow/zoom a11y failure).

### Design
Replace the box with a rail: a left border track, level encoded by weight and size (H2 > H3), and one active marker. The active item carries a 3px teal left bar **and** teal bolder text; the "On this page" label is a bold, full-strength title (it's a different register from the nav links, so they don't compete). The rail shows all headings, **H2 + H3 only** — never H4 (matching React.dev; H4s still get anchor ids for deep links and search, they're just not listed). No expand/collapse: scroll-spy moves the marker, the list is stable.

Below 1024px the rail collapses to a real `<button aria-expanded>` "On this page" disclosure instead of disappearing. Scroll-spy (`use-scroll-spy.ts`) and the glossary-filter heading-hiding (`visibleHeadings` in `native-article-view.tsx`) are preserved; `aria-current` stays on the active item.

This supersedes the documented "grey bg-accent pill, no brand colour, weight stays identical" note in `resources/CLAUDE.md`; that line is rewritten so a future pass doesn't revert it.

### Files
- `src/components/resources/article-outline.tsx` — rail, weight-by-level, teal marker (Option B), all-headings (H2+H3) with scroll-spy, narrow-screen disclosure.
- `src/app/(protected)/resources/CLAUDE.md` — rewrite the TOC-marker rule.
- `docs/design-system.md` — note the active-marker treatment.

### Tests
- Component: renders only H2+H3; active item has the marker and `aria-current`; below 1024px renders the disclosure button.
- Manual: scroll-spy marks the right section; glossary filter still hides emptied sections.

---

## Build order & PR sequencing

1. **§1 Sticky toolbar** — self-contained, ship-first. One sticky bar via the toolbar right-slot, `overflow-clip`, optional bubble.
2. **Genericise `DocumentLightbox`** — decouple from `PostAttachment`, update the news-feed call site + test. Lands before §2 so the grid can reuse it.
3. **§2 Resource grid** — detector, `groupResourceGrids`, `ResourceGrid` with per-type cells + lightbox, the editor hint.
4. **§3 Folder promotion** — shared predicate, server-side promotion, redirect, audit view.
5. **§4 Reading rail** — `article-outline` rewrite + the docs rule rewrite.

## Phase-0 docs to update (before the code they describe)
- This spec (committed).
- `resources/CLAUDE.md`: rewrite the TOC-marker rule to belt-and-braces; add the resource-grid render-only pattern; note collapsible themes evaluated and not used.
- `docs/design-system.md`: the TOC active-marker treatment.
- `docs/plan.md`: log the resources redesign.

## Build-time confirmations (not product decisions)
- Confirm the grid node model against a real Group Work `content_json` before finalising the detector.
- Decide the audit view's location (extend `/resources/drafts` or a small new view).
