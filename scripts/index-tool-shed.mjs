/**
 * Bulk index all published Tool Shed entries into Algolia.
 *
 * Usage:
 *   NEXT_PUBLIC_ALGOLIA_APP_ID="..." ALGOLIA_ADMIN_KEY="..." \
 *   NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
 *   node scripts/index-tool-shed.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { algoliasearch } from "algoliasearch";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALGOLIA_APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}
if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
  console.error("Missing NEXT_PUBLIC_ALGOLIA_APP_ID or ALGOLIA_ADMIN_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const algolia = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);

const FORMAT_LABELS = {
  postcard: "Digital Postcard",
  three_two_one: "3-2-1 Model",
  takeover: "10-Minute Takeover",
};

/** Flatten JSONB content to plaintext for search. */
function flattenContent(format, content) {
  switch (format) {
    case "postcard":
      return [
        content.elevator_pitch,
        content.lightbulb_moment,
        content.programme_impact,
        content.golden_nugget,
      ]
        .filter(Boolean)
        .join(" ");
    case "three_two_one":
      return [
        ...(content.three_learned ?? []),
        ...(content.two_changes ?? []),
        content.one_question,
      ]
        .filter(Boolean)
        .join(" ");
    case "takeover":
      return (content.useful_things ?? []).filter(Boolean).join(" ");
    default:
      return "";
  }
}

async function main() {
  console.log("Fetching published Tool Shed entries...");

  const { data: entries, error } = await supabase
    .from("tool_shed_entries")
    .select("id, user_id, format, title, content, event_name, tags, updated_at")
    .eq("is_published", true);

  if (error) {
    console.error("Failed to fetch entries:", error.message);
    process.exit(1);
  }

  if (!entries || entries.length === 0) {
    console.log("No published Tool Shed entries found.");
    process.exit(0);
  }

  console.log(`Found ${entries.length} published entries.`);

  // Fetch author profiles
  const userIds = [...new Set(entries.map((e) => e.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", userIds);

  const profileMap = new Map();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p.preferred_name || p.full_name || "Unknown");
  }

  // Build Algolia records
  const records = entries.map((entry) => ({
    objectID: entry.id,
    entryId: entry.id,
    title: entry.title,
    format: entry.format,
    formatLabel: FORMAT_LABELS[entry.format] ?? entry.format,
    eventName: entry.event_name ?? "",
    tags: entry.tags ?? [],
    content: flattenContent(entry.format, entry.content),
    authorName: profileMap.get(entry.user_id) ?? "Unknown",
    updatedAt: entry.updated_at,
    _type: "tool_shed",
  }));

  console.log(`Indexing ${records.length} entries to Algolia...`);

  await algolia.saveObjects({
    indexName: "tool_shed_entries",
    objects: records,
  });

  console.log(
    `Successfully indexed ${records.length} entries to tool_shed_entries.`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
