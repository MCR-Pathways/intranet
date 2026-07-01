#!/usr/bin/env tsx
/**
 * §2.1b — flag the standalone-links inside existing 4+ auto-grids so those
 * grids survive an edit that drops them below the threshold. One-off, bulk over
 * all native articles, idempotent.
 *
 * Usage (from project root):
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/flag-auto-grid-cards.ts [--dry-run]
 *
 * --dry-run   Print per-article counts without writing. Run this first.
 *
 * No reindex is needed: displayAsCard is presentational and the Algolia path
 * ignores it, so the indexed HTML and section records are unchanged.
 *
 * Exit 0 on success (summary printed), non-zero on any DB error.
 */
import { createClient } from "@supabase/supabase-js";
import { flagAutoGridCards } from "@/lib/resource-grid";
import type { Database } from "@/types/database.types";
import type { Value } from "platejs";

async function main() {
  const dryRun = process.argv.slice(2).includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
    process.exit(2);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("resource_articles")
    .select("id, slug, status, content_json")
    .eq("content_type", "native");
  if (error) {
    console.error("Failed to fetch articles:", error.message);
    process.exit(1);
  }

  let articlesChanged = 0;
  let totalFlagged = 0;

  for (const article of data ?? []) {
    if (!Array.isArray(article.content_json)) continue;
    const { value: newValue, flaggedCount } = flagAutoGridCards(article.content_json as Value);
    if (flaggedCount === 0) continue;

    articlesChanged++;
    totalFlagged += flaggedCount;
    console.log(
      `${dryRun ? "[dry-run] " : ""}${article.slug} [${article.status}]: ${flaggedCount} link(s) flagged`,
    );

    if (dryRun) continue;

    const { error: updateErr } = await supabase
      .from("resource_articles")
      .update({
        content_json:
          newValue as unknown as Database["public"]["Tables"]["resource_articles"]["Update"]["content_json"],
      })
      .eq("id", article.id);
    // Stop on the first persistence failure so a partial run is obvious rather
    // than silently skipping an article whose flags never landed.
    if (updateErr) {
      console.error(`Failed to update ${article.slug}:`, updateErr.message);
      process.exit(1);
    }
  }

  console.log("");
  console.log(
    `${dryRun ? "[dry-run] " : ""}${articlesChanged} article(s), ${totalFlagged} link(s) ${dryRun ? "would be flagged" : "flagged"}.`,
  );
  console.log(
    dryRun
      ? "Re-run without --dry-run to apply."
      : "Done. No reindex needed (displayAsCard is presentational; the Algolia path ignores it).",
  );
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
