#!/usr/bin/env tsx
/**
 * people-services editorial pass: read-only inspection of the walker
 * output (ran 2026-06-04 immediately after migrate-wp-page.ts). Prints
 * top-level node sequence + walks every toggle_v2 body so the editor
 * PLAN can be written against verified structure rather than guessed.
 *
 * Retained per the "underscore-prefix scratch scripts stay in the repo
 * as audit trail" convention.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/_inspect-people-services.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Node = { type?: string; children?: unknown[]; [k: string]: unknown };

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const x = node as { text?: unknown; children?: unknown[] };
  if (typeof x.text === "string") return x.text;
  if (!Array.isArray(x.children)) return "";
  return (x.children as unknown[]).map((c) => extractText(c)).join("");
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

  let data: {
    id: string;
    slug: string;
    content_json: unknown;
  } | null = null;
  try {
    const res = await supabase
      .from("resource_articles")
      .select("id, slug, content_json")
      .eq("slug", "people-services")
      .eq("content_type", "native")
      .maybeSingle();
    if (res.error) {
      console.error("Failed to fetch people-services:", res.error.message);
      process.exit(1);
    }
    data = res.data;
  } catch (err) {
    console.error(
      "Network error fetching people-services:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  if (!data) {
    console.error("people-services article not found");
    process.exit(1);
  }

  const json = data.content_json;
  if (!Array.isArray(json)) {
    console.error("content_json is not an array");
    process.exit(1);
  }

  console.log(`# Top-level nodes (${json.length})`);
  console.log("");
  json.forEach((n, i) => {
    const node = n as Node;
    const t = node.type ?? "?";
    const tx = extractText(node).slice(0, 80).replace(/\s+/g, " ");
    console.log(`[${i.toString().padStart(2)}] ${t.padEnd(20)} :: ${tx}`);
  });

  console.log("");
  console.log("# Per-toggle body inspection");
  json.forEach((n, i) => {
    const node = n as Node;
    if (node.type !== "toggle_v2") return;
    console.log("");
    console.log(`## [${i}] toggle_v2`);
    const children = (node.children ?? []) as Node[];
    children.forEach((c, j) => {
      const t = c.type ?? "?";
      const tx = extractText(c).slice(0, 90).replace(/\s+/g, " ");
      const childTypes = ((c.children ?? []) as Node[])
        .map((cc) => (cc as Node).type ?? "leaf")
        .join("+");
      console.log(
        `  [${j.toString().padStart(2)}] ${t.padEnd(20)} (children: ${childTypes.padEnd(30)}) :: ${tx}`,
      );
    });
  });

  // Counts
  console.log("");
  console.log("# Counts");
  const counts: Record<string, number> = {};
  json.forEach((n) => {
    const t = (n as Node).type ?? "?";
    counts[t] = (counts[t] ?? 0) + 1;
  });
  for (const [k, v] of Object.entries(counts).sort()) {
    console.log(`  ${k}: ${v}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
