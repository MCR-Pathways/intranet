#!/usr/bin/env tsx
/**
 * Reindex a single native Resources article in Algolia after a direct
 * content_json mutation that bypassed the editor's auto-save flow (e.g.,
 * after running `scripts/flatten-toggles.ts`).
 *
 * Mirrors the logic of `reindexNativeArticle` server action in
 * src/app/(protected)/resources/native-actions.ts but uses the service-role
 * client directly (no auth wrapper).
 *
 * Usage (run from project root):
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/reindex-native-article.ts --slug=<slug>
 *
 * --slug=<slug>    REQUIRED.
 */
import { createClient } from "@supabase/supabase-js";
import {
  indexArticleSections,
  removeArticleFromIndex,
} from "@/lib/algolia";
import { parseHtmlIntoSections } from "@/lib/html-sections";
import { serialiseContentToHtml } from "@/lib/resource-publish";
import type { Database } from "@/types/database.types";

interface Args {
  slug: string;
}

function parseArgs(argv: string[]): Args {
  let slug: string | null = null;
  for (const a of argv.slice(2)) {
    if (a.startsWith("--slug=")) slug = a.slice("--slug=".length);
    else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }
  if (!slug) {
    console.error("Missing required --slug=<slug>");
    process.exit(2);
  }
  return { slug };
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

  type ArticleRow = {
    id: string;
    slug: string;
    title: string | null;
    content_json: unknown;
    status: string;
    resource_categories: { name: string; slug: string } | null;
  };

  let article: ArticleRow | null = null;
  try {
    const res = await supabase
      .from("resource_articles")
      .select(
        "id, title, slug, content_json, status, resource_categories!category_id(name, slug)",
      )
      .eq("content_type", "native")
      .eq("slug", args.slug)
      .maybeSingle();
    if (res.error) {
      console.error("Failed to fetch article:", res.error.message);
      process.exit(1);
    }
    article = res.data as unknown as ArticleRow | null;
  } catch (err) {
    console.error(
      "Network error fetching article:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  if (!article) {
    console.log(`No native article found with slug "${args.slug}"`);
    process.exit(0);
  }
  const row: ArticleRow = article;

  if (row.status !== "published") {
    console.log(
      `Article "${args.slug}" is ${row.status} (not published). Skipping reindex.`,
    );
    process.exit(0);
  }

  const html = await serialiseContentToHtml(row.content_json);
  if (html === null) {
    console.error(
      `Serialisation error for "${args.slug}". Aborting reindex to avoid data loss.`,
    );
    process.exit(1);
  }

  try {
    const { error: syncError } = await supabase
      .from("resource_articles")
      .update({ synced_html: html || null })
      .eq("id", row.id)
      .eq("content_type", "native");
    if (syncError) {
      console.error(
        `Failed to persist synced_html for ${args.slug}:`,
        syncError.message,
      );
      // Continue to Algolia push — synced_html is best-effort.
    }
  } catch (err) {
    console.error(
      `Network error persisting synced_html for ${args.slug}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!html) {
    console.log(`"${args.slug}" has empty content. Removing from Algolia.`);
    try {
      await removeArticleFromIndex(row.id);
    } catch (err) {
      console.error(
        `Failed to remove from Algolia:`,
        err instanceof Error ? err.message : String(err),
      );
      process.exit(1);
    }
    process.exit(0);
  }

  const sections = parseHtmlIntoSections(html);
  try {
    await indexArticleSections(
      row.id,
      row.slug,
      row.title ?? "",
      "native",
      row.resource_categories?.name ?? "",
      row.resource_categories?.slug ?? "",
      sections,
      new Date().toISOString(),
    );
  } catch (err) {
    console.error(
      `Algolia index push failed for ${args.slug}:`,
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  console.log(
    `Reindexed ${args.slug}: ${sections.length} section(s) pushed to Algolia.`,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
