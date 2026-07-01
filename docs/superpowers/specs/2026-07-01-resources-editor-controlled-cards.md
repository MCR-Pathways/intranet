# Resources §2.1 — editor-controlled resource cards

**Date:** 2026-07-01
**Status:** Design approved (2026-07-01), pending spec review. Refines §2 (content-aware resource grid, #375). Independent of §4 (reading rail) and the parked accessibility follow-ons (k32–k35).

## Problem

§2 grids resource cells automatically: a run of 4+ consecutive files or standalone links renders as a card grid, and anything below that threshold stays an inline/bulleted link. The author has no say. A lone link (e.g. "Getting to Know You Activity Plans") can't be a card even when it should match the tiles beside it, and a 4+ run can't be kept as a plain list. The threshold guesses intent.

## Design

Keep auto-detection **and** add an explicit per-link override. Both coexist under one precedence rule.

- **Stored flag.** Each candidate (a file void, or a link alone on its line) carries an optional `displayAsCard` boolean on its node. Unset by default.
- **Precedence (read path):**
  - `displayAsCard === true` → the item is a card regardless of neighbour count (a lone card is allowed — the core new capability).
  - unset → auto-detection decides: a card iff it sits in a run of 4+ adjacent candidates (today's behaviour, unchanged).
  - `displayAsCard === false` (force-inline inside a 4+ run) is **out of scope for v1** — see below.
  - The 4+ run is measured over all adjacent candidates (flagged or not). The flag only *adds* cards below the threshold; it never removes them (that is what opt-out, v2, would do). So flagging one link in a group of four just confirms what auto-detection already does.
- **Layout.** The renderer groups each maximal run of *adjacent cards* (card-by-flag or card-by-auto) into one grid (2-up/3-up, row-major, as §2). A single card renders as one tile at grid-cell width, left-aligned. An inline link between cards splits the run.
- **Authoring (the tickbox).** The link insert/edit popover gains a **"Display as a card"** checkbox. It is enabled only when the link is standalone (its paragraph's only meaningful child — the existing `standaloneLink` condition); for an in-sentence link it is disabled with a hint ("put the link on its own line to show it as a card"). Ticking sets `displayAsCard: true`; the editor renders the card treatment immediately (WYSIWYG parity with the read view). The same control appears in the edit popover, so a link flips card↔inline after the fact.
- **Files.** Uploaded files get the same flag, defaulting to card (they are attachment-like); unticking renders a file as an inline link/download.

## Index-safety

`displayAsCard` is presentational only. The Algolia serialisation path (`createNativeStaticEditor`) already renders links inline and never groups, so it simply ignores the flag: a card-link indexes exactly as an inline link. No change to the Algolia path — the property is invisible to search. This is what keeps the change cheap and preserves the §2 index-safety contract.

## No migration

Auto-detection stays as the default, so every existing 4+ grid keeps rendering unchanged. The flag is purely additive; no stored content is rewritten. (This is the payoff of keeping both mechanisms — retiring auto-detection would have forced a content migration.)

## Edge cases and resolutions

- **Lone card** — the flag forces it; renders as one tile at grid-cell width, left-aligned.
- **In-sentence link** — the tickbox is disabled unless the link is standalone; a card is a block, so a mid-sentence link can't become one.
- **Adjacent mixing** (a card next to an inline link) — the renderer groups only maximal runs of adjacent cards; an inline link splits the run. WYSIWYG shows the result, so the author flags consistently.
- **Editing later** — the same control lives in the link's edit popover.
- **Existing content** — nothing to migrate; auto-detection handles every current grid; the flag only affects links an editor touches.
- **WYSIWYG** — the editor's link element renders the card treatment when flagged, matching the published view.

## Files (approximate — the plan grounds exact paths)

- The Plate link element + its insert/edit popover — add the "Display as a card" checkbox, gate it on the standalone condition, and render the card treatment in-editor.
- `src/lib/resource-grid.ts` — the card-state rule (`displayAsCard === true` OR in a 4+ run of candidates) and the adjacent-card grouping; `standaloneLink`/`resolveResourceCell` stay.
- `src/lib/plate-static-plugins.tsx` — the read-path `ResourceGrid` renderer, updated to group by the new rule rather than the raw 4+ threshold.
- The file void element — the same flag, default-on.

## Tests

- Render rule: flag=true on a lone candidate → card; unset lone candidate → inline; unset in a 4+ run → card; a card-flagged link serialises identically to an inline link on the Algolia path (index-safety regression).
- Editor: the tickbox is disabled for an in-sentence link; ticking a standalone link renders a card; adjacent cards group into a grid.
- Manual (Chrome MCP): a lone card renders as one tile; an existing 4+ grid is unchanged; ticking a real lone link (the Activity Plans case) turns it into a card.

## Out of scope (v1)

- **Opt-out** (`displayAsCard: false` to force a link inline within a 4+ run). A trivial extension of the same flag — turns the checkbox into a three-way "Auto / Card / Inline" control. Ship only if editors ask.
- Drag-reorder of cards; multi-select bulk-flag. Not needed for the core.

## Roadmap fit

Refines §2 on the resources-redesign track. Independent of §4 (reading rail) and the parked accessibility follow-ons. Sequence: §2.1 now, §4 next (grounding captured), a11y follow-ons after.
