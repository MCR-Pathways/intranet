#!/usr/bin/env tsx
/**
 * Convert stored indent-shape `toggle` content_json to container-shape
 * `toggle_v2`.
 *
 * Usage (run from project root):
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/convert-stored-toggles.ts [--slug=<slug>] [--dry-run]
 *
 * Without --slug, all `content_type = 'native'` resource articles are
 * scanned. With --slug=<slug>, only that one is processed.
 *
 * --dry-run prints what would change without writing to the DB.
 *
 * Each article's content_json is walked by `convertStoredToggles` from
 * src/lib/wp-migration/convert-stored-toggles.ts (which has unit
 * coverage). Articles with zero toggles are skipped. Articles with
 * toggles get their content_json replaced; everything else on the row
 * stays untouched.
 *
 * Exit code 0 on success (with summary printed), non-zero on any DB
 * error.
 */
import { createClient } from "@supabase/supabase-js";
import { convertStoredToggles } from "@/lib/wp-migration/convert-stored-toggles";
import type { Database } from "@/types/database.types";
import type { Value } from "platejs";

interface Args {
  slug: string | null;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { slug: null, dryRun: false };
  for (const a of argv.slice(2)) {
    if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--slug=")) args.slug = a.slice("--slug=".length);
    else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env",
    );
    process.exit(2);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = supabase
    .from("resource_articles")
    .select("id, slug, title, content_json")
    .eq("content_type", "native");
  if (args.slug) query = query.eq("slug", args.slug);

  const { data: articles, error } = await query;
  if (error) {
    console.error("Failed to fetch articles:", error.message);
    process.exit(1);
  }
  if (!articles || articles.length === 0) {
    console.log(
      args.slug
        ? `No native article found with slug "${args.slug}"`
        : "No native articles found",
    );
    process.exit(0);
  }

  let scanned = 0;
  let converted = 0;
  let totalToggles = 0;
  const errors: Array<{ slug: string; message: string }> = [];

  for (const article of articles) {
    scanned++;
    if (!article.content_json || !Array.isArray(article.content_json)) {
      continue;
    }

    const { value: newValue, toggleCount } = convertStoredToggles(
      article.content_json as Value,
    );
    if (toggleCount === 0) continue;

    converted++;
    totalToggles += toggleCount;
    console.log(
      `${args.dryRun ? "[dry-run] " : ""}${article.slug}: ${toggleCount} toggle(s) → toggle_v2`,
    );

    if (args.dryRun) continue;

    const { error: updateErr } = await supabase
      .from("resource_articles")
      .update({ content_json: newValue as never })
      .eq("id", article.id);

    if (updateErr) {
      errors.push({ slug: article.slug, message: updateErr.message });
      console.error(`  ✗ ${article.slug}: ${updateErr.message}`);
    }
  }

  console.log("");
  console.log(
    `${args.dryRun ? "[dry-run] " : ""}Scanned ${scanned} native article(s). ` +
      `${converted} would be converted, ${totalToggles} toggle(s) total.`,
  );

  if (errors.length > 0) {
    console.error(`\n${errors.length} update(s) failed:`);
    for (const e of errors) console.error(`  ${e.slug}: ${e.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
