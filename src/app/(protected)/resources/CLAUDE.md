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

**Pass `forwardToReplicas: true` on `saveSynonyms` (and `setSettings`) even with no replicas today.** The `resources_articles` index has no replicas now, but a write without the flag silently won't propagate if one is ever added — a search inconsistency that surfaces much later with no error. It's a free future-proof. The jargon synonym harvest (`scripts/wp-migration/jargon-synonyms.ts`) pushes 54 two-way org-acronym synonyms (e.g. SDS ⇄ Skills Development Scotland) index-wide; re-running updates in place via stable `jargon-syn-<abbr>` objectIDs.

## Webhooks

**Always return 200 from webhook endpoints, even on error.** Google Drive retries on non-2xx responses. Log the error server-side but return 200 to prevent retry storms. See `src/app/api/drive/webhook/route.ts`.

**Encode compound webhook tokens as `{secret}:{id}`.** Google Doc IDs use only `[a-zA-Z0-9_-]`, so a colon is a safe delimiter. Split on first colon, verify secret with `timingSafeTokenCompare()`, then use the ID to look up the article.

**Drive watches are tracked via a column triple on `resource_articles`.** `google_watch_channel_id` (unique per renewal), `google_watch_resource_id` (Google's handle for the watched resource), `google_watch_expires_at` (whatever Drive returns; in practice ~24h per watch, even though Drive docs say up to 7 days). Any feature touching watches needs to read/write all three — reconstructing the channel id from `resource-${article.id}` only works for rows written before migration 00081.

**Drive sync metadata: `google_doc_modified_at` tracks source edit time.** Added in migration 00084. Populated by `syncDocumentContent` (which calls `drive.files.get` in parallel with `drive.files.export` to pick up `modifiedTime`) and persisted by every sync path. Drives two things: (1) the kebab header's drift signalling (source edited more recently than last sync → amber two-line state), and (2) the article meta line + `isStale` calculation, both of which now reflect source content edit age rather than sync-run age. A pre-migration row with NULL `google_doc_modified_at` falls back to `updated_at` so existing behaviour is preserved until next sync populates the column.

**Drive watch lifetime is ~24 hours in practice, not 7 days.** Drive's `files.watch` docs say "up to 7 days" but the observed value in our setup is ~24h per channel. The `renew-drive-watches` cron runs daily at 03:00 UTC with a 36h renewal threshold, which means every linked doc gets renewed every run. Don't optimise the query to "only expiring soon" rows — at this lifetime it's effectively everything. Verified 2026-04-20.

**Channel ids must be unique per watch.** Google rejects duplicate active channels. `linkGoogleDoc` and the renewal cron both use `resource-${article.id}-${Date.now()}`. Stopping the old channel uses the stored `google_watch_channel_id` with a `resource-${article.id}` fallback for pre-00081 rows.

**Drive watch renewal runs as a Supabase pg_cron job, not a Vercel cron.** Schedule lives in migration `00083_renew_drive_watches_cron.sql`; route handler at `src/app/api/cron/renew-drive-watches/route.ts`. Daily at 03:00 UTC, renews any linked doc whose watch expires in the next 36h. Each run writes to the `cron_runs` audit table.

**Rotating CRON_SECRET is a two-step operation.** (1) Update the Vercel env var (and redeploy to apply). (2) Update the Supabase Vault secret: `SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name = 'cron_secret'), 'NEW_VALUE');`. Both must match or Supabase's pg_net call will 401 on the nightly fire.

**`cron_runs` dashboard access was widened from HR-admin-only to content-editor.** Migration 00082 originally documented "service role only. An HR-admin SELECT policy can be added later when an admin dashboard surfaces the data." The Drive watches dashboard (PR B) opted for a single `requireContentEditor()` gate covering both the articles table and the cron runs table — simpler than bifurcating visibility within one tab, and our scale (~5 editors) makes the distinction academic. If content editors ever start being confused or alarmed by "Failed" cron badges they can't act on, tighten `getRecentDriveCronRuns` to `requireHRAdmin()` and conditionally render the cron runs section in `SettingsDriveWatches`. Reasoning captured in `memory/resources-edit-affordance-backlog.md`.

**Manual smoke-testing the cron adds a third source of truth: the local shell.** If you want to invoke the endpoint with curl to verify the deployment, the Bearer token has to match what's on Vercel (post-redeploy) and what's in Vault. All three sources produce identical 401 responses on any pair mismatch, so diagnosis means checking each independently. Template for an idempotent smoke test is kept in chat history; the verification path is: `export CRON_SECRET='...'` (64-char length check), then `curl -H "Authorization: Bearer $CRON_SECRET" ...` — with the secret exported in a separate terminal first so only `$CRON_SECRET` enters any `!` prefixed command, not the literal value.

**`pg_net.http_get` is async and fire-and-forget from the SQL side.** The response is not surfaced back to the `cron.schedule` body. Observability for scheduled work must come from the app handler itself writing to an audit table like `cron_runs`, not from pg_net. If you need to know whether a cron successfully reached its endpoint, check `cron_runs`, not `cron.job_run_details`.

**Vault secrets are retrieved via `vault.decrypted_secrets`, not `vault.secrets`.** The raw `vault.secrets` table stores ciphertext. Pattern: `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'`. The view handles decryption on read.

**Filtering on `IS NULL` in a cron query creates a first-run thundering herd.** When a new column is added and the cron predicate uses `column IS NULL OR column < X`, every pre-existing row matches on the first run and gets processed at once. Self-healing (subsequent rows are populated and skipped next time), but size `maxDuration` for the worst case — we picked `300` not `60` for `renew-drive-watches` precisely because of this.

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

**Use IntersectionObserver for TOC scroll-spy with a fallback for the gap state.** `rootMargin: "-80px 0px -80% 0px"` detects the topmost visible heading. The observer alone isn't enough: when the user scrolls slowly between sections and no heading is in the band, the observer fires nothing and the previously active heading gets stuck. Track an `intersecting: Map<slug, boolean>` across callbacks. On each callback: pick the topmost heading whose map entry is `true`; if none, walk the heading list and pick the last one whose `getBoundingClientRect().top < 80` (that's the section the user is currently in, even though its heading scrolled above the viewport). See `src/lib/use-scroll-spy.ts`.

