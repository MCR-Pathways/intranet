# WordPress migration RALPH PRD

PRD version: 2026-05-19   ← bump when Tier 1 list grows or invariants change

## Scope

The 22 remaining WP pages, grouped into Bits 2–14. Each bit is its own
`feature/wp-migration-bit-N` branch off `main`; pages within a bit are
sequential commits on that branch; bit end is one PR back to `main`.

Bit roadmap (one source of truth = `scripts/ralph/progress.txt`):

| Bit  | Pages                                                                     |
|------|---------------------------------------------------------------------------|
| 1    | mentor-training — DONE (manual, before RALPH started)                     |
| 2    | participation-forms, yt-participation-forms, pc-support                   |
| 3    | group-work                                                                |
| 4    | jargon, mission-vision-values, information-for-new-staff                  |
| 5    | mentor-yp-engagement, yp-resources  [both BLOCKED]                        |
| 6    | people-services                                                           |
| 7    | fundraising, policy-public-affairs                                        |
| 8    | marketing-toolkit, social-media-policy, press-media-protocol              |
| 9    | cyber-security, pathfinder-guides                                         |
| 11   | communication-calendars  [BLOCKED]                                        |
| 12   | crisis-communications  [BLOCKED]                                          |
| 13   | strategic-plan-2025-2028  [BLOCKED]                                       |
| 14   | faqs + 4 child pages  [BLOCKED]                                           |

Bit 10 intentionally skipped (the cpd-opportunities page was dropped from
scope during planning).

## Invariants (never violate)

