#!/usr/bin/env tsx
/**
 * Migrate one WordPress page into the new intranet as a Resources native article.
 *
 * Usage (run from project root):
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/migrate-wp-page.ts \
 *     --slug=mentor-training \
 *     --xml=<absolute-path-to-wp-export.xml> \
 *     [--drive-folder=1u0nCOG8fvuw81lRrKXDwbHtuvaT2O-q5] \
 *     [--category-slug=mentor-training] \
 *     [--parent-category-slug=programme-resources] \
 *     [--author-email=abdulmuiz.adaranijo@mcrpathways.org] \
 *     [--dry-run] \
 *     [--allow-overwrite-published]
 *
 * Exits non-zero on the first 404 / >25MB asset / Drive failure / DB error.
 * Re-runs are idempotent: same slug ⇒ existing article is updated; existing
 * resource_media rows (matched by original_name) are reused.
 */
import { parseHTML } from "linkedom";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadWpExport, findPageBySlug } from "./wp-migration/xml-parse";
import { uploadAssets, MigrationHaltError } from "./wp-migration/asset-upload";
import {
  htmlToPlate,
  type AssetInfo,
} from "@/lib/wp-migration/html-to-plate";
import { publishAndIndex } from "@/lib/resource-publish";
import type { Database } from "@/types/database.types";

/**
 * Decode HTML entities (numeric + named) by round-tripping through linkedom's
 * DOM parser. Covers the full HTML5 entity set including &nbsp;, &ndash;,
 * &rsquo;, &hellip;, and numeric forms like &#8217; — anything a browser
 * would decode. Reuses the linkedom dep we already pay for in the walker
 * instead of bringing in the `he` library.
 */
function decodeHtmlEntities(s: string): string {
  if (!s) return "";
  const { document } = parseHTML(`<!DOCTYPE html><html><body></body></html>`);
  document.body.innerHTML = s;
  return document.body.textContent ?? s;
}

const WP_UPLOADS_PREFIX = "https://i.mcrpathways.org/wp-content/uploads/";
const DEFAULT_DRIVE_FOLDER = "1u0nCOG8fvuw81lRrKXDwbHtuvaT2O-q5"; // MCR Intranet Attachments
const DEFAULT_PARENT_CATEGORY = "programme-resources";
const DEFAULT_AUTHOR_EMAIL = "abdulmuiz.adaranijo@mcrpathways.org";

interface Args {
  slug: string;
  xml: string;
  driveFolder: string;
  categorySlug: string;
  parentCategorySlug: string;
  authorEmail: string;
  dryRun: boolean;
  allowOverwritePublished: boolean;
}

function parseArgs(argv: string[]): Args {
  const map: Record<string, string> = {};
  const flags = new Set<string>();
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) {
      map[m[1]] = m[2];
      continue;
    }
    const f = arg.match(/^--([a-z][a-z0-9-]*)$/);
    if (f) flags.add(f[1]);
  }
  if (!map.slug) {
    console.error("Missing --slug=<wp-slug>");
    process.exit(2);
  }
  if (!map.xml) {
    console.error("Missing --xml=<absolute-path-to-wp-export.xml>");
    console.error("Tip: download the WP export to a known location and pass it explicitly.");
    process.exit(2);
  }
  return {
    slug: map.slug,
    xml: map.xml,
    driveFolder: map["drive-folder"] ?? DEFAULT_DRIVE_FOLDER,
    categorySlug: map["category-slug"] ?? map.slug, // default: category slug == page slug
    parentCategorySlug: map["parent-category-slug"] ?? DEFAULT_PARENT_CATEGORY,
    authorEmail: map["author-email"] ?? DEFAULT_AUTHOR_EMAIL,
    dryRun: flags.has("dry-run"),
    allowOverwritePublished: flags.has("allow-overwrite-published"),
  };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    console.error("Tip:  set -a; source .env.local; set +a; npx tsx scripts/migrate-wp-page.ts ...");
    process.exit(2);
  }
  return v;
}

async function lookupCategoryId(
  supabase: SupabaseClient<Database>,
  parentSlug: string,
  slug: string,
): Promise<string> {
  const { data: parent } = await supabase
    .from("resource_categories")
    .select("id")
    .eq("slug", parentSlug)
    .is("deleted_at", null)
    .single();
  if (!parent?.id) {
    throw new Error(`Parent category not found: '${parentSlug}'`);
  }
  const { data: child } = await supabase
    .from("resource_categories")
    .select("id")
    .eq("slug", slug)
    .eq("parent_id", parent.id)
    .is("deleted_at", null)
    .single();
  if (!child?.id) {
    throw new Error(
      `Subcategory '${slug}' not found under parent '${parentSlug}' — create it via /resources admin first.`,
    );
  }
  return child.id;
}

