#!/usr/bin/env tsx
/**
 * One-off: soft-delete `resource_categories` rows by slug.
 *
 * Sets `deleted_at = now()`. The `is null` filter on every active read
 * path hides soft-deleted categories from the sidebar, category pages,
 * and the move-article dialog. Reversible: clear `deleted_at` to restore.
 *
 * Refuses to soft-delete a category that still has active articles or
 * child categories — those need to be moved or deleted first.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/wp-migration/soft-delete-categories.ts <slug> [<slug> ...]
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

async function softDeleteOne(
  supabase: ReturnType<typeof createClient<Database>>,
  slug: string,
): Promise<void> {
  console.log(`\n=== ${slug} ===`);

  const { data: cat, error: catErr } = await supabase
    .from("resource_categories")
    .select("id, name, deleted_at")
    .eq("slug", slug)
    .maybeSingle();
  if (catErr) { throw new Error(`[${slug}] read failed: ${catErr.message}`); }
  if (!cat) { console.log(`  ⚠ category '${slug}' not found`); return; }
  if (cat.deleted_at) { console.log(`  already soft-deleted at ${cat.deleted_at}`); return; }
  console.log(`  id: ${cat.id}`);
  console.log(`  name: "${cat.name}"`);

  // Refuse if there are still active articles in this category
  const { data: articles, error: artErr } = await supabase
    .from("resource_articles")
    .select("slug", { count: "exact" })
    .eq("category_id", cat.id);
  if (artErr) { throw new Error(`[${slug}] article count failed: ${artErr.message}`); }
  if ((articles?.length ?? 0) > 0) {
    console.log(`  ⚠ refusing: ${articles?.length} article(s) still in this category:`);
    articles?.forEach((a) => console.log(`      - ${a.slug}`));
    return;
  }

  // Refuse if there are active child categories
  const { data: children, error: childErr } = await supabase
    .from("resource_categories")
    .select("slug")
    .eq("parent_id", cat.id)
    .is("deleted_at", null);
  if (childErr) { throw new Error(`[${slug}] child count failed: ${childErr.message}`); }
  if ((children?.length ?? 0) > 0) {
    console.log(`  ⚠ refusing: ${children?.length} active child category/ies:`);
    children?.forEach((c) => console.log(`      - ${c.slug}`));
    return;
  }

  const { error: updateErr } = await supabase
    .from("resource_categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", cat.id);
  if (updateErr) { throw new Error(`[${slug}] soft-delete failed: ${updateErr.message}`); }
  console.log(`  ✓ soft-deleted`);
}

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error("Usage: soft-delete-categories.ts <slug> [<slug> ...]");
    process.exit(2);
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  for (const slug of slugs) {
    await softDeleteOne(supabase, slug);
  }
  console.log(`\n=== Done ===`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
