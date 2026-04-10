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

**Static components live in `plate-static-plugins.tsx`, editor elements in `plate-elements.tsx`.** Both are shared modules extracted in WS3 to avoid duplication. `plate-static-view.tsx` and `plate-editor.tsx` are thin wrappers.

**Use standalone Plate transform functions for table operations.** `insertTableRow(editor)`, `deleteColumn(editor)` etc. from `@platejs/table` — not `editor.tf.insert.tableRow()` which requires plugin-specific type extensions that `useEditorRef()` doesn't provide.

**Show block toolbars on focus-within only, not hover.** Hover-visible toolbars can target the wrong block when the cursor is elsewhere. Use `group-focus-within/name:opacity-100` without `group-hover`.

**Use confirmation dialogs for destructive block actions.** Delete table, remove columns — both use `AlertDialog` before executing. Users can undo with Ctrl+Z but the dialog prevents accidental loss.

**Callout static rendering uses Tailwind classes, not inline hex styles.** Inline styles don't respond to dark mode. Use the same `bg-blue-50 dark:bg-blue-950/30` pattern as the editor for visual parity.

**Static table must include `<colgroup>` from `element.colSizes`.** Without it, column widths adjusted in the editor are lost in the read view. `globals.css` has `table-layout: fixed` which respects `<col>` widths.

**TogglePlugin uses indent-based model, not container model.** Toggle children are sibling blocks with higher `indent`, not nested children. `IndentPlugin` must be registered BEFORE `TogglePlugin`. Configure `inject.targetPlugins` to exclude list types to avoid conflict with `ListPlugin`.

**`nestToggleChildren` preprocessor converts flat indent model to nested for static rendering.** Creates a `toggle_summary` virtual node to separate heading from body content inside `<details>/<summary>`. Uses `BaseToggleSummaryPlugin` (with `node.isElement: true`) so `PlateStatic` applies the component mapping. Decrements indent (not strips) to preserve multi-level hierarchy.

**Column `flex-1` conflicts with explicit width percentages.** `flex-basis: 0%` from Tailwind's `flex-1` overrides `width: 66%` in flex layout. Apply `flex-1` only when no width is set: `cn("min-w-0 ...", !width && "flex-1")`.

**Column presets use node ID lookup, not `props.path`.** Paths can become stale between renders. `editor.api.node({ match: { id } })` finds the current path reliably.

**`serializeHtml` is async (returns `Promise<string>`).** Must `await` it. The function is in `platejs/static` (re-exported from `@platejs/core/static`).

**Empty content returns `""` from `serialiseContentToHtml`, not `null`.** `null` means serialisation error (skip update). Empty string means content was cleared (clear `synced_html` + remove from Algolia to prevent stale data).

## Media (WS4)

**Media files go to Google Drive, served via `/api/drive-file/[fileId]` proxy.** The proxy streams from Drive API (Node.js Readable -> Web ReadableStream). Auth check + resource_media whitelist check before fetching. `Cache-Control: private, max-age=86400` on 200 only; errors get `no-store` (prevents caching broken images during Drive outages).

**`resource_media` table whitelists uploaded file IDs.** Without it, the proxy is an open relay for any file the service account can see (domain-wide delegation). RLS INSERT policy matches `requireContentEditor()` checks. Proxy uses service client for the whitelist query (needs all rows), session client for auth.

**Validate magic bytes, not just `file.type`.** Browser-reported MIME types come from the file extension, not content. A renamed HTML file passes client-side validation. Server checks first bytes: PNG `\x89PNG`, JPEG `\xFF\xD8\xFF`, GIF `GIF8`, WebP `RIFF...WEBP`, PDF `%PDF-`.

**`maxDuration` cannot be exported from "use server" files.** Sync exports in server action files cause Vercel build failures. `maxDuration` belongs in API route files only. Server actions inherit the page's function timeout.

**Sanitise filenames in Content-Disposition headers.** Strip `"`, `\`, `\n`, `\r`, null bytes. Prevents header injection.

**Video embeds store `url` (embed URL) + `sourceUrl` (original URL).** `url` is what Plate reads for rendering (the embed format). `sourceUrl` is for the edit dialog so users see the recognisable YouTube/Vimeo URL they pasted, not the embed format.

**All video embed iframes use `sandbox="allow-scripts allow-same-origin allow-presentation"`.** Matches the learning module's VideoPlayer. Prevents navigation and form submission from embedded content.

**Vercel Hobby streams files over 4.5 MB without issues.** Spike-tested with 1/5/10 MB files. The 4.5 MB serverless payload limit applies to non-streaming responses only. Streaming via Web ReadableStream bypasses it.