async function lookupAuthorId(
  supabase: SupabaseClient<Database>,
  email: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (!profile?.id) {
    throw new Error(`Profile not found for email: ${email}`);
  }
  return profile.id;
}

/**
 * Fetch the slugs of every non-deleted Resources article so the walker can
 * rewrite cross-references between migrated pages — e.g. an `<a href="...
 * i.mcrpathways.org/mentor-training/">` inside pc-support becomes
 * `/resources/article/mentor-training` instead of bouncing the reader to
 * the (soon-retired) WP site.
 *
 * Returns an empty set if the query fails — better to skip rewriting than
 * to halt the whole migration over a search-quality issue.
 */
async function loadMigratedSlugs(
  supabase: SupabaseClient<Database>,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("resource_articles")
    .select("slug")
    .is("deleted_at", null);
  if (error) {
    console.warn(
      `  ⚠ Failed to fetch migrated slugs for cross-link rewriting: ${error.message}. Continuing without rewriting.`,
    );
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.slug));
}

/**
 * Resolve the target article row for this slug. Runs the slug-clash /
 * content-type / category / publish-status guards regardless of dryRun;
 * only the writes (UPDATE / INSERT) are skipped when dryRun is true.
 *
 * Returns a stub id when dry-running on a not-yet-existing slug so
 * downstream steps have something concrete to pass around — that id
 * never reaches the DB.
 */
async function upsertArticle(
  supabase: SupabaseClient<Database>,
  params: {
    slug: string;
    title: string;
    categoryId: string;
    authorId: string;
    allowOverwritePublished: boolean;
    dryRun: boolean;
  },
): Promise<{ id: string; created: boolean }> {
  const { data: existing } = await supabase
    .from("resource_articles")
    .select("id, content_type, category_id, status")
    .eq("slug", params.slug)
    .maybeSingle();

  if (existing?.id) {
    // Slug-clash safety: refuse to overwrite a non-WP-migration article. A row
    // counts as a WP migration target only if it's already content_type='native'
    // and sits under the same category id we're about to write. Anything else
    // is a real article someone created via the admin UI between bits — halt.
    if (existing.content_type !== "native") {
      throw new Error(
        `Slug '${params.slug}' is taken by a non-native article (content_type='${existing.content_type}'). Refuse to overwrite. Resolve manually.`,
      );
    }
    if (existing.category_id !== params.categoryId) {
      throw new Error(
        `Slug '${params.slug}' is taken by an article in a different category (existing=${existing.category_id}, target=${params.categoryId}). Refuse to overwrite. Resolve manually.`,
      );
    }
    if (existing.status === "published" && !params.allowOverwritePublished) {
      throw new Error(
        `Article '${params.slug}' is currently published. Refuse to overwrite content_json without --allow-overwrite-published (prevents accidental clobber of post-migration editorial edits).`,
      );
    }

    if (params.dryRun) {
      return { id: existing.id, created: false };
    }

    // Existing — bump title + category. Do NOT bump updated_at here: the
    // content_json rewrite happens later in step [8/8], and publishAndIndex
    // sets updated_at + last_published_at at the very end (verified at
    // src/lib/resource-publish.ts:64-68). Bumping updated_at now would create
    // a window where updated_at says "just updated" while content_json is
    // still old.
    const { error } = await supabase
      .from("resource_articles")
      .update({
        title: params.title,
        category_id: params.categoryId,
        author_id: params.authorId,
      })
      .eq("id", existing.id);
    if (error) {
      throw new Error(`Failed to update existing article ${params.slug}: ${error.message}`);
    }
    return { id: existing.id, created: false };
  }

  if (params.dryRun) {
    // Stub UUID-shaped id so uploadAssets has something to pass around;
    // it never reaches the DB because dryRun skips the junction insert.
    return { id: "00000000-0000-0000-0000-000000000000", created: true };
  }

  const { data: created, error: insertErr } = await supabase
    .from("resource_articles")
    .insert({
      title: params.title,
      slug: params.slug,
      category_id: params.categoryId,
      content_type: "native",
      content_json: [{ type: "p", children: [{ text: "" }] }],
      content: "",
      status: "draft",
      author_id: params.authorId,
    } as Database["public"]["Tables"]["resource_articles"]["Insert"])
    .select("id")
    .single();
  if (insertErr || !created?.id) {
    throw new Error(`Failed to create article ${params.slug}: ${insertErr?.message ?? "unknown"}`);
  }
  return { id: created.id, created: true };
}

