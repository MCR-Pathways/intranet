#!/usr/bin/env tsx
/**
 * Flatten container-shape `toggle_v2` content_json to plain headings + inline
 * body content. Per-page editorial pass for the search-precision retrofit
 * (Algolia indexes only H1–H4 headings; toggle summaries don't produce their
 * own section records).
 *
 * Usage (run from project root):
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/flatten-toggles.ts --slug=<slug> [--dry-run] [--exclude="<title>,<title>"] [--heading=h3]
 *
 * --slug=<slug>            REQUIRED. The article slug to operate on. No
 *                          bulk mode — every page in the editorial-pass
 *                          queue has its own audit decisions (e.g.,
 *                          people-services keeps COSHH Assessments as a
 *                          toggle while flattening everything else), so
 *                          per-slug invocation is the safer pattern.
 * --dry-run                Print what would change without writing to the
 *                          DB. Default is `false` (writes apply). Run
 *                          with --dry-run first to inspect.
 * --exclude="A,B"          Comma-separated list of toggle summary titles
 *                          to skip. Match is case-insensitive, trimmed.
 *                          Use for the COSHH Assessments case on
 *                          people-services.
 * --heading=h2|h3          Heading level the promoted summary takes.
 *                          Defaults to h3 (the common case — toggle
 *                          under H2 section becomes H3 child). Use
 *                          --heading=h2 for the pc-support PC Guidebook
 *                          case (single toggle that's really a section
 *                          heading).
 * --promote-labels="A,B"   Comma-separated suffix list. After flattening
 *                          a toggle summary "<X>" to a heading, promote
 *                          any `p` inside the body whose text equals
 *                          "<X> <suffix>" and that contains no anchor
 *                          descendant to a sub-heading. Used for the
 *                          group-work article where each theme body
 *                          starts with bold "<Theme> Activity Plans"
 *                          and "<Theme> Resources" label paragraphs.
 * --promote-labels-level=h4
 *                          Heading level the promoted labels take.
 *                          Defaults to h4 (one below the standard h3
 *                          summary level).
 *
 * Nested headings inside the toggle body are demoted by one level so the
 * outline shape stays consistent. Nested `toggle_v2` inside another
 * `toggle_v2`'s body is recursively flattened at the next level down.
 *
 * Exit code 0 on success (with summary printed), non-zero on any DB error.
 */
import { createClient } from "@supabase/supabase-js";
import { flattenToggleV2 } from "@/lib/wp-migration/flatten-toggle-v2";
import type { HeadingLevel } from "@/lib/wp-migration/flatten-toggle-v2";
import type { Database } from "@/types/database.types";
import type { Value } from "platejs";

interface Args {
  slug: string;
  dryRun: boolean;
  exclude: string[];
  heading: HeadingLevel;
  promoteLabels: string[];
  promoteLabelsLevel: HeadingLevel;
}

const VALID_HEADINGS: HeadingLevel[] = ["h1", "h2", "h3", "h4", "h5", "h6"];

function parseArgs(argv: string[]): Args {
  let slug: string | null = null;
  let dryRun = false;
  let exclude: string[] = [];
  let heading: HeadingLevel = "h3";
  let promoteLabels: string[] = [];
  let promoteLabelsLevel: HeadingLevel = "h4";

  for (const a of argv.slice(2)) {
    if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--slug=")) slug = a.slice("--slug=".length);
    else if (a.startsWith("--exclude=")) {
      exclude = a
        .slice("--exclude=".length)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith("--heading=")) {
      const h = a.slice("--heading=".length) as HeadingLevel;
      if (!VALID_HEADINGS.includes(h)) {
        console.error(
          `Invalid --heading=${h}. Must be one of: ${VALID_HEADINGS.join(", ")}`,
        );
        process.exit(2);
      }
      heading = h;
    } else if (a.startsWith("--promote-labels=")) {
      promoteLabels = a
        .slice("--promote-labels=".length)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith("--promote-labels-level=")) {
      const h = a.slice("--promote-labels-level=".length) as HeadingLevel;
      if (!VALID_HEADINGS.includes(h)) {
        console.error(
          `Invalid --promote-labels-level=${h}. Must be one of: ${VALID_HEADINGS.join(", ")}`,
        );
        process.exit(2);
      }
      promoteLabelsLevel = h;
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }
  if (!slug) {
    console.error("Missing required --slug=<slug>");
    process.exit(2);
  }
  return {
    slug,
    dryRun,
    exclude,
    heading,
    promoteLabels,
    promoteLabelsLevel,
  };
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

  let article: {
    id: string;
    slug: string;
    title: string | null;
    content_json: unknown;
  } | null = null;
  try {
    const res = await supabase
      .from("resource_articles")
      .select("id, slug, title, content_json")
      .eq("content_type", "native")
      .eq("slug", args.slug)
      .maybeSingle();
    if (res.error) {
      console.error("Failed to fetch article:", res.error.message);
      process.exit(1);
    }
    article = res.data;
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

  if (!article.content_json || !Array.isArray(article.content_json)) {
    console.log(`Article "${args.slug}" has no content_json or it's not an array. Skipping.`);
    process.exit(0);
  }

  const {
    value: newValue,
    flattenedCount,
    skippedCount,
    demotionCount,
    labelPromotionCount,
  } = flattenToggleV2(article.content_json as Value, {
    summaryHeadingLevel: args.heading,
    exclude: args.exclude,
    promoteParagraphLabels:
      args.promoteLabels.length > 0
        ? {
            suffixes: args.promoteLabels,
            level: args.promoteLabelsLevel,
          }
        : undefined,
  });

  console.log(
    `${args.dryRun ? "[dry-run] " : ""}${article.slug}: ${flattenedCount} toggle(s) → ${args.heading}` +
      (skippedCount > 0 ? `, ${skippedCount} excluded` : "") +
      (demotionCount > 0 ? `, ${demotionCount} heading(s) demoted` : "") +
      (labelPromotionCount > 0
        ? `, ${labelPromotionCount} label(s) → ${args.promoteLabelsLevel}`
        : ""),
  );

  if (
    flattenedCount === 0 &&
    demotionCount === 0 &&
    labelPromotionCount === 0
  ) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  if (args.dryRun) {
    console.log("");
    console.log("[dry-run] No changes written. Re-run without --dry-run to apply.");
    process.exit(0);
  }

  try {
    const { error: updateErr } = await supabase
      .from("resource_articles")
      .update({
        content_json:
          newValue as unknown as Database["public"]["Tables"]["resource_articles"]["Update"]["content_json"],
      })
      .eq("id", article.id);

    if (updateErr) {
      console.error(`Failed to update ${article.slug}:`, updateErr.message);
      process.exit(1);
    }
  } catch (err) {
    console.error(
      `Network error updating ${article.slug}:`,
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  console.log("");
  console.log(
    `Wrote ${article.slug}. Next: open + close the article in the editor to ` +
      `trigger Algolia reindex (30s idle), or call reindexNativeArticle ` +
      `explicitly. Then run VERIFY in the editorial-pass workflow.`,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