### Source + identity
- Source of truth: `/Users/abdulmuizadaranijo/Desktop/oldintranet.xml`.
- Destination: existing live Resources categories. Never create new ones.
- One WP page → one Resources article (strict 1:1).
- Author: `abdulmuiz.adaranijo@mcrpathways.org` (Abdulmuiz's profile id).
- Drive root: `1u0nCOG8fvuw81lRrKXDwbHtuvaT2O-q5`. Subfolder `Resources/{slug}/`.

### Files + commands
- Script: `scripts/migrate-wp-page.ts` (run via `npx tsx`, never `node`).
- Helpers: `scripts/wp-migration/asset-upload.ts`, `scripts/wp-migration/xml-parse.ts`.
- Walker: `src/lib/wp-migration/html-to-plate.ts` (shared with UI Import HTML).
- Publish: `publishAndIndex()` from `src/lib/resource-publish.ts`.
- Standard invocation:
  ```
  npx tsx scripts/migrate-wp-page.ts \
    --slug=<slug> \
    --xml=/Users/abdulmuizadaranijo/Desktop/oldintranet.xml \
    [--category-slug=<sub>] \
    [--parent-category-slug=<parent>] \
    [--dry-run] \
    [--allow-overwrite-published]
  ```

### Caps + idempotency
- Asset cap: 64 MB per file in the script (Vercel's 4.5 MB cap only applies
  to the runtime upload UI; the script bypasses Vercel via service-role
  Supabase + Drive).
- 404 / oversize / network-fail / DB-fail → throw `MigrationHaltError`,
  exit non-zero. Never silently skip.
- Cross-article asset dedup is active via `resource_media.original_url` +
  `resource_media_articles` junction (migration 00097, on `main` since the
  pre-RALPH dedup PR landed). Re-running on an already-migrated article is
  idempotent: existing media rows match by `original_url` (or legacy
  fallback by `original_name` for pre-00097 rows) and only a junction row
  is added.
- Pre-flight: at script start, verify the destination category slug + parent
  slug exist in the live DB. The script's `lookupCategoryId` throws if
  missing — do NOT create from the migration script. (Catches admin-UI
  renames between bits.)
- Pre-flight: verify the slug doesn't collide with an existing non-WP
  article. The script's `upsertArticle` enforces this — halts on a row
  with `content_type !== 'native'` or a different `category_id`, or on a
  currently-published article unless `--allow-overwrite-published` is set.

### Walker safety
- The migration script throws `MigrationHaltError` after the walker if
  walker `warnings` include any of:
  - `Table element` (table structure stripped to plaintext)
  - `Unknown block tag <dl|dt|dd|details|summary|svg`
- Empty `content_json` (zero nodes after walker) halts.
- Inline `style="..."` attributes are silently dropped by the walker. If
  the page body contains `style=`, flag in RESUME.md (operator review).
- HEIC assets: if any discovered asset URL ends `.heic` or `.heif`, halt
  with "needs heic-convert pre-step" (Sharp can't decode HEIC pixels).

### Drive safety
- Drive upload + `shareFileWithDomain` wrapped in `withRetry`: 3 attempts,
  1s + 2s inter-attempt waits, on TRANSIENT errors only (429 / 5xx /
  ECONNRESET / ETIMEDOUT / etc.). Non-transient errors throw immediately.
- On any post-Drive-upload failure (share fail, DB insert fail), the script
  calls `cleanupOrphanedDriveFile` before re-throwing — no Drive litter.

## Tier 1 known patterns — fix inline if observed

### Class A: render-side bugs already fixed in Bit 1 — fix again if regressed
- Bullet list inside indent-paragraph → `<ul>` inside `<p>` hydration error.
  `ParagraphStatic` + `ParagraphElement` render `<div>` when
  `indent + listStyleType`. Files: `src/lib/plate-static-plugins.tsx`,
  `src/components/resources/plate-elements.tsx`.
- Link element → `<div data-slate-inline>` inside `<p>` hydration error.
  `LinkStatic` + `LinkElement` render `<a>` directly without
  `SlateElement`/`PlateElement`.
- Random Slate ID hydration mismatch. `addStableNodeIds` in
  `prepareNativeArticle`.
- `timeAgo` span "X minutes ago" hydration mismatch.
  `suppressHydrationWarning` on the span in `native-article-view.tsx`.
- List item whitespace leak (tabs as text leaves). `normaliseInlineWhitespace`
  + `trimEdgeWhitespaceLeaves` in walker.
- Video iframe autoplays. Walker must NOT include `autoplay` in `allow=` /
  embed URL; local MP4s use `<video controls preload="metadata">` via
  `media_embed` for `/api/drive-file/` URLs.
- Document link renders as "card" instead of inline link. `FileStatic` +
  walker emit inline `<a target="_blank">`; Office docs → Drive
  `/file/d/{id}/preview`, others → `/api/drive-file/{id}`.

### Class B: design-system violations introduced anywhere — fix inline
- Button `variant="ghost"` or `size="sm"` for primary CTA → swap to
  `default` navy + `default` or `lg`. See `docs/button-system.md`.
- Outline button on grey/card background invisible → add
  `className="bg-card"`.
- Explicit `h-X w-X` / `mr-X` / `ml-X` on icon child inside Button → remove.
  ESLint rule `mcr-button/no-icon-sizing-inside-button` autofixes at
  `error` severity. `npm run lint -- --fix` resolves on save.
- Warning surface using `border-mcr-orange bg-mcr-orange/5 text-mcr-orange`
  → migrate to semantic `amber-*` per `docs/design-system.md` §1.7.

## Tier 2 — novel issues

Anything not on the Tier 1 list. Write `[BLOCKED: novel — {short desc}]`
in `progress.txt` and exit. When the user resolves a novel-pattern BLOCKED,
they MUST update this PRD's Tier 1 section AND bump the PRD version line.

## Per-iteration verification checklist (full Bit-1 standard)

For the migrated article at `/resources/article/{slug}`:

### Article view
1. Open `/resources/article/{slug}` in Chrome MCP. Tab discovery: call
   `tabs_context_mcp` first; reuse a matching-URL tab, else create.
2. Confirm breadcrumb shows the correct parent → subcategory hierarchy.
3. Read page content; confirm title + body match WP source (spot-check
   first 3 paragraphs + last paragraph + every H2).
4. Article-outline TOC (right-rail) populates from H2s — count matches.
5. Hero/banner image (if present) renders; body `<img>` elements render.
   Every image has non-empty alt text or is genuinely decorative.
6. Click each PDF link → opens in Chrome's PDF viewer (inline) via
   `/api/drive-file/{fileId}`.
7. Click each video embed → external embed plays in iframe (no autoplay),
   or local HTML5 player plays with controls; no autoplay.
8. Click each Google Slides/Docs/Sheets link → opens external in new tab.
9. Click each inline Office document link (Word/PowerPoint/Excel) →
   opens Drive `/preview` in new tab.
10. Bookmark toggle works (icon toggles, no console error, page refresh
    shows persisted state).

### Console + network + index
11. Chrome DevTools console → no errors, no React hydration warnings
    beyond the known harmless Radix ID one.
12. Network panel → no 404s on assets.
13. Article appears on the subcategory landing page
    (`/resources/<parent>/<sub>`).

### Editor view
14. Click "Edit" → editor loads, content matches view. Scroll. Type a
    character then undo. No console errors.

### Filesystem + index
15. Drive folder `MCR Intranet Attachments/Resources/{slug}/` → asset
    count matches expected; filenames are recognisable.
16. Cmd+K search → article appears for the slug terms. (Wait 3s + retry
    once; Algolia indexing is eventually consistent.)

### Viewport
17. Set Chrome viewport to 1366×768 (Chromebook baseline). Re-walk steps
    1–6 at this size. Article width, TOC visibility, breadcrumb wrap
    acceptable.

## Output contract

Each iteration ends by writing to `scripts/ralph/RESUME.md` one of:
- `Last iteration result: COMPLETE` — this page done, more in bit
- `Last iteration result: BIT-COMPLETE` — all slugs in current bit done
- `Last iteration result: BLOCKED` — page failed; `[BLOCKED: ...]` also
  written to `progress.txt`
- `Last iteration result: HALTED` — stop signal present

The loop wrapper reads the `Last iteration result:` line. The
`<promise>...</promise>` tag mentioned in the original RALPH article is
decorative for human readers; not parsed.

## Commit message template

```
feat(resources): migrate {slug} from WordPress (bit {N})

{1-2 sentence summary: what was migrated, asset count, any Tier 1 fixes
 applied this iteration.}
```

- NO `Co-Authored-By: Claude` trailer.
- NO 🤖 / "Generated with Claude Code" footer.
- One commit per page on the current bit branch.

## Where to read for context (before each iteration)

- Root `CLAUDE.md`
- `src/app/(protected)/resources/CLAUDE.md`
- `src/lib/CLAUDE.md`
- `docs/button-system.md`
- `memory/MEMORY.md` → especially
  `memory/feedback_button_convention_checklist.md`,
  `memory/feedback_sharp_heic_limitation.md`,
  `memory/feedback_no_claude_attribution.md`
