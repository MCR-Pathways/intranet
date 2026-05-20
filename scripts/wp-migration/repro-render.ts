#!/usr/bin/env tsx
/**
 * Reproduce the article render outside Next.js to surface the actual error.
 * Runs the same prepareNativeArticle pipeline the view component uses
 * (nestToggleChildren → addHeadingIds → addStableNodeIds → createStaticEditor),
 * then attempts the SAME PlateStatic invocation. Any thrown error surfaces here
 * with full stack — no dev-server log digging required.
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/wp-migration/repro-render.ts <slug>
 */
import { createClient } from "@supabase/supabase-js";
import type { Value } from "platejs";
import type { Database } from "@/types/database.types";
import { prepareNativeArticle } from "@/lib/plate-static-plugins";

async function main() {
  const slug = process.argv[2];
  if (!slug) { console.error("usage: repro-render.ts <slug>"); process.exit(1); }

  const sb = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data, error } = await sb
    .from("resource_articles")
    .select("id, slug, content_json")
    .eq("slug", slug)
    .single();
  if (error || !data) { console.error("read failed:", error?.message); process.exit(1); }

  const contentJson = (data as unknown as { content_json: unknown }).content_json;
  if (!Array.isArray(contentJson)) {
    console.error("content_json is not an array");
    process.exit(1);
  }
  console.log(`Slug: ${data.slug}`);
  console.log(`Top-level nodes: ${contentJson.length}`);

  try {
    const { editor, headings } = prepareNativeArticle(contentJson as unknown as Value);
    console.log(`prepareNativeArticle OK`);
    console.log(`Editor children: ${editor?.children?.length ?? "(null editor)"}`);
    console.log(`Headings extracted: ${headings.length}`);
    if (headings.length > 0) {
      console.log("Heading list:");
      for (const h of headings) console.log(`  - slug=${h.slug} level=${h.level} : "${h.text}"`);
    }
  } catch (err) {
    console.error("prepareNativeArticle THREW:");
    console.error(err instanceof Error ? err.stack : String(err));
    process.exit(2);
  }

  // Now try the actual static HTML serialisation (the same call publishAndIndex makes).
  // If PlateStatic-equivalent server-side serialisation crashes, this is where we'd see it.
  try {
    const { serialiseContentToHtml } = await import("@/lib/resource-publish");
    const html = await serialiseContentToHtml(contentJson);
    if (html === null) {
      console.error("serialiseContentToHtml returned null (serialisation error)");
      process.exit(2);
    }
    console.log(`\nserialiseContentToHtml OK: ${html.length} bytes`);
    console.log(`First 200 chars: ${html.slice(0, 200).replace(/\n/g, " ")}`);
  } catch (err) {
    console.error("\nserialiseContentToHtml THREW:");
    console.error(err instanceof Error ? err.stack : String(err));
    process.exit(2);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
});
