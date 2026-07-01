# Resources redesign — design spec

**Date:** 2026-06-30
**Status:** Approved and in build. §1 (sticky toolbar) shipped via #373. §2 settled 2026-06-30 — Direction A cell + Style C chips, grids files and standalone links, no lightbox; accessibility of Workspace links is a parked follow-on; §3–§4 unchanged from the original spec.
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
- **§2** Detector targets **`file` nodes and standalone links** (build-loop decision 2026-06-30; supersedes the earlier files-only call, once we recognised MCR's resources are largely Google Workspace links, not uploaded files). A resource cell is a `file` void node, or a paragraph whose only meaningful child is a single link. A link **inside a sentence** stays inline prose via `LinkStatic`; only a link **on its own line** becomes a tile. A run of 4+ consecutive cells auto-grids.
- **§2** Collapsible themes are **cut**. The reading rail (§4) handles navigation.
- **§2** Cell = **Direction A** with a **Style C chip**: a white bordered card, a full colour-tinted type chip + Lucide-style glyph on the left, the name at medium weight (500)/15px with the extension stripped, **no "kind" label** (the chip carries the type), no `↗` and no "(external)"/"opens here" text.
- **§2** Type taxonomy: **PDF / file types** from the filename extension via `resolveFileType`; **Google Doc / Sheet / Slides / Form / Drive** from the link URL; **internal page** from an app-origin or relative URL; **external** otherwise. Glyphs are Lucide-style (no third-party logo art embedded).
- **§2** Open behaviour: file cells → the Drive proxy (`<a target="_blank">`; PDFs/images inline, others download); link cells → their own href (internal → same tab, external/Google → new tab). **No lightbox** — resources files are service-account-served, so the news-feed's Drive `/preview` model doesn't apply.
- **§2** Accessibility is **not** §2's job. The grid is a visual re-layout — it neither fixes nor regresses reachability. PDFs (proxy) and internal Google-Doc articles are already accessible to Google-blocked staff; a raw Google/external tile is exactly as reachable as the same link was inline. Serving Workspace docs through the intranet so those tiles open an intranet copy is the **parked** follow-on (see roadmap), not §2.
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

### Node model (verified)
The WP migration hoists each PDF/doc into a standalone `file` void block (`html-to-plate.ts:626`), and Google Workspace / web references are `a` link nodes. So a resource run is a mix of consecutive `file` voids and standalone-link paragraphs — the detector handles both. This supersedes the earlier "files-only" reading: MCR's documents are largely Google Workspace links, so link tiles matter.

### Design

**Detector (shared).** A resource cell is either (a) a `file` void node, or (b) a paragraph whose only non-whitespace child is a single link (`a`). A link inside a sentence is **not** a cell — it stays inline prose via `LinkStatic`. A run is 4+ consecutive cells; a heading or any other block ends a run, so a run at the start or end of the article still qualifies. The same detector drives the read-view grid and the editor hint, so the rule is defined once.

**Read path (render-only).** In `prepareNativeArticle` (`plate-static-plugins.tsx`), after `addHeadingIds` (so headings come from the flat tree and the TOC is unaffected) and before `createStaticEditor`, a `groupResourceGrids` transform wraps qualifying runs in a `resource_grid` node. A registered `ResourceGrid` static component renders a real `<ul role="list">` as a row-major CSS grid: 3-up at ≥1024px, 2-up below. The Algolia path (`createNativeStaticEditor`) is untouched, so the flat list is indexed exactly as today.

**Cell — Direction A, Style C chip.** Each cell is a white bordered card: a full colour-tinted type chip with a Lucide-style glyph on the left, then the name at medium weight (500), 15px, **extension stripped**, **no "kind" label** (the chip carries the type) and no `↗`. The whole cell is an `<a>`.

**Type detection.** A shared `resolveResourceType(node)` returns `{ key, label, icon, colour }` for the chip:
- **`file` node** → `resolveFileType(mimeType, name)` (`src/lib/file-types.ts`) → PDF / DOC / XLS / PPT / TXT / FILE. Nodes carry no `mimeType`, so the filename extension is the live signal.
- **link node** → classify by URL: `docs.google.com/document` → Google Doc; `/spreadsheets` → Sheet; `/presentation` → Slides; `/forms` → Form; `drive.google.com` → Drive; an app-origin or relative URL → internal page; anything else → external.

File types reuse `file-types.ts`; the Workspace/link types are a new small map alongside the detector. Glyphs are inline Lucide-style SVGs — no third-party logo art.

**Open behaviour.** File cell → `<a href={node.url} target="_blank" rel="noopener noreferrer">` to the Drive proxy (PDFs/images inline, Office/text/CSV download — today's `FileStatic` behaviour). Link cell → `<a href={link.url}>`: internal links navigate in-app (same tab); external / Google links open a new tab with `rel="noopener noreferrer"`. No in-app lightbox.

**Accessibility (out of scope for §2).** The grid is presentation-only — it doesn't change whether a destination is reachable. PDFs (proxy) and internal Google-Doc articles are accessible to Google-blocked staff today; a raw Google/external tile is exactly as reachable as the inline link was. Making Workspace links open intranet-served copies is the parked accessibility follow-on (serve Sheets/Slides, rehost Doc images, the inline document-reference primitive), not §2. §2 must not *claim* a raw Google tile is accessible: the chip states the type honestly (a Google Doc/Sheet link) and it opens Google.

**Labels wrap, never truncate.** Long names wrap to two lines; cells in a row equalise height (`align-items: stretch`). No ellipsis.

**Editor hint.** The shared detector flags qualifying runs in the editor with a quiet "displays as a grid when published · Preview" affordance. Authoring stays a flat list, so existing native articles upgrade with no re-editing. (Preview opens the read view in a new tab.)

**Collapsible themes: cut.** The reading rail navigates long pages; folding the content too is redundant, adds an interactive component plus expand-on-anchor and default-state decisions, and would have risked the `toggle_v2` trap (a toggle summary isn't a heading, so it would strip a theme's Algolia section, anchor, and TOC row).

### Index-safety (must hold)
Indexing runs server-side from the stored `content_json` via `createNativeStaticEditor`. The grid is a render-only transform on the browser path only. Stored JSON, headings, and anchors are unchanged. This is locked by a regression test (below).

### Files
- `src/lib/plate-static-plugins.tsx` — `isResourceCell` (a `file` void **or** a standalone-link paragraph), `resolveResourceType` (file-type via `resolveFileType` + link-type via URL), `groupResourceGrids` in `prepareNativeArticle`, `BaseResourceGridPlugin` + `ResourceGrid` (Direction A / Style C cell rendering an `<a>` per the open-behaviour rules).
- `src/lib/file-types.ts` — reused as-is for the file-type chips. No change expected.
- The Workspace/link chip map (Doc / Sheet / Slides / Form / Drive / internal / external → glyph + colour) lives alongside the detector.
- `src/components/resources/plate-editor.tsx` (or the editor element module) — the "displays as a grid · Preview" hint.

(No news-feed files: no lightbox, so `DocumentLightbox` / `attachment-display` are untouched.)

### Tests
- Detector: 4+ `file` nodes grid; 4+ standalone-link paragraphs grid; a mix of files and standalone links grids; a link **inside a sentence** does **not** grid (stays inline); a heading breaks a run; fewer than 4 stays a list.
- Type detection: file extensions → `resolveFileType` (pdf→red … unknown→FILE); `docs.google.com/document`→Doc, `/spreadsheets`→Sheet, `/presentation`→Slides, `/forms`→Form; `drive.google.com`→Drive; app-origin/relative→internal; else→external.
- Cell rendering: Style C chip (colour + glyph) per type; the name has the extension stripped; the cell is an `<a>` with the right target (internal same-tab; external/Google `target="_blank" rel="noopener noreferrer"`).
- Algolia regression (extend `plate-static-plugins.test.tsx`): the grid transform produces the same indexed sections as the flat tree (the "one heading → one section" contract still holds).

### Edge cases
- Row-major preserves document order; an odd count leaves the last row part-filled and left-aligned (never CSS `columns`).
- Open behaviour: file cells → proxy (PDF/image inline, others download); internal link → same tab; external/Google link → new tab.
- A11y: real `<ul role="list">` in DOM order; each cell is a proper `<a>` with the resource name as its accessible name; new-tab links carry `rel="noopener noreferrer"`.
- A raw Google/external tile opens Google (new tab) — reachable only if the staff member's network allows. §2 doesn't dress it as intranet-served; the parked accessibility work does that.

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

1. **§1 Sticky toolbar** — shipped (#373).
2. **§2 Resource grid** — one PR, no prerequisite: detector (files + standalone links), `resolveResourceType`, `groupResourceGrids`, `ResourceGrid` with the Direction A / Style C cell, the editor hint. No lightbox. (Accessibility of Workspace links is a parked follow-on — see the roadmap.)
3. **§3 Folder promotion** — shared predicate, server-side promotion, redirect, audit view.
4. **§4 Reading rail** — `article-outline` rewrite + the docs rule rewrite.

## Phase-0 docs to update (before the code they describe)
- This spec (committed).
- `resources/CLAUDE.md`: rewrite the TOC-marker rule to belt-and-braces; add the resource-grid render-only pattern; note collapsible themes evaluated and not used.
- `docs/design-system.md`: the TOC active-marker treatment.
- `docs/plan.md`: log the resources redesign.

## Build-time confirmations (not product decisions)
- Confirm the grid node model against a real Group Work `content_json` before finalising the detector.
- Confirm real `file`-node `name` values: the label strips the extension by default, but if migrated names are ugly slugs (e.g. `group-trust-guide-v2.pdf`) decide whether to tidy them at render or leave as-is. (§2 cell.)
- Decide the audit view's location (extend `/resources/drafts` or a small new view).
