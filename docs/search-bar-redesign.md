# Global search bar — design spec

**Status:** design agreed, ready for implementation plan
**Date:** 2026-06-23
**Visual mockup:** `~/.agent/diagrams/search-bar-redesign-plan.html` (published, staff-only: https://zip.mcrpathways.org/search-bar-redesign-plan.html)

This is the design we build from. It was settled through brainstorming, live DOM inspection of real products and our own intranet, and the house intent gate in `docs/ui-ux-principles.md`. The implementation plan comes next.

## 1. Why this exists

Search today is a magnifier icon in the header that opens a `cmdk` command palette inside a modal Dialog. It works, but it reads as an afterthought — people miss it. The ask is to make search a prominent, always-visible bar (Gmail as the muse) and to widen what it finds to include news posts.

The user: a staff member mid-task who wants to jump to a resource, a course, or a news post without navigating there. ~80 staff, Chromebook-first (1366px typical), desktop-only for this pass.

The constraint that shaped the design: a prominent bar must not over-promise (it doesn't search everything), must not straddle the sidebar, and must leave the existing header cluster (bell, avatar) intact.

## 2. Scope — what the bar finds

- **Resources** — already indexed (`resources_articles`). Unchanged.
- **Courses** — already indexed (`learning_courses`), only `published` AND `is_active`. Unchanged. A course you've completed still appears; completion is your state, not the course's.
- **News posts** — the one new build. A post counts as news when `post_type = 'news'` AND `is_weekly_roundup = false`. That includes polls (a poll is a news post with a question) and excludes kudos (`post_type = 'kudos'`) and weekly round-ups (`is_weekly_roundup = true`).
- **People** — deferred. Profiles carry access-sensitive fields and our Algolia search runs anonymously (a public search key, no per-user filter), so indexing people would leak across the access boundary. Revisit once visibility follows access.

Indexing news anonymously is safe because the feed has no audience scoping: every signed-in staff member sees the same feed. There are no internal-only posts and no per-user targeting, so there's nothing to leak.

## 3. Placement — a centred bar, matched to the feed

The bar becomes always-visible in the global header, **centred over the content area, the same width as the `/intranet` feed column (590px)**. The "MCR Pathways" wordmark caps the sidebar zone on the left; the notification bell and avatar stay exactly where they are in the far-right corner; the bar sits centred between them with a clear gap before the bell.

Measured facts behind this (live `/intranet`, 1530px window): the sidebar is `w-64` (256px, collapsible to 64px), the feed is a 590px column centred in the content area (`CENTRE_COLUMN_WIDTHS.intranet` in `src/lib/layout.ts`), and search/bell/avatar are a tight cluster at the far right. A centred bar is the only placement that's moored to the feed, clear of the sidebar, and doesn't disturb that cluster.

- **Width source of truth:** reuse `CENTRE_COLUMN_WIDTHS.intranet` for the bar so it stays matched if the feed width ever changes. `--centre-column` is currently set on `<main>` only; the header sits outside `<main>`, so the header imports the constant directly (or we lift the variable to a shared scope).
- **Honest limit:** the bar is global header chrome. It literally matches the 590px feed only on `/intranet` and `/intranet/post/*` (the routes with a centre-column). On wider routes (HR tables, Learning, Resources) it's a consistent centred ~590px search bar over fuller content — not feed-matched, just consistent. That's acceptable; search prominence matters most on the home feed, which is where the match holds.
- **Rejected placements:** left-after-logo (its left edge lands on the sidebar/content seam — the straddle the user flagged, and no mature product does it); right-of-centre (GitHub's actual choice — kept as the documented fallback if prominence is ever deprioritised); top-of-sidebar (Notion-style — a topology change that drops the wide bar).

### Placement risks to settle at build time

The feed is centred inside a `container max-w-7xl mx-auto` wrapper, which itself sits after a collapsible sidebar. So pixel-exact tracking of the feed's box across every sidebar state and viewport is non-trivial. The target is simple: centre the bar in the header's content region (right of a fixed logo zone roughly the sidebar's width), at the centre-column width. Accept minor horizontal drift when the sidebar collapses — the header doesn't reflow with it. Don't pixel-chase. This needs a visual check at localhost across both sidebar states (per the visual-check rule — it's a required step, not a checkbox).

## 4. Results surface — an inline anchored dropdown

Retire the modal Dialog. The existing search is already a `cmdk` command list; the Dialog is only its container. Render that same `cmdk` list anchored directly under the bar, which keeps the keyboard navigation and combobox a11y we already have — we are not rebuilding it by hand.

- The panel drops over the feed, the same width as the bar, with no page dimming (this is the difference from the modal, which dims).
- ⌘K focuses the bar instead of opening a separate window. One surface to maintain.
- A scope toggle (All / Resources / Courses / News) sits as tabs at the top of the panel.

## 5. Behaviour (locked)

### Kept exactly as today (the typing experience the user signed off)
- 200ms debounce, two-character minimum, parallel multi-index query (`Promise.allSettled` — one index erroring doesn't blank the others), top-5-per-type grouped results, matched-term highlighting.
- Resting panel (no query): Recently viewed, then Recent searches (localStorage, already built).
- Keyboard: ↑/↓ moves the highlight, Enter opens, Esc closes; focus stays in the input (combobox via `aria-activedescendant`, handled by `cmdk`).
- Selecting navigates and saves the query to Recent searches, then clears the bar and closes the panel. Resources open at their section (`#sectionSlug`, full load so the page scrolls to the anchor); courses open their page; news posts open at `/intranet/post/[id]`.
- Dropdown-only, no full results page. Current ranking for resources and courses left alone.

### New or changed (the build)
- The bar is always-visible and centred (section 3); the modal is retired for the inline dropdown; ⌘K focuses the bar.
- **Scope tabs** (All / Resources / Courses / News) filter the already-fetched results client-side (instant, no extra Algolia call), reset to All on each open.
- **News** as a third result type (section 6).
- **Dismissal keeps your text:** Esc, click-outside and blur all close the panel but leave the query in the bar so you can reopen and refine; only selecting a result clears it.
- Placeholder names the scope; the ⌘K hint shows at rest and hides on focus/type.

### Empty and error
- No text, no history → a one-line "Search resources, courses and news" prompt.
- Text, no matches → "No results for 'x'".
- An index failing degrades quietly — the working types still show.

## 6. The news index

A new Algolia index, `news_posts` (constant `NEWS_INDEX` in `src/lib/algolia.ts`), built the way courses are.

- **Record (`AlgoliaPostRecord`):** `objectID` = post id, `postId`, `excerpt` (a short lead derived from the content, since posts have no title field), `content` (plaintext flattened from `content_json`, truncated via the existing `truncateForAlgolia`), `authorName` (the author's display name), `createdAt` (ISO, for the "· 3 days ago" line), `createdAtTimestamp` (number, for ranking), `_type: 'news'`.
- **Indexing:** an `indexPostIfNews(supabase, postId)` helper gating on `post_type = 'news' AND is_weekly_roundup = false`, mirroring `indexCourseIfPublished`. Wire it into `createPost` (`actions.ts:721`, after insert), `editPost` (`actions.ts:922`, reindex when content changes), and `deletePost` (`actions.ts:1119`, `removePostFromIndex`). `createKudosPost` in `kudos-actions.ts` is **not** wired — kudos stay out.
- **Content flattening:** extract plaintext from the Tiptap `content_json`; fall back to the stored `content` string. (Exact extractor settled at build — see open items.)
- **Ranking (the one new ranking decision):** in `scripts/algolia-settings.mjs`, add `news_posts` with `searchableAttributes: ["excerpt", "content"]`, snippet/highlight on `content`, and **`customRanking: ["desc(createdAtTimestamp)"]`** so newer posts win ties. Resources and courses settings are untouched (neither has a custom ranking today; the user is content with both).
- **Backfill:** `scripts/index-posts.ts`, mirroring `scripts/index-courses.mjs`, run via `tsx` to populate existing news posts once.
- **Privacy:** only author display name, content and timestamps go to Algolia — no user IDs, no audience data (there is none). Consistent with the existing "no PII to Algolia" rule.

## 7. Result rows

- **Resources** — light-blue tile (FileText), title + section breadcrumb, category, snippet. Unchanged.
- **Courses** — green tile (GraduationCap), title, category · duration, Required badge. Plain for v1: no per-user "Completed/Overdue" annotation (deferred — it's additive and would add a per-user query to every search).
- **News** — orange tile (Newspaper), title/excerpt, "Author · relative date", matched-term highlight.

## 8. Copy

- Placeholder: **"Search resources, courses and news"** (British, no Oxford comma; replaces the live "…courses, and insights" — "insights" was the retired Tool Shed).
- ⌘K hint in the bar, "Ctrl K" off-Mac, platform-detected with `suppressHydrationWarning`.

## 9. Accessibility

Combobox semantics inherited from `cmdk` (input `aria-expanded`/`aria-controls`, listbox + options, `aria-activedescendant`). No focus trap — it isn't a modal, so Tab moves on and closes the panel. The panel has a max height and scrolls internally so it never pushes the page. `jsx-a11y` is enforced at error; clear violations or add a justified disable.

## 10. Build — two PRs

1. **News index (backend).** Record shape, `indexPostIfNews` + `removePostFromIndex`, wiring into the three post actions, `news_posts` settings, the backfill script. Invisible until search uses it. Ship and run the backfill.
2. **The bar and dropdown (frontend).** Header restructure for the centred bar, retire the modal for the anchored `cmdk` dropdown, scope tabs, the news group + orange tile, placeholder, a11y. Depends on PR1, so the bar ships with news already searchable.

## 11. Out of scope / deferred

People search (visibility-by-access first); a full results page (dropdown-only); per-user course annotations; a mobile/responsive bar (desktop-first for now); kudos and round-ups in search; any change to resources/courses ranking.

## 12. Open — verify or settle at build

- Content-flattening for `content_json` (a Tiptap text extractor versus the stored `content` string).
- Index name — `news_posts` proposed.
- The header centring implementation across sidebar states (target: simple centred-at-centre-column; settle visually at localhost).

## 13. Testing

- Unit-test `indexPostIfNews` gating (news indexed; kudos, round-ups, and the wrong `post_type` skipped), mirroring the course-index tests.
- Search component: extend the existing patterns for the news group and the scope tabs.
- Visual check at localhost — the centred bar and the dropdown across both sidebar states. Required, per the visual-check rule.
