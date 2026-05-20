import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

async function main() {
  const slug = process.argv[2];
  if (!slug) { console.error("usage: probe-content.ts <slug>"); process.exit(1); }
  const sb = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb.from("resource_articles").select("content_json").eq("slug", slug).single();
  if (error || !data) { console.error("err:", error); process.exit(1); }
  const json = data.content_json as Array<{ type: string; url?: string; children?: Array<{ type?: string; text?: string; url?: string; children?: Array<{ text?: string }> }> }>;
  console.log("Top-level nodes:", json.length);
  console.log("--- Type histogram ---");
  const typeCounts = new Map<string, number>();
  for (const n of json) typeCounts.set(n.type, (typeCounts.get(n.type) ?? 0) + 1);
  for (const [t, c] of typeCounts) console.log(`  ${t}: ${c}`);
  console.log("--- Heading nodes ---");
  json.forEach((n, i) => {
    if (/^h[1-6]$/.test(n.type)) {
      const text = (n.children || []).map((c) => c.text || (c.children || []).map((cc) => cc.text || "").join("") || "").join("");
      console.log(`  [${i}] ${n.type} — "${text}" — full JSON keys: ${Object.keys(n).join(", ")}`);
      console.log(`        full node: ${JSON.stringify(n).slice(0, 300)}`);
    }
  });
  console.log("--- Node types (positional) ---");
  json.forEach((n, i) => {
    const text = (n.children || []).map((c) => c.text || (c.children || []).map((cc) => cc.text || "").join("") || "").join("");
    const inlineLinks = (n.children || []).filter((c) => c.type === "a");
    const preview = text.length > 80 ? text.slice(0, 80) + "…" : text;
    console.log(`  [${i}] ${n.type}${(n as { url?: string }).url ? ` (url: ${(n as { url?: string }).url})` : ""}${inlineLinks.length ? ` (${inlineLinks.length} inline <a>)` : ""}`);
    if (preview) console.log(`        text: "${preview}"`);
    if (inlineLinks.length) {
      inlineLinks.forEach((a) => {
        const linkText = (a.children || []).map((c) => c.text || "").join("");
        console.log(`        → "${linkText}" → ${a.url}`);
      });
    }
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
