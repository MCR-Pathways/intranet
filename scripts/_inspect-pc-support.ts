#!/usr/bin/env tsx
/**
 * pc-support editorial pass: read-only inspection of the article's
 * content_json shape (ran 2026-06-04). Prints the top-level node
 * sequence and walks every `toggle_v2` body so the PLAN can be
 * written against verified structure rather than guessed.
 *
 * Retained per the "underscore-prefix scratch scripts stay in the repo
 * as audit trail" convention — re-runnable against the live article
 * any time for "what's currently in pc-support?" investigations.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/_inspect-pc-support.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Node = { type?: string; children?: unknown[]; [k: string]: unknown };

function text(n: Node | unknown): string {
  if (!n || typeof n !== "object") return "";
  const x = n as Node;
  const t = (x as { text?: unknown }).text;
  if (typeof t === "string") return t;
  if (!Array.isArray(x.children)) return "";
  return (x.children as unknown[]).map((c) => text(c)).join("");
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

  const { data, error } = await supabase
    .from("resource_articles")
    .select("id, slug, content_json")
    .eq("slug", "pc-support")
    .eq("content_type", "native")
    .maybeSingle();

  if (error || !data) {
    console.error("Article not found:", error?.message);
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
    const tx = text(node).slice(0, 70).replace(/\s+/g, " ");
    console.log(`[${i.toString().padStart(2)}] ${t.padEnd(20)} :: ${tx}`);
  });

  // Walk every toggle_v2's body
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
      const tx = text(c).slice(0, 90).replace(/\s+/g, " ");
      const childTypes = ((c.children ?? []) as Node[])
        .map((cc) => (cc as Node).type ?? "leaf")
        .join("+");
      console.log(
        `  [${j.toString().padStart(2)}] ${t.padEnd(20)} (children: ${childTypes.padEnd(20)}) :: ${tx}`,
      );
    });
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
