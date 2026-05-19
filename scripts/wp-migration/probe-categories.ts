#!/usr/bin/env tsx
/**
 * Probe: dump category contents (article counts, deleted_at, parent) for
 * one or more slug values. Read-only diagnostic.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/wp-migration/probe-categories.ts <slug> [<slug> ...]
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) { console.error("usage: probe-categories.ts <slug> [<slug> ...]"); process.exit(1); }

  const sb = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  for (const slug of slugs) {
    const { data: cat, error } = await sb
      .from("resource_categories")
      .select("id, name, slug, parent_id, sort_order, deleted_at, created_at")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !cat) {
      console.log(`\n[${slug}] not found in resource_categories${error ? `: ${error.message}` : ""}`);
      continue;
    }
    console.log(`\n=== ${slug} ===`);
    console.log(`  id: ${cat.id}`);
    console.log(`  name: ${cat.name}`);
    console.log(`  parent_id: ${cat.parent_id ?? "(top-level)"}`);
    console.log(`  sort_order: ${cat.sort_order}`);
    console.log(`  deleted_at: ${cat.deleted_at ?? "(active)"}`);
    console.log(`  created_at: ${cat.created_at}`);

    // Articles in this category
    const { data: articles, error: artErr } = await sb
      .from("resource_articles")
      .select("id, slug, title, status")
      .eq("category_id", cat.id);
    if (artErr) { console.log(`  ⚠ article lookup failed: ${artErr.message}`); continue; }
    console.log(`  articles (${articles?.length ?? 0}):`);
    (articles ?? []).forEach((a) => console.log(`    - ${a.slug} (${a.status}) — "${a.title}"`));

    // Child categories
    const { data: children, error: childErr } = await sb
      .from("resource_categories")
      .select("id, slug, name")
      .eq("parent_id", cat.id);
    if (childErr) { console.log(`  ⚠ child lookup failed: ${childErr.message}`); continue; }
    console.log(`  child categories (${children?.length ?? 0}):`);
    (children ?? []).forEach((c) => console.log(`    - ${c.slug} — "${c.name}"`));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
