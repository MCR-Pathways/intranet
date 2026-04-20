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

**Drive watches are tracked via a column triple on `resource_articles`.** `google_watch_channel_id` (unique per renewal), `google_watch_resource_id` (Google's handle for the watched resource), `google_watch_expires_at` (7-day hard expiry). Any feature touching watches needs to read/write all three — reconstructing the channel id from `resource-${article.id}` only works for rows written before migration 00081.

**Channel ids must be unique per watch.** Google rejects duplicate active channels. `linkGoogleDoc` and the renewal cron both use `resource-${article.id}-${Date.now()}`. Stopping the old channel uses the stored `google_watch_channel_id` with a `resource-${article.id}` fallback for pre-00081 rows.

**Drive watch renewal runs as a Supabase pg_cron job, not a Vercel cron.** Schedule lives in migration `00083_renew_drive_watches_cron.sql`; route handler at `src/app/api/cron/renew-drive-watches/route.ts`. Daily at 03:00 UTC, renews any linked doc whose watch expires in the next 36h. Each run writes to the `cron_runs` audit table.

**Rotating CRON_SECRET is a two-step operation.** (1) Update the Vercel env var. (2) Update the Supabase Vault secret: `SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name = 'cron_secret'), 'NEW_VALUE');`. Both must match or Supabase's pg_net call will 401.

## Category Hierarchy

**Use cascading selects for hierarchical data, not flat dropdowns.** Show progressive `<Select>` components: mandatory top level, then optional child levels. Derive child lists via `useMemo`. Reset child selections when parent changes. Use `resolveParentChain()` to pre-select all levels from a `defaultId`.

**Allow articles at any category hierarchy level.** The original leaf-only constraint was removed. `fetchCategoriesForMove()` returns all categories. The sidebar tree, breadcrumbs, and article counts all work at any level.

**Reserve route-colliding slugs in auto-generated slugs.** Add reserved words like "new" and "edit" to a `RESERVED_SLUGS` set in the slug generation function.

**Hide empty categories from end users.** Categories with 0 published articles should not appear in the category grid or grouped index. Show them only to editors.

## Component Pages

**Component pages require static imports + migration seed.** Next.js code-splitting requires hardcoded dynamic imports. Adding a new component page: (1) add to `COMPONENT_REGISTRY` in `src/lib/resource-components.ts`, (2) add static dynamic import in `component-article-view.tsx`, (3) add DB migration to seed the `resource_articles` row with `content_type = 'component'`.

## UX Patterns

**Supabase `.select()` with joined tables returns arrays, not objects.** When using `resource_categories!category_id(name, slug)` in a select, cast via `unknown` first.

**For self-referential joins, use `alias:fk_column_name(...)` — not `alias:table!fk_column_name(...)`.** The `!fk_column_name` hint on a self-referential FK resolves as a REVERSE join (returning rows that reference this one — i.e. children), not the forward direction you want (this row's parent). Correct syntax for the parent lookup: `parent:parent_id(name, slug)`. The FK-constraint-name variant (`!resource_categories_parent_id_fkey`) fails with "no relationship in schema cache" — PostgREST doesn't expose it under that name. Verified live 2026-04-15 (PR #240). The column-as-alias form returns a single object or null, not an array — the `Array.isArray` defensive unwrap stays because PostgREST-JS sometimes types 1:1 joins as `T[]`.

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

**Use `useSelected` for void element (image, file, embed) toolbar visibility, not `group-focus-within`.** Void elements have `contentEditable={false}` and no focusable children, so `focus-within` never triggers on click. `useSelected` (from `platejs/react`) returns true when the Slate selection includes the node. Use it alone without `useFocused` — clicking a toolbar button steals focus, making `useFocused` go false before the click registers.

**Use `editor.api.findPath(element)` for node mutations, not `props.path`.** Paths can go stale between render and user action (React batching, concurrent features). `findPath` returns `Path | undefined` — always guard against undefined before calling `setNodes` or `removeNodes`.

**Use `onMouseDown` + `preventDefault()` on all in-editor toolbar buttons.** `onClick` steals focus from the editor and can cause selection/path issues. Applies to void element toolbars (image, file, embed), floating toolbars (table, columns), and inline toolbars (callout variant switcher).

**Paste-uploaded images get dimensions via URL-keyed Map + `onValueChange`.** The `uploadImage` callback can only return a URL string (Plate v52 API). Dimensions are read with `createImageBitmap` before upload, stored in a `Map<url, dims>` after upload completes, then applied in `onValueChange` by matching on `type === "img"` + URL key. The Map prevents concurrent pastes from overwriting each other.

**`getDriveContentStream` throws on non-404 errors.** Returns `null` on 404 (file deleted from Drive), throws on 500/permission/network errors. Callers must handle thrown errors — the proxy route's try/catch returns 500.

**Proxy metadata comes from the DB, not from Drive.** `resource_media` stores `mime_type`, `file_size`, `original_name` at upload time. The proxy selects these in the whitelist query and uses them for response headers. `getDriveContentStream` fetches content only (one Drive API call, not two).

## Visual Parity (WS5a)

**Use `prepareNativeArticle` for rendering, `createNativeStaticEditor` for Algolia.** `prepareNativeArticle` adds heading IDs and returns `{ editor, headings }` for TOC. `createNativeStaticEditor` stays clean for Algolia HTML — no IDs, no anchor SVGs.

**`SlateElement` without `as` wraps content in a `<div>`.** For headings in the Algolia path, use `<SlateElement {...props} as={Tag} />` so the heading IS the top-level element. Without `as`, you get `<div class="slate-h2"><h2>...</h2></div>` which breaks `parseHtmlIntoSections` (it checks `body.children` for heading tags).

**Strip the `<div class="slate-editor">` wrapper from `serializeHtml` output.** `serialiseContentToHtml` trims and strips the outer wrapper so headings are top-level for Algolia section extraction.

**Google Docs image alignment: apply classes to `<img>`, not `text-center` on `<p>`.** Tailwind Typography sets `img { display: block }`. CSS `text-align: center` only affects inline content. Use `mx-auto`/`ml-auto` directly on the `<img>` element. Preserve through Phase 4 with a tag-name check.

**Jotai must be deduplicated across Plate packages.** `@platejs/core` and `@platejs/toggle` can pull different jotai versions. Two instances = two atom stores = `AggregateError` on every editor onChange. Fix with `"overrides": { "jotai": "2.19.1" }` in package.json.

**Radix Dialog `onOpenChange` is not called on programmatic open.** When `open={true}` is set from outside, `onOpenChange` doesn't fire. Use `useEffect` on the `open` prop to load data, not `onOpenChange`.

**`addHeadingIds` must create new objects, not mutate.** `nestToggleChildren` only shallow-copies toggle nodes. Heading nodes are original references. Use spread (`{ ...record, id: slug }`). Track a `changed` flag in `walkAndCopy` to avoid cloning subtrees with no headings.

## Cross-Linking (WS5b)

**Cross-link map uses `Object.hasOwn`, not direct property access.** Doc IDs come from parsed HTML. A crafted href producing `"__proto__"` or `"constructor"` as a doc ID would return `Object.prototype` properties. Per CLAUDE.md rules, guard with `Object.hasOwn(crossLinkMap, docId)`.

**`APP_ORIGIN` lives in `article-constants.ts`, shared by GoogleDocArticleView and LinkStatic.** Parsed once at module level. Used for origin comparison (not `startsWith`, which has a domain prefix attack: `example.com.evil.com` starts with `example.com`).

**`extractDocId` `?id=` param restricted to `drive.google.com/open` only.** Without the pathname check, `example.com/?id=123` would return `"123"`.

**Google redirect URLs must be unwrapped before `extractDocId`.** Google Docs exports wrap links in `google.com/url?q=ACTUAL_URL`. `unwrapGoogleRedirect` extracts the `q` param. `URL.searchParams.get()` auto-decodes.

**Cross-link map filters `status = 'published'`.** Draft articles aren't cross-link targets. Without this, readers clicking a cross-link to a draft get 404.

**Use structured `logger`, not `console.error`.** Every file in the resources module uses `logger` from `@/lib/logger`. Mixing in `console.error` breaks structured logging.

## Governance (WS1)

**`canViewDrafts` is separate from `canEdit`.** Compute `canViewDrafts = isContentEditorEffective(profile)` at caller level, not `isHRAdminEffective(profile) || isContentEditorEffective(profile)`. HR admins without the content-editor flag don't see drafts on category lists or via article URLs. `canEdit` stays as the union for edit-affordance decisions. Both pages under `[...slug]/page.tsx` and `article/[slug]/page.tsx` compute both values and pass the narrower one to fetchers. Don't collapse them back — that was the bug.


**Handle Postgres `23505` on slug mutations.** `ensureUniqueArticleSlug` pre-checks, but a concurrent insert can still win the slug between check and insert. Catch `error.code === "23505"` in `createNativeArticle`, `linkGoogleDoc`, and `updateArticle` — return "A resource with this slug already exists — try a different title." Generic error copy here is user-hostile and hides a retryable condition.

**Log DB errors before returning `[]`.** The file-wide pattern `if (error || !data) return []` silently swallows Supabase errors, surfacing a broken page as "no results". Split into two checks: `if (error) { logger.error(...); return [] }` then `if (!data) return []`. `fetchDraftArticles` does this; 7 other sites in `actions.ts` + 1 in `native-actions.ts` still need cleanup — tracked tech debt.

**Drafts never enter "recently viewed" localStorage.** Gate `recordArticleView(...)` on `article.status === "published"` inside both `google-doc-article-view.tsx` and `native-article-view.tsx`. Without the gate, an editor viewing a draft stores it in localStorage; if the article then unpublishes or the user loses editor rights, the recents entry becomes stale and clicking it 404s.