function discoverAssetUrls(html: string): string[] {
  const set = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"]*?)"/g)) {
    const url = m[1];
    if (url.startsWith(WP_UPLOADS_PREFIX)) set.add(url);
  }
  for (const m of html.matchAll(/(?:src|href)\s*=\s*'([^']*?)'/g)) {
    const url = m[1];
    if (url.startsWith(WP_UPLOADS_PREFIX)) set.add(url);
  }
  return [...set];
}

/** Strip Elementor leftover shortcodes (e.g. [elementor-template id=...]). */
function cleanHtml(html: string): string {
  return html
    .replace(/\[\/?[a-zA-Z][^\]]*\]/g, "") // strip [shortcode] patterns
    .replace(/\r\n/g, "\n");
}

async function main() {
  const args = parseArgs(process.argv);
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("GOOGLE_SERVICE_ACCOUNT_KEY");
  requireEnv("GOOGLE_DRIVE_ADMIN_EMAIL");

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n=== Migrating ${args.slug}${args.dryRun ? " (DRY RUN)" : ""} ===`);
  console.log(`  XML:               ${args.xml}`);
  console.log(`  Drive root folder: ${args.driveFolder}`);
  console.log(`  Drive subfolder:   Resources/${args.slug}/`);
  console.log(`  Author email:      ${args.authorEmail}`);
  console.log(`  Category:          ${args.parentCategorySlug} > ${args.categorySlug}`);
  if (args.dryRun) {
    console.log(`  Mode:              dry-run (no Drive uploads, no DB writes)`);
  }
  if (args.allowOverwritePublished) {
    console.log(`  Mode:              --allow-overwrite-published (will rewrite content_json on published articles)`);
  }

  // 1. Parse XML, find target page
  console.log("\n[1/8] Parsing XML and locating target page");
  const wpExport = loadWpExport(args.xml);
  const page = findPageBySlug(wpExport.xml, args.slug);
  if (!page) {
    console.error(`  ✗ Page not found in XML: ${args.slug}`);
    process.exit(1);
  }
  if (page.status !== "publish") {
    console.warn(`  ⚠ Page status is '${page.status}', not 'publish' — proceeding anyway`);
  }
  console.log(`  ✓ Page: "${page.title}" (${page.content.length} bytes of HTML body)`);

  // 2. Resolve runtime ids
  console.log("\n[2/8] Resolving DB ids");
  const categoryId = await lookupCategoryId(
    supabase,
    args.parentCategorySlug,
    args.categorySlug,
  );
  const authorId = await lookupAuthorId(supabase, args.authorEmail);
  const internalSlugs = await loadMigratedSlugs(supabase);
  console.log(`  ✓ category_id = ${categoryId}`);
  console.log(`  ✓ author_id   = ${authorId}`);
  console.log(`  ✓ internal slugs known to walker: ${internalSlugs.size}`);

  // 3. Upsert article row (status='draft'). upsertArticle runs the same
  // slug-clash / publish-status guards in dry-run mode and just skips the
  // UPDATE/INSERT writes — so the duplicated check block here goes away.
  console.log(`\n[3/8] ${args.dryRun ? "Inspecting" : "Upserting"} article row`);
  const article = await upsertArticle(supabase, {
    slug: args.slug,
    title: decodeHtmlEntities(page.title),
    categoryId,
    authorId,
    allowOverwritePublished: args.allowOverwritePublished,
    dryRun: args.dryRun,
  });
  if (args.dryRun) {
    console.log(`  ✓ article_id = ${article.id}  (would ${article.created ? "create" : "update existing"})`);
  } else {
    console.log(`  ✓ article_id = ${article.id}  (${article.created ? "created" : "updated existing"})`);
  }

  // 4. Clean HTML
  console.log("\n[4/8] Cleaning HTML (strip shortcodes, normalise whitespace)");
  const cleaned = cleanHtml(page.content);
  console.log(`  ✓ ${page.content.length} → ${cleaned.length} bytes after clean`);

  // 5. Discover asset URLs
  console.log("\n[5/8] Discovering WP-hosted asset URLs");
  const urls = discoverAssetUrls(cleaned);
  console.log(`  ✓ ${urls.length} distinct wp-content URL(s)`);
  for (const u of urls) console.log(`      ${u}`);

  // 6. Upload assets to Drive + insert resource_media rows
  console.log(`\n[6/8] ${args.dryRun ? "Inspecting assets (no uploads)" : "Uploading assets to Drive"}`);
  let assetMap = new Map<string, AssetInfo>();
  try {
    const result = await uploadAssets({
      urls,
      attachmentsByUrl: wpExport.attachmentsByUrl,
      articleId: article.id,
      uploadedBy: authorId,
      slug: args.slug,
      driveFolderId: args.driveFolder,
      supabase,
      dryRun: args.dryRun,
    });
    assetMap = result.assetMap;
    if (args.dryRun) {
      console.log(`  ✓ Would upload ${result.wouldUpload}, would reuse (cross-article) ${result.reused}`);
    } else {
      console.log(`  ✓ Uploaded ${result.uploaded}, reused (cross-article) ${result.reused}`);
    }
  } catch (err) {
    if (err instanceof MigrationHaltError) {
      console.error(`\n  ✗ HALT: ${err.message}`);
      if (!args.dryRun) {
        console.error(`  No further changes made. Article ${article.id} is in 'draft' state with empty content.`);
      }
      process.exit(1);
    }
    throw err;
  }

  // 7. Convert HTML → Plate JSON
  console.log("\n[7/8] Converting HTML → Plate JSON");
  const articleTitle = decodeHtmlEntities(page.title).trim();
  const walkResult = htmlToPlate(cleaned, assetMap, { internalSlugs });
  const { warnings } = walkResult;
  let value = walkResult.value;
  // Strip duplicate first H1 if it matches the article title (WP pages
  // often begin with their own H1 echoing the page title — the article
  // view already renders the title, so the body H1 is redundant).
  if (value.length > 0) {
    const first = value[0] as { type?: string; children?: Array<{ text?: string }> };
    if (first.type === "h1") {
      const text = (first.children ?? [])
        .map((c) => c.text ?? "")
        .join("")
        .trim();
      if (text.toLowerCase() === articleTitle.toLowerCase()) {
        value = value.slice(1);
        console.log(`  ↺ stripped duplicate top-level h1 matching title: "${text}"`);
      }
    }
  }
  console.log(`  ✓ ${value.length} top-level Plate nodes`);
  if (warnings.length) {
    console.log(`  ⚠ ${warnings.length} walker warning(s):`);
    for (const w of warnings) console.log(`      ${w}`);
  }

  // Empty-content guard: an article with zero nodes is never valid output.
  // Hits if the WP body was shortcode-only (e.g. Elementor pages) and the
  // cleaner stripped everything.
  if (value.length === 0) {
    throw new MigrationHaltError(
      `Walker produced empty content_json for ${args.slug}. Body may be Elementor-templated (check elementor_library items in the XML).`,
    );
  }

  // Walker BLOCKED escalation: the walker is shared with the UI's Import HTML
  // path, so it can't throw — it returns warnings instead. The migration
  // script promotes specific warning patterns to a halt, matching the PRD's
  // Tier 2 escalation rule. Tables, dl/dt/dd, details/summary, svg, and
  // inline styles all silently lose structure; they must be addressed
  // explicitly per page before the migration succeeds.
  const haltPatterns: { pattern: RegExp; label: string }[] = [
    { pattern: /^Table element/i, label: "table" },
    { pattern: /Unknown block tag <(dl|dt|dd|details|summary|svg)/i, label: "structural-tag" },
  ];
  const haltingWarnings = warnings.filter((w) =>
    haltPatterns.some(({ pattern }) => pattern.test(w)),
  );
  if (haltingWarnings.length > 0) {
    throw new MigrationHaltError(
      `Walker found unsupported HTML structures for ${args.slug}:\n  - ${haltingWarnings.join("\n  - ")}\nThese silently lose content. Resolve per page before retrying.`,
    );
  }

  // 8. Persist content_json + publishAndIndex (skipped in dry-run).
  if (args.dryRun) {
    console.log(`\n[8/8] Skipping content_json save + publish (dry-run)`);
    console.log(`  Dry-run complete. Re-run without --dry-run to apply.`);
    return;
  }

  console.log("\n[8/8] Saving content_json and publishing");
  const { error: updateErr } = await supabase
    .from("resource_articles")
    .update({ content_json: value as unknown as Database["public"]["Tables"]["resource_articles"]["Update"]["content_json"] })
    .eq("id", article.id);
  if (updateErr) {
    console.error(`  ✗ Failed to update content_json: ${updateErr.message}`);
    process.exit(1);
  }
  console.log(`  ✓ content_json saved`);

  const publishResult = await publishAndIndex(article.id);
  if (!publishResult.success) {
    console.error(`  ✗ publishAndIndex failed: ${publishResult.error}`);
    process.exit(1);
  }
  console.log(`  ✓ Published and indexed in Algolia`);

  // Summary
  console.log("\n=== Done ===");
  console.log(`  Article URL:    /resources/article/${args.slug}`);
  console.log(`  Drive folder:   MCR Intranet Attachments / Resources / ${args.slug}/`);
  console.log(`  Author:         ${args.authorEmail}`);
}

main().catch((err: unknown) => {
  console.error("\n=== Migration error ===");
  console.error(err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
