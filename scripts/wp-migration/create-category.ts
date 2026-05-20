#!/usr/bin/env tsx
/**
 * One-off: insert a single `resource_categories` row.
 *
 * The migration script intentionally refuses to create categories (per the
 * Bit 1 plan invariant: catches admin renames between bits). This script
 * is its inverse — a deliberate, explicit one-shot for the rare case
 * when a new destination subcategory needs to exist before a bit runs.
 *
 * Idempotent on slug: refuses if a row already exists with the same slug
 * (whether under the requested parent or anywhere). Surfaces the conflict
 * rather than silently doing nothing.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/wp-migration/create-category.ts \
 *     --slug=<new-slug> \
 *     --name="<Display Name>" \
 *     --parent-slug=<parent-slug>
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

interface Args {
  slug: string;
  name: string;
  parentSlug: string;
}

function parseArgs(argv: string[]): Args {
  const map: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) map[m[1]] = m[2];
  }
  const missing: string[] = [];
  if (!map.slug) missing.push("--slug");
  if (!map.name) missing.push("--name");
  if (!map["parent-slug"]) missing.push("--parent-slug");
  if (missing.length) {
    console.error(`Missing required flags: ${missing.join(", ")}`);
    console.error(`Usage: create-category.ts --slug=<slug> --name="<Display Name>" --parent-slug=<parent>`);
    process.exit(2);
  }
  return { slug: map.slug, name: map.name, parentSlug: map["parent-slug"] };
}

async function main() {
  const args = parseArgs(process.argv);

  const sb = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 1. Resolve parent
  const { data: parent, error: parentErr } = await sb
    .from("resource_categories")
    .select("id, name, slug")
    .eq("slug", args.parentSlug)
    .is("deleted_at", null)
    .single();
  if (parentErr || !parent) {
    console.error(`Parent category '${args.parentSlug}' not found: ${parentErr?.message ?? "no row"}`);
    process.exit(1);
  }
  console.log(`Parent: "${parent.name}" (${parent.slug}, id=${parent.id})`);

  // 2. Slug-clash check
  const { data: existing } = await sb
    .from("resource_categories")
    .select("id, name, parent_id, deleted_at")
    .eq("slug", args.slug)
    .maybeSingle();
  if (existing) {
    if (existing.deleted_at) {
      console.error(`Slug '${args.slug}' is taken by a SOFT-DELETED category (id=${existing.id}). Clear deleted_at to restore, or pick a different slug.`);
    } else if (existing.parent_id === parent.id) {
      console.log(`Slug '${args.slug}' already exists under parent '${parent.slug}' (id=${existing.id}) — nothing to do.`);
      return;
    } else {
      console.error(`Slug '${args.slug}' is taken by an existing category under a different parent (id=${existing.id}, parent_id=${existing.parent_id}). Pick a different slug.`);
    }
    process.exit(1);
  }

  // 3. Next sort_order under this parent
  const { data: siblings } = await sb
    .from("resource_categories")
    .select("sort_order")
    .eq("parent_id", parent.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSort = (siblings?.[0]?.sort_order ?? -1) + 1;
  console.log(`Next sort_order under '${parent.slug}': ${nextSort}`);

  // 4. Insert
  const { data: created, error: insertErr } = await sb
    .from("resource_categories")
    .insert({
      name: args.name,
      slug: args.slug,
      parent_id: parent.id,
      sort_order: nextSort,
    } as Database["public"]["Tables"]["resource_categories"]["Insert"])
    .select("id")
    .single();
  if (insertErr || !created) {
    console.error(`Insert failed: ${insertErr?.message ?? "no row returned"}`);
    process.exit(1);
  }

  console.log(`\n✓ Created category "${args.name}" (id=${created.id}, slug=${args.slug}) under ${parent.slug}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
