# RESUME for next iteration

Last iteration ran at: 2026-05-20T08:16:20Z (loop spawn failed — claude binary not on subshell PATH; ANTHROPIC_API_KEY missing)
Last iteration result: FAILED-SPAWN (decommissioned for Bit 3; falling back to in-session)
Last slug: <none migrated this attempt>

## Active bit

Bit 3 — large-asset stress test
Branch: feature/wp-migration-bit-3 (off main)
Drive mode: in-session (loop spawn issues documented in scripts/ralph/SPAWN_ISSUES.md)

## Last page migrated

Bit 2 closed: pc-support → programme-resources/pc-support (28 PDFs).
participation-forms + yt-participation-forms had been consolidated into
pc-support upstream; both were over-migrated then rolled back, scotland-
programme + england-programme subcategories soft-deleted (PR #311 merged).
Walker fix for collapseEmptyParagraphs (Tier 1) landed in the same PR —
protects against `<p><a>...</a></p>` being dropped as empty.

## Next page

slug: group-work
WP URL: https://i.mcrpathways.org/group-work/
Target category: programme-resources/group-work
   (Subcategory created via scripts/wp-migration/create-category.ts for
   this bit since the original scotland-programme dest was soft-deleted
   in Bit 2 cleanup.)

Dry-run done in-session before this iteration: 72 distinct assets (71 PDFs
+ 1 JPG), 108 Plate nodes, no halt-pattern warnings.

## Dev server

Status: running on localhost:3000 (assumed; checked at start of in-session run).

## Outstanding anomalies (non-blocking)

- RALPH loop spawn failed end-to-end first try. Two prerequisites
  surfaced — claude binary path resolution + headless API auth — both
  documented in scripts/ralph/SPAWN_ISSUES.md. Loop validation pushed
  to a future bit (or skipped entirely if API spend isn't worthwhile).

## Recently BLOCKED entries

(none — Bit 5/11/12/13/14 still have pre-tagged BLOCKED entries from
the initial setup; not yet active)

## Chrome MCP

Strategy: call `tabs_context_mcp` first; reuse a tab whose URL matches
the target article URL, else create.

## Notes from previous iteration

Bit 3 driven in-session (not via ralph-loop.sh) after the loop spawn
crash. Same shape as Bits 1 and 2. group-work is the biggest single
page in scope (72 assets, 108 Plate nodes) — first real stress test of
the upload pipeline + retry logic + dedup junction at volume.