**Pass only the listed (H2+H3) headings to `useScrollSpy`, and the ancestor marker comes for free (§4).** The rail lists H2 and H3 only (`filterRailHeadings`), and we feed that same filtered list to the hook. When the reader is deep inside an unlisted H4 section, no listed heading is in the band, so the gap-state fallback lands on the last H2/H3 above the fold, which is exactly that H4's nearest listed ancestor. No H4-to-parent mapping needed: filter before the hook, not after. The rail also defaults the marker to the first item when the hook returns `""` (reader above the first heading), so the marker is never blank.

**The active reading-rail item uses a teal marker (3px teal left bar, teal text, bolder weight) on a borderless rail, not a `bg-accent` pill.** (§4, 2026-07-02, supersedes the earlier pill rule.) The rail has no border or box: a bold "On this page" label, a 2px track line down the list, H2 + H3 only (H4+ keep their anchors but aren't listed), and scroll-spy moving a single teal marker. Why the reversal: the pill rule held while the TOC was a bordered panel, where brand colour would have competed with that second box. The rail is now borderless and the article content spreads to meet it (see the spread-layout note below), so the marker is the only chrome on the column and a teal bar reads as a clean position indicator rather than competition. Matches React.dev and MDN. See `src/components/resources/article-outline.tsx`.

**Below `lg` the rail is a collapsed "On this page" disclosure, not hidden (§4).** The old rail was `hidden lg:block`, so a user zoomed to 200% (WCAG reflow 1.4.10 narrows the effective viewport) lost the contents list entirely. Below `lg` the rail now renders as a full-width `<button aria-expanded>` above the content that expands the list inline; at `lg`+ it's the sticky side rail. The two-column container is `flex flex-col gap-6 lg:flex-row lg:gap-8` and the body drops its `flex-1` below `lg` (`min-w-0 lg:flex-1`) so it isn't stretched in the column layout.

**Article content spreads to fill the card on wide screens (§4 spread layout).** The reading column has no `max-w` — it fills from the card's left edge to the rail. Text is uncapped too (one uniform right edge; `ARTICLE_PROSE_CLASSES` dropped its `max-w-[720px]`), which is deliberate: a capped measure beside full-width grids produced a ragged "text stops midway" edge and a dead band of whitespace. The `max-w-7xl` shell still caps the whole card (~1408px), so the body maxes near 1000px on a 1920px external and is unchanged on a 1366px Chromebook. The `resource_grid` uses `auto-fill` columns so it follows the column width (4-up in the spread, 3-up when the rail shares a Chromebook row) rather than fixed viewport breakpoints.

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

**Toggles use a container shape (`toggle_v2`), not Plate's indent-based `BaseTogglePlugin`.** JSON is `{ type: "toggle_v2", children: [{ type: "toggle_v2_summary", ... }, ...body blocks] }` — body content is structurally nested rather than inferred from sibling indent. The walker emits this shape directly via `groupToggleBodies` in `html-to-plate.ts`; existing articles were converted via `scripts/convert-stored-toggles.ts`. The editor element splits children into summary + body and uses CSS grid-template-rows (`0fr` → `1fr`) to animate the open/close transition; void blocks (images, files, embeds) inside the body hide cleanly when the toggle closes because they're structurally inside the body wrapper that CSS hides as a unit — no `IndentPlugin.targetPlugins` workaround needed.

**Toggle structure is enforced via `overrideEditor` on `BaseToggleV2Plugin`.** Two transforms backstop the contract: `normalizeNode` ensures the first child of any `toggle_v2` is a `toggle_v2_summary` (prepends an empty one if a delete leaves the slot empty); `insertBreak` on a summary moves the cursor into `body[0]` instead of splitting the summary into two title nodes (matches Notion / Google Docs behaviour). The summary's chevron button uses the local pattern `hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none` — background-change focus state, the global `*:focus-visible` outline is suppressed to avoid doubling up (per `docs/button-system.md` §Focus rings).

**Editor element visuals match the static read view's hierarchy.** Whenever a block type's static component conveys typography or layout that carries meaning (bold title, padding rhythm, separator, etc.), the editor element renders the same way so authors see what readers see. Worked example: the toggle title uses `font-semibold text-foreground` in BOTH `ToggleSummaryStatic` (read view) and `ToggleV2SummaryElement` (editor) — early on the editor used `font-medium` and the title rendered lighter than the published article, hiding the structural cue. Pattern: when adding a new block type or restyling an existing one, scan both the static component and the editor element, align typography/colour/layout that matters, leave only the interactive affordances (chevron click target, focus ring) editor-specific.

**`ListContinuationPlugin` carries list state across void blocks for Google Docs–style Enter handling.** Plate's indent-list model treats a list as a run of consecutive same-style paragraphs; a void block (img/file/media_embed) breaks the chain (`getSiblingList` stops on lower indent or missing listStyleType). Without intervention, pressing Enter on an image gives a plain paragraph and `<ol>` numbering resets to 1 on the next item. The plugin overrides `insertBreak`: when the cursor is in a void block, it walks back through preceding voids to find the nearest list paragraph, then inserts a continuation paragraph that inherits `indent` + `listStyleType` from that ancestor and sets `listRestart` to `prev.listStart + 1`. `listRestart` is used (not `listStart`) because `normalizeListStart` would otherwise unset `listStart` — the chain still breaks at the void from Plate's POV, so it computes the expected start as 1 and strips any explicit value. `listRestart` is sticky and is honoured by `getListExpectedListStart`. Known gap: deleting the void block later does NOT auto-clear `listRestart` from the post-void item, so the numbering may drift if the gap closes. Surfaced 2026-05-21 from the new-staff-info edit-view review.

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

**`addHeadingIds` must create new objects, not mutate.** Heading nodes in the stored JSON are original references that callers may still hold. Use spread (`{ ...record, id: slug }`) when adding an `id`. Track a `changed` flag in `walkAndCopy` to avoid cloning subtrees with no headings.

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


## Buttons

Button rules live in `docs/button-system.md` (single source of truth for variants, sizes, label casing, a11y, helpers, per-context patterns). Never put `h-X w-X` on a Button `className` — use the `size` prop; an ESLint rule enforces this.

## WP migration: context-clear protocol

The general "multi-step work survives a context clear" rule lives in `memory/MEMORY.md`. WP-specific application:

**Phases per bit:** audit → walker run → editor pass → PR → ship. Safe to clear at any of those four boundaries; never mid-phase.

**Audit phase.** `memory/wp-migration-design-audit.md` is the canonical store. Write incrementally as each section completes — don't batch the whole row to the end:
- OLD URL + NEW URL
- WHO + WHEN + GOAL
- SUCCESS
- OLD shape — run BOTH lenses: DOM inspection (via `read_page` / `find`) AND visual screenshot inspection covering top + mid + bottom of the page (Elementor column layouts and editor intent only surface visually; DOM alone hides them — see `memory/feedback_audit_visual_and_intentionality.md`)
- NEW shape (via fresh `find()` / `read_page` AND screenshots in the same session — see the existing audit's note on verifying every structural claim against fresh data)
- IDEAL shape
- DECISION (SHIP AS-IS / FIX BEFORE SHIP / BLOCKED)
- BUILD COST

If clearing mid-audit, write a thin `memory/wp-migration-bit-N-handover.md` first capturing what's been investigated so far and what's pending. Delete it on pickup once the next session has briefed itself.

**Walker phase** ends when the article re-publishes and the change is verified in the UI / DOM — not just by running the conversion script. Re-publication is observable; "script ran" is not.

**Standing rule — toggle summaries flatten to real H-tags, never bold paragraphs.** Every former WP toggle summary in a migrated article MUST emit as a real `<h2>` / `<h3>` / `<h4>` element. Level is determined by toggle nesting depth (top-level → h2 if the page body starts at h2, else h3; nested → demote by one). Never `<p>` with bold styling. Never `<strong>` standalone. Never a `<div>` with a typography class. The H-tag is load-bearing for (a) Algolia section indexing — `parseHtmlIntoSections` splits on body.children H1–H4 only, so a bold-but-not-heading collapses the whole article to one section, (b) screen-reader landmark navigation, (c) the on-page TOC built by `prepareNativeArticle`, and (d) prose typography sizes (H2 22px/600, H3 19.8px/600, H4 15.4px/600). Bold rendering is a free consequence of using the tag. Canonical implementation: `src/lib/wp-migration/flatten-toggle-v2.ts` — every WP migration runs through it during the walker phase. Per-page exceptions (a toggle that genuinely belongs as a collapsible) go in `flattenToggleV2`'s `options.exclude` AND get documented in the audit row. Backstop: the regression tests in `src/lib/plate-static-plugins.test.tsx` lock the "one heading → one section" contract. See `memory/feedback_wp_toggles_flatten_to_real_h_tags.md`.

**Editor phase** — the editorial pass on an article. Runs the five-step workflow below for every page that needs editor work (whether it's a freshly migrated bit, a reopen of a previously-shipped article, or any other native-article editorial change). Phase ends when MARK DONE lands in the audit row; not before.

**Five-step editorial-pass workflow** (per page, sequential — never start the next page until the current one finishes):

1. **PLAN** — commit a checklist of specific edits to the page's audit row in `memory/wp-migration-design-audit.md`. Each item is a concrete change ("convert toggle_v2 #N (title) to H3 with content inline", "split Employment Policies toggle into H3 + 12 H4 children", etc.). The plan is the contract for what APPLY produces and what VERIFY checks against.
2. **APPLY** — open `/resources/article/{slug}/edit` and make the edits. Plate auto-saves every 5s; reindex fires on 30s idle or explicit publish. For large pages (10+ edits), batch the changes (e.g., 5 + 5 + 5 + 2 toggle conversions) with auto-save between, rather than doing all in one undo-stack burst.
3. **VERIFY — three lenses, all must pass, all artefacts saved to disk:**
   - **Structure (DOM):** run `find()` on the rendered read view (`/resources/article/{slug}`, not `/edit`) querying all H2/H3/H4 headings. Confirm count + names match the PLAN. Commit the heading list to the audit row.
   - **Visual:** screenshot top + mid + bottom of the rendered read view with `save_to_disk: true`. Reference paths in the audit row. Confirm visual hierarchy reads right, no broken images, no orphaned content, no leftover toggle wrappers.
   - **Search (the actual UX promise):** pick 2–3 representative noun queries from the PLAN, run Cmd+K, confirm each deep-links to the new heading anchor (not the page top). Screenshot the Cmd+K result + the landed-page anchor. Commit the queries + results to the audit row. If search lands on the page top, the editorial pass failed regardless of how good the DOM looks.
4. **SIGN-OFF** — post the three verification artefacts (DOM heading list, screenshot paths, search test results) to Colin in chat. Wait for explicit "matches what we wanted" before touching the next page. No silent progression.
5. **MARK DONE** — update the audit row to "IMPLEMENTED + VERIFIED {date}" with the search-query test results recorded. Remove the page from the "Editorial passes in progress" tracker. Next page starts at step 1.

**Failure modes:** any verify step failing → back to APPLY. Sign-off catching something missed → back to APPLY. Never "we'll fix it later."

**Context-clear safety within an editorial pass:**
- Safe between any of the five steps. The PLAN lives in the audit row; the edits live in the DB via Plate auto-save; the verify artefacts live on disk; the SIGN-OFF lives in chat history.
- Unsafe mid-APPLY (some edits saved, others in undo stack only) → if a clear is imminent, save the article first (Plate auto-saves but a manual save guarantees), then write a thin `memory/editorial-pass-{slug}-handover.md` capturing "I'm N of M edits done, here's the plan reference, here's what's still pending." Delete on pickup.
- Unsafe mid-VERIFY (some artefacts collected, others missing) → write a handover noting which lenses have run and which haven't.

**PR phase** ends at merge. Don't clear context with an open PR mid-Gemini-review loop unless the handover captures every comment thread still owed a reply (per the "always reply to every Gemini comment" rule).
