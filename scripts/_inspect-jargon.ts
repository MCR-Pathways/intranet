#!/usr/bin/env tsx
/**
 * Read-only inspection of the jargon article's content_json shape, to
 * ground the editorial-pass decisions in the actual current state
 * (don't trust the 2026-05-20 audit's "170 flat paragraphs" claim —
 * verify it). Counts headings, paragraphs, empty-href anchors (the
 * walker-preserved WP jump anchors), and identifies the section
 * boundaries.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/_inspect-jargon.ts
 *
 * Scratch script — delete after the jargon pass is signed off (or
 * retain per the underscore-prefix convention if it becomes useful).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Node = { type?: string; children?: unknown[]; url?: unknown };

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const x = node as { text?: unknown; children?: unknown[] };
  if (typeof x.text === "string") return x.text;
  if (!Array.isArray(x.children)) return "";
  return (x.children as unknown[]).map((c) => extractText(c)).join("");
}

function anchorInfo(node: Node): { count: number; emptyHref: number } {
  let count = 0;
  let emptyHref = 0;
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const x = n as Node;
    if (x.type === "a") {
      count++;
      const href = typeof x.url === "string" ? x.url.trim() : "";
      if (!href) emptyHref++;
    }
    if (Array.isArray(x.children)) x.children.forEach(walk);
  };
  walk(node);
  return { count, emptyHref };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing env vars");
    process.exit(2);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let data: { id: string; slug: string; content_json: unknown } | null = null;
  try {
    const res = await supabase
      .from("resource_articles")
      .select("id, slug, content_json")
      .eq("slug", "jargon")
      .eq("content_type", "native")
      .maybeSingle();
    if (res.error) {
      console.error("Failed to fetch jargon:", res.error.message);
      process.exit(1);
    }
    data = res.data;
  } catch (err) {
    console.error(
      "Network error fetching jargon:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  if (!data) {
    console.error("jargon article not found");
    process.exit(1);
  }

  const json = data.content_json;
  if (!Array.isArray(json)) {
    console.error("content_json is not an array");
    process.exit(1);
  }

  // Counts
  const counts: Record<string, number> = {};
  let emptyHrefAnchors = 0;
  let realHrefAnchors = 0;
  (json as Node[]).forEach((n) => {
    const t = n.type ?? "?";
    counts[t] = (counts[t] ?? 0) + 1;
    const { emptyHref, count } = anchorInfo(n);
    emptyHrefAnchors += emptyHref;
    realHrefAnchors += count - emptyHref;
  });

  console.log(`# jargon content_json — ${json.length} top-level nodes`);
  console.log("");
  console.log("Node type counts:");
  for (const [k, v] of Object.entries(counts).sort()) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("");
  console.log(`Anchors: ${emptyHrefAnchors} empty-href (WP jump anchors), ${realHrefAnchors} real-href`);
  console.log("");

  // First 40 nodes, abbreviated, to see the term/definition rhythm + section breaks
  console.log("First 40 nodes (type :: text, [A]=has empty-href anchor):");
  (json as Node[]).slice(0, 40).forEach((n, i) => {
    const t = n.type ?? "?";
    const { emptyHref } = anchorInfo(n);
    const marker = emptyHref > 0 ? "[A]" : "   ";
    const tx = extractText(n).slice(0, 70).replace(/\s+/g, " ");
    console.log(`  [${i.toString().padStart(3)}] ${marker} ${t.padEnd(8)} :: ${tx}`);
  });

  // Identify headings (section boundaries)
  console.log("");
  console.log("Headings (section structure):");
  (json as Node[]).forEach((n, i) => {
    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(n.type ?? "")) {
      console.log(`  [${i}] ${(n.type ?? "").toUpperCase()} :: ${extractText(n).trim()}`);
    }
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
