#!/usr/bin/env tsx
/**
 * pc-support editorial pass (RAN 2026-06-04, signed off by Colin).
 *
 * Three edits bundled in a single content_json write:
 *   1. Flatten the single `toggle_v2` ("PC Guidebook") to H2 via
 *      `flattenToggleV2`. Promotes the search-target toggle title to a
 *      real heading so Cmd+K can deep-link to it.
 *   2. Rename H2 "Groupwork Resources" → "Groupwork". Resolves the
 *      duplicate H2/H3 naming flagged by the audit (finding #4): the
 *      H2 was the section parent of an H3 "Groupwork Resources",
 *      producing two Algolia records and two TOC entries with the same
 *      label. New shape: H2 "Groupwork" parent + H3 "Planning &
 *      Preparation" + H3 "Groupwork Resources" + H3 "Paper Copies of
 *      Documents".
 *   3. Strip U+200D (zero-width joiner) and related invisible spacing
 *      characters from any H2 that contains them. The "Mentor Journey"
 *      H2 carried a trailing ZWJ from WP source — pure cleanup, the
 *      slug was already correct (slugify strips ZWJ).
 *
 * Retained per the "underscore-prefix scratch scripts stay in the repo
 * as audit trail" convention. Future "how did pc-support get this
 * shape?" investigations can read this file alongside the audit doc.
 *
 * Usage (no longer expected to be run — preserved as audit):
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/_apply-pc-support-edits.ts [--dry-run]
 *
 * Default is `false` (writes apply). Re-running is idempotent: the
 * flatten library is a no-op when there are no toggles, and the
 * rename/ZWJ-strip walks short-circuit on already-clean headings.
 */
import { createClient } from "@supabase/supabase-js";
import { flattenToggleV2 } from "@/lib/wp-migration/flatten-toggle-v2";
import type { Database } from "@/types/database.types";
import type { Value } from "platejs";

type Leaf = { text?: unknown };
type Node = { type?: string; children?: unknown[] };

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const x = node as Leaf & Node;
  if (typeof x.text === "string") return x.text;
  if (!Array.isArray(x.children)) return "";
  return (x.children as unknown[]).map((c) => extractText(c)).join("");
}

interface RenameStats {
  renamedH2GroupworkCount: number;
  zwjStrippedH2MentorCount: number;
  zwjStrippedCharCount: number;
}

// Single source of truth for invisible characters that leak through WP source
// HTML and need stripping from headings: U+200B (ZWSP), U+200C (ZWNJ),
// U+200D (ZWJ), U+FEFF (BOM). Two RegExp literals because `test()` on a
// `/g` regex mutates `lastIndex` between calls — using a non-global regex
// for the gate and a global one for the strip avoids that footgun.
const INVISIBLE_HEADING_CHARS = /[​‌‍﻿]/;
const INVISIBLE_HEADING_CHARS_G = /[​‌‍﻿]/g;

function applyHeadingFixes(value: Value): { value: Value; stats: RenameStats } {
  const stats: RenameStats = {
    renamedH2GroupworkCount: 0,
    zwjStrippedH2MentorCount: 0,
    zwjStrippedCharCount: 0,
  };

  const next = (value as Node[]).map((node) => {
    if (node.type !== "h2") return node;

    const heading = extractText(node).trim();

    if (heading === "Groupwork Resources") {
      stats.renamedH2GroupworkCount++;
      return {
        ...node,
        children: [{ text: "Groupwork" }],
      };
    }

    if (INVISIBLE_HEADING_CHARS.test(heading)) {
      const cleanedChildren = (node.children ?? []).map((child) => {
        if (
          child &&
          typeof child === "object" &&
          typeof (child as Leaf).text === "string"
        ) {
          const original = (child as { text: string }).text;
          const cleaned = original.replace(INVISIBLE_HEADING_CHARS_G, "");
          if (cleaned.length !== original.length) {
            stats.zwjStrippedCharCount += original.length - cleaned.length;
          }
          return { ...(child as object), text: cleaned };
        }
        return child;
      });
      stats.zwjStrippedH2MentorCount++;
      return { ...node, children: cleanedChildren };
    }

    return node;
  });

  return { value: next as Value, stats };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

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

  let data: {
    id: string;
    slug: string;
    content_json: unknown;
  } | null = null;
  try {
    const res = await supabase
      .from("resource_articles")
      .select("id, slug, content_json")
      .eq("slug", "pc-support")
      .eq("content_type", "native")
      .maybeSingle();
    if (res.error) {
      console.error("Failed to fetch pc-support:", res.error.message);
      process.exit(1);
    }
    data = res.data;
  } catch (err) {
    console.error(
      "Network error fetching pc-support:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  if (!data) {
    console.error("pc-support article not found");
    process.exit(1);
  }

  if (!data.content_json || !Array.isArray(data.content_json)) {
    console.error("content_json is missing or not an array");
    process.exit(1);
  }

  const original = data.content_json as Value;

  // 1. Flatten the toggle to H2 (no label promotion needed here)
  const flat = flattenToggleV2(original, { summaryHeadingLevel: "h2" });

  // 2 + 3. H2 rename and ZWJ strip
  const { value: final, stats } = applyHeadingFixes(flat.value);

  // Summary
  console.log(`${dryRun ? "[dry-run] " : ""}pc-support:`);
  console.log(`  · flattened ${flat.flattenedCount} toggle(s) → h2`);
  console.log(`  · renamed ${stats.renamedH2GroupworkCount} H2 "Groupwork Resources" → "Groupwork"`);
  console.log(
    `  · stripped ZWJ/ZWSP from ${stats.zwjStrippedH2MentorCount} H2 (${stats.zwjStrippedCharCount} invisible char(s) removed)`,
  );

  // List end-state H2 + H3 headings for verification
  const endHeadings = (final as Node[])
    .filter((n) => n.type === "h2" || n.type === "h3")
    .map((n) => `${n.type?.toUpperCase()} :: ${extractText(n).trim()}`);
  console.log("");
  console.log("  end-state body headings:");
  for (const h of endHeadings) console.log(`    ${h}`);

  if (dryRun) {
    console.log("");
    console.log("[dry-run] No changes written. Re-run without --dry-run to apply.");
    process.exit(0);
  }

  const totalChanges =
    flat.flattenedCount +
    stats.renamedH2GroupworkCount +
    stats.zwjStrippedH2MentorCount;
  if (totalChanges === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  try {
    const { error: updateErr } = await supabase
      .from("resource_articles")
      .update({
        content_json:
          final as unknown as Database["public"]["Tables"]["resource_articles"]["Update"]["content_json"],
      })
      .eq("id", data.id);

    if (updateErr) {
      console.error("Failed to update pc-support:", updateErr.message);
      process.exit(1);
    }
  } catch (err) {
    console.error(
      "Network error updating pc-support:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  console.log("");
  console.log(
    "Wrote pc-support. Next: scripts/reindex-native-article.ts --slug=pc-support, then VERIFY.",
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
