# Resources Module

Google Docs-based knowledge base with Algolia search, category hierarchy, and component pages.

## Google Docs Integration

**Use `linkedom` instead of `jsdom` for server-side HTML parsing.** `jsdom` v28 is ESM-only and fails with `ERR_REQUIRE_ESM` on Vercel serverless. `linkedom` is lightweight and ESM-native. Import: `import { parseHTML } from "linkedom"`. Keep `jsdom` in devDependencies for Vitest only.

**Google Docs must be shared with the service account for linking.** Service account: `mcr-pathways@appspot.gserviceaccount.com`. Share as Viewer before linking, or place docs in a registered Drive folder.

**Preserve semantic formatting from Google Docs inline styles before stripping.** Google Docs uses `<span style="font-weight:700">` not `<strong>`. The sanitiser must convert bold spans to `<strong>`, italic to `<em>`, first-row `<td>` to `<th>`, and extract column widths as responsive percentages — all BEFORE stripping inline styles. See `sanitiseGoogleDocsHtml()` in `src/lib/google-drive.ts`.

**Strip ALL inline styles, classes, and data-* attributes from Google Docs HTML.** Let Tailwind `prose` classes handle styling. Insert a space before block elements before calling `textContent` to prevent word merging in plaintext extraction.

**Use `html-react-parser` instead of `dangerouslySetInnerHTML` for Google Doc content.** Enables heading IDs for deep linking + TOC, custom rendering, and better type safety. Use `createElement()` in the `replace` callback (not JSX with dynamic tag names).

## Algolia Search

**Use Algolia for search, not PostgreSQL FTS.** App ID: `CFRPCC52U5`. Use `react-instantsearch` + `react-instantsearch-nextjs` for client-side search UI. Index at section level (hierarchy_lvl0 → category, lvl1 → article title, lvl2 → heading). Indexing happens server-side in `drive-actions.ts`.

**Delete external records (Algolia, webhooks) BEFORE hard-deleting DB records.** When unlinking a Google Doc: (1) stop watch channel, (2) remove from Algolia, (3) hard-delete article. Wrap steps 1-2 in try-catch so step 3 always runs.

## Webhooks

**Always return 200 from webhook endpoints, even on error.** Google Drive retries on non-2xx responses. Log the error server-side but return 200 to prevent retry storms. See `src/app/api/drive/webhook/route.ts`.

**Encode compound webhook tokens as `{secret}:{id}`.** Google Doc IDs use only `[a-zA-Z0-9_-]`, so a colon is a safe delimiter. Split on first colon, verify secret with `timingSafeTokenCompare()`, then use the ID to look up the article.

## Category Hierarchy

**Use cascading selects for hierarchical data, not flat dropdowns.** Show progressive `<Select>` components: mandatory top level, then optional child levels. Derive child lists via `useMemo`. Reset child selections when parent changes. Use `resolveParentChain()` to pre-select all levels from a `defaultId`.

**Allow articles at any category hierarchy level.** The original leaf-only constraint was removed. `fetchCategoriesForMove()` returns all categories. The sidebar tree, breadcrumbs, and article counts all work at any level.

**Reserve route-colliding slugs in auto-generated slugs.** Add reserved words like "new" and "edit" to a `RESERVED_SLUGS` set in the slug generation function.

**Hide empty categories from end users.** Categories with 0 published articles should not appear in the category grid or grouped index. Show them only to editors.

## Component Pages

**Component pages require static imports + migration seed.** Next.js code-splitting requires hardcoded dynamic imports. Adding a new component page: (1) add to `COMPONENT_REGISTRY` in `src/lib/resource-components.ts`, (2) add static dynamic import in `component-article-view.tsx`, (3) add DB migration to seed the `resource_articles` row with `content_type = 'component'`.

## UX Patterns

**Supabase `.select()` with joined tables returns arrays, not objects.** When using `resource_categories!category_id(name, slug)` in a select, cast via `unknown` first.

**Don't duplicate navigation between sidebar and page body.** For lookup-oriented knowledge bases (~80 staff), the page-body pattern with breadcrumbs + search is sufficient.

**Use grouped index sections on category pages, not subcategory cards + flat article list.** Show subcategories as expandable sections with their articles inline (GitBook/Document360 pattern).

**Use "More in [folder]" footer on article pages instead of a sidebar tree.** Lists other articles in the same folder, with the current article highlighted.

**Use IntersectionObserver for TOC scroll-spy.** `rootMargin: "-80px 0px -80% 0px"` to detect the topmost visible heading. Highlight in TOC with `text-primary font-medium`.

**Remove monolithic card wrappers — let each page manage its own surfaces.** Each page decides its own card surfaces on the grey `bg-background`.

**Add `shadow-sm` to cards on grey backgrounds.** Default `border-border` on `bg-background` is near-invisible. Use `hover:shadow-md` for interactive uplift.

## Native Editor (Plate)

Two content paths coexist. Google Docs for living documents (policies, procedures). Native Plate editor for static reference content (hub pages, training materials). Articles pick a path at creation and can't switch.

**Native articles use `content_type = 'native'` with `content_json` JSONB.** The `content_json` column already existed from migration 00038. Migration 00076 added `'native'` to the CHECK constraint, plus `last_published_at`, `editing_by`, `editing_at`.

**Use PlateStatic for read-only rendering.** Import from `platejs/static`, use `Base*` plugins (not the `/react` variants). Zero client JS for readers. Custom static components must be registered or blocks render as plain `<div>`.

**Auto-save: 5-second debounce to DB, Algolia reindexed separately.** Two server actions: `saveNativeArticle` (every 5s, DB only) and `reindexNativeArticle` (30s idle or on explicit publish/unpublish). Prevents burning through Algolia quota.

**Google Docs must be "anyone in MCR Pathways" before linking.** The service account impersonates `intranet-service-account@mcrpathways.org`. That user needs read access to the doc. A sharing hint is shown in the Link Google Doc dialog.

**Native actions live in `native-actions.ts`, not `actions.ts`.** The main actions file is 1,243 lines. Split per CLAUDE.md convention at ~800 lines.

**`PlateElement` with `as="a"` causes type conflicts.** Wrap children in a plain `<a>` inside `PlateElement` instead of passing `as="a"` + `href` props directly.

**Plate packages were rebranded in v49.** `@platejs/common`, `@platejs/heading`, `@platejs/horizontal-rule` don't exist. Use `platejs` (meta package) + `@platejs/basic-nodes` (bundles headings, HR, blockquote, and all marks).
