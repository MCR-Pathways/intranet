#!/usr/bin/env tsx
/**
 * Bulk index all news posts into Algolia (excludes kudos + weekly round-ups).
 * One-off backfill; the runtime keeps the index fresh via the post actions.
 * Shares `buildPostRecord` with the runtime indexer so the two can't drift.
 *
 * Usage (run from project root):
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/index-posts.ts
 */
import { createClient } from "@supabase/supabase-js";
import { algoliasearch } from "algoliasearch";
import {
  buildPostRecord,
  resolveSearchAuthorName,
  NEWS_INDEX,
} from "@/lib/algolia";
import type { Database } from "@/types/database.types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALGOLIA_APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
  console.error("Missing NEXT_PUBLIC_ALGOLIA_APP_ID or ALGOLIA_ADMIN_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
const algolia = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);

async function main() {
  console.log("Fetching news posts...");

  const { data: posts, error } = await supabase
    .from("posts")
    .select(
      "id, content, poll_question, created_at, author:profiles!author_id(full_name, preferred_name)"
    )
    .eq("post_type", "news")
    .eq("is_weekly_roundup", false);

  if (error) {
    console.error("Failed to fetch posts:", error.message);
    process.exit(1);
  }
  if (!posts || posts.length === 0) {
    console.log("No news posts found.");
    process.exit(0);
  }

  console.log(`Found ${posts.length} news posts.`);

  const records = posts.map((post) =>
    buildPostRecord({
      postId: post.id,
      content: post.content ?? "",
      pollQuestion: post.poll_question,
      authorName: resolveSearchAuthorName(post.author),
      createdAt: post.created_at,
    })
  );

  console.log(`Indexing ${records.length} posts to Algolia...`);
  await algolia.saveObjects({
    indexName: NEWS_INDEX,
    objects: records as unknown as Record<string, unknown>[],
  });
  console.log(`Successfully indexed ${records.length} posts to ${NEWS_INDEX}.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
