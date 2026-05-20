#!/usr/bin/env tsx
/**
 * One-off: delete empty per-slug subfolders under
 * `MCR Intranet Attachments/Resources/`. Used after cleanup-over-migrated.ts
 * has already removed the article and its assets, leaving an empty Drive
 * folder behind. Refuses to delete if the folder still has children.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/wp-migration/delete-empty-folders.ts <slug> [<slug> ...]
 */
import { getDriveClient } from "@/lib/google-drive";
import { deleteFileFromDrive } from "@/lib/google-drive-upload";

const DEFAULT_DRIVE_ROOT = "1u0nCOG8fvuw81lRrKXDwbHtuvaT2O-q5"; // MCR Intranet Attachments
const RESOURCES_FOLDER_NAME = "Resources";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env var: ${name}`); process.exit(2); }
  return v;
}

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

async function deleteIfEmpty(parentResourcesId: string, slug: string): Promise<void> {
  const slugFolderId = await findFolder(parentResourcesId, slug);
  if (!slugFolderId) {
    console.log(`  Resources/${slug}/ — not found (already gone or never created)`);
    return;
  }

  const drive = getDriveClient();
  const children = await drive.files.list({
    q: `'${slugFolderId}' in parents and trashed = false`,
    fields: "files(id, name)",
    pageSize: 5,
  });
  const remaining = children.data.files ?? [];
  if (remaining.length > 0) {
    console.log(`  Resources/${slug}/ — refusing to delete, has ${remaining.length} file(s):`);
    remaining.forEach((f) => console.log(`      - ${f.name} (${f.id})`));
    return;
  }

  try {
    await deleteFileFromDrive(slugFolderId);
    console.log(`  ✓ Resources/${slug}/ deleted (${slugFolderId})`);
  } catch (err) {
    console.warn(`  ⚠ Resources/${slug}/ delete failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error("Usage: delete-empty-folders.ts <slug> [<slug> ...]");
    process.exit(2);
  }

  requireEnv("GOOGLE_SERVICE_ACCOUNT_KEY");
  requireEnv("GOOGLE_DRIVE_ADMIN_EMAIL");

  const driveRoot = process.env.WP_DRIVE_ROOT ?? DEFAULT_DRIVE_ROOT;
  const resourcesFolderId = await findFolder(driveRoot, RESOURCES_FOLDER_NAME);
  if (!resourcesFolderId) {
    console.error(`Resources/ folder not found under ${driveRoot}`);
    process.exit(1);
  }

  for (const slug of slugs) {
    await deleteIfEmpty(resourcesFolderId, slug);
  }
}

main().catch((err: unknown) => {
  console.error("\n=== Error ===");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
