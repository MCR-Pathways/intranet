#!/usr/bin/env tsx
/**
 * Hard-delete over-migrated WordPress pages from the intranet.
 *
 * Background: participation-forms and yt-participation-forms were migrated
 * as separate articles before noticing that their content had already been
 * consolidated into pc-support upstream. This script removes them cleanly:
 *
 *   1. removeArticleFromIndex   — Algolia entry gone
 *   2. deleteFileFromDrive      — each linked Drive file gone (tolerant)
 *   3. delete resource_media    — DB row + cascading junction rows gone
 *   4. delete resource_articles — article row gone
 *
 * Order follows the resources CLAUDE.md "delete external before DB" rule.
 * External-step failures log but don't abort the DB delete — manual Drive
 * cleanup is recoverable, but a DB row that thinks it has a junction it
 * doesn't have is harder to spot.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/wp-migration/cleanup-over-migrated.ts <slug> [<slug> ...]
 */
import { createClient } from "@supabase/supabase-js";
import { deleteFileFromDrive } from "@/lib/google-drive-upload";
import { getDriveClient } from "@/lib/google-drive";
import { removeArticleFromIndex } from "@/lib/algolia";
import type { Database } from "@/types/database.types";

const DEFAULT_DRIVE_ROOT = "1u0nCOG8fvuw81lRrKXDwbHtuvaT2O-q5"; // MCR Intranet Attachments
const RESOURCES_FOLDER_NAME = "Resources";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env var: ${name}`); process.exit(2); }
  return v;
}

/**
 * Find a folder by (parent, name). Returns null if it doesn't exist.
 * Folders in Drive are just files with the application/vnd.google-apps.folder
 * mime type, so the same `files.list` query the uploader uses to resolve
 * subfolders works in reverse.
 */
async function findFolder(parentId: string, name: string): Promise<string | null> {
  const drive = getDriveClient();
  const escaped = name.replace(/'/g, "\\'");
  const list = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });
  return list.data.files?.[0]?.id ?? null;
}

/**
 * Delete the per-article Drive subfolder if it's empty. The script's
 * `Resources/<slug>/` convention means each over-migrated article had its
 * own folder, which should be empty after `deleteFileFromDrive` runs on
 * every asset. The Resources/ parent stays — it's shared.
 */
async function deletePerSlugFolder(slug: string): Promise<void> {
  const driveRoot = process.env.WP_DRIVE_ROOT ?? DEFAULT_DRIVE_ROOT;
  const resourcesFolderId = await findFolder(driveRoot, RESOURCES_FOLDER_NAME);
  if (!resourcesFolderId) {
    console.log(`  ⚠ Resources/ folder not found under ${driveRoot} — skipping folder delete`);
    return;
  }
  const slugFolderId = await findFolder(resourcesFolderId, slug);
  if (!slugFolderId) {
    console.log(`  ⚠ Resources/${slug}/ folder not found — already gone or never created`);
    return;
  }

  // Confirm the folder is empty before deleting (defence against deleting
  // a folder that still has unrelated files in it).
  const drive = getDriveClient();
  const children = await drive.files.list({
    q: `'${slugFolderId}' in parents and trashed = false`,
    fields: "files(id, name)",
    pageSize: 5,
  });
  const remaining = children.data.files ?? [];
  if (remaining.length > 0) {
    console.log(`  ⚠ Resources/${slug}/ still has ${remaining.length} file(s) — refusing to delete:`);
    remaining.forEach((f) => console.log(`      - ${f.name} (${f.id})`));
    return;
  }

  try {
    await deleteFileFromDrive(slugFolderId);
    console.log(`  ✓ Resources/${slug}/ folder deleted (${slugFolderId})`);
  } catch (err) {
    console.warn(`  ⚠ Resources/${slug}/ folder delete failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function deleteOne(slug: string, supabase: ReturnType<typeof createClient<Database>>): Promise<void> {
  console.log(`\n=== ${slug} ===`);

  // 1. Look up the article
  const { data: article, error: articleErr } = await supabase
    .from("resource_articles")
    .select("id, title, status, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (articleErr) { throw new Error(`[${slug}] read failed: ${articleErr.message}`); }
  if (!article) { console.log(`  ⚠ no article with slug '${slug}' — nothing to clean up`); return; }

  console.log(`  article_id: ${article.id}`);
  console.log(`  title: "${article.title}"`);
  console.log(`  status: ${article.status}`);

  // 2. Find all media tied to this article (via junction OR legacy article_id)
  const [junctionRes, legacyRes] = await Promise.all([
    supabase.from("resource_media_articles").select("media_id").eq("article_id", article.id),
    supabase.from("resource_media").select("id, file_id, original_name").eq("article_id", article.id),
  ]);
  if (junctionRes.error) { throw new Error(`[${slug}] junction read failed: ${junctionRes.error.message}`); }
  if (legacyRes.error) { throw new Error(`[${slug}] media legacy read failed: ${legacyRes.error.message}`); }

  const junctionMediaIds = new Set((junctionRes.data ?? []).map((r) => r.media_id));
  const legacyMedia = legacyRes.data ?? [];

  // Resolve full media records for the union (junction may reference media owned by other articles too)
  const allMediaIds = new Set<string>(legacyMedia.map((m) => m.id));
  junctionMediaIds.forEach((id) => allMediaIds.add(id));

  if (allMediaIds.size === 0) {
    console.log(`  no media rows referenced`);
  } else {
    const { data: mediaRows, error: mediaErr } = await supabase
      .from("resource_media")
      .select("id, file_id, original_name, article_id")
      .in("id", Array.from(allMediaIds));
    if (mediaErr) { throw new Error(`[${slug}] media expand failed: ${mediaErr.message}`); }

    // Identify which media rows are EXCLUSIVELY this article's (safe to delete)
    // vs shared with other articles via junction (only delete the junction row).
    const mediaIdsExclusive: string[] = [];
    const mediaIdsShared: string[] = [];
    for (const m of mediaRows ?? []) {
      const { count } = await supabase
        .from("resource_media_articles")
        .select("article_id", { count: "exact", head: true })
        .eq("media_id", m.id);
      const otherJunctionRefs = (count ?? 0) - (junctionMediaIds.has(m.id) ? 1 : 0);
      if (otherJunctionRefs > 0 || (m.article_id && m.article_id !== article.id)) {
        mediaIdsShared.push(m.id);
        console.log(`  ⚠ media ${m.file_id} (${m.original_name}) shared with another article — will remove junction only`);
      } else {
        mediaIdsExclusive.push(m.id);
      }
    }
    console.log(`  exclusive media to delete: ${mediaIdsExclusive.length}`);
    console.log(`  shared media to keep (junction-only removal): ${mediaIdsShared.length}`);

    // 3. Algolia first
    try {
      await removeArticleFromIndex(article.id);
      console.log(`  ✓ Algolia removed`);
    } catch (err) {
      console.warn(`  ⚠ Algolia removal failed (continuing): ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. Drive deletes for exclusive media
    const exclusiveMedia = (mediaRows ?? []).filter((m) => mediaIdsExclusive.includes(m.id));
    for (const m of exclusiveMedia) {
      try {
        await deleteFileFromDrive(m.file_id);
        console.log(`  ✓ Drive deleted: ${m.file_id} (${m.original_name})`);
      } catch (err) {
        console.warn(`  ⚠ Drive delete failed for ${m.file_id} (continuing): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 5. Drop junction rows for this article (covers both shared + exclusive media)
    const { error: junctionDeleteErr } = await supabase
      .from("resource_media_articles")
      .delete()
      .eq("article_id", article.id);
    if (junctionDeleteErr) {
      throw new Error(`[${slug}] junction delete failed: ${junctionDeleteErr.message}`);
    }
    console.log(`  ✓ junction rows deleted`);

    // 6. Delete exclusive resource_media rows (junction already gone via step 5)
    if (mediaIdsExclusive.length > 0) {
      const { error: mediaDelErr } = await supabase
        .from("resource_media")
        .delete()
        .in("id", mediaIdsExclusive);
      if (mediaDelErr) { throw new Error(`[${slug}] media delete failed: ${mediaDelErr.message}`); }
      console.log(`  ✓ ${mediaIdsExclusive.length} resource_media rows deleted`);
    }
  }

  // 7. Delete the article row
  const { error: articleDelErr } = await supabase
    .from("resource_articles")
    .delete()
    .eq("id", article.id);
  if (articleDelErr) { throw new Error(`[${slug}] article delete failed: ${articleDelErr.message}`); }
  console.log(`  ✓ article row deleted`);

  // 8. Delete the empty Drive subfolder
  await deletePerSlugFolder(slug);
}

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error("Usage: cleanup-over-migrated.ts <slug> [<slug> ...]");
    process.exit(2);
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("GOOGLE_SERVICE_ACCOUNT_KEY");
  requireEnv("GOOGLE_DRIVE_ADMIN_EMAIL");

  const supabase = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const slug of slugs) {
    await deleteOne(slug, supabase);
  }

  console.log(`\n=== Done ===\n  Cleaned up ${slugs.length} article(s): ${slugs.join(", ")}`);
}

main().catch((err: unknown) => {
  console.error("\n=== Cleanup error ===");
  console.error(err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
