#!/usr/bin/env node
/**
 * Read-only probe for the WP migration script.
 *
 * Verifies:
 *  1. Programme Resources parent category exists
 *  2. Mentor Training subcategory exists under it
 *  3. Abdulmuiz Adaranijo's profile id (the migration author)
 *  4. Sample native article content_json (so the html-to-plate walker
 *     emits the same vocabulary)
 *  5. Whether a 'mentor-training' article already exists
 *
 * Usage:
 *   set -a; source .env.local; set +a; node scripts/wp-migration/probe-ids.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("Source .env.local first:  set -a; source .env.local; set +a");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== 1. Programme Resources parent category ===");
const { data: parentCat, error: parentErr } = await supabase
  .from("resource_categories")
  .select("id, name, slug, sort_order")
  .eq("slug", "programme-resources")
  .is("deleted_at", null)
  .single();
if (parentErr) {
  console.error("  ERROR:", parentErr.message);
  process.exit(1);
}
console.log("  ", parentCat);

console.log("\n=== 2. Mentor Training subcategory ===");
const { data: mentorCat, error: mentorErr } = await supabase
  .from("resource_categories")
  .select("id, name, slug, parent_id, sort_order, visibility")
  .eq("slug", "mentor-training")
  .eq("parent_id", parentCat.id)
  .is("deleted_at", null)
  .single();
if (mentorErr) {
  console.error("  ERROR:", mentorErr.message);
  console.error("  Mentor Training subcat MISSING under Programme Resources.");
  process.exit(1);
}
console.log("  ", mentorCat);

console.log("\n=== 3. Abdulmuiz Adaranijo profile ===");
const { data: profile, error: profileErr } = await supabase
  .from("profiles")
  .select("id, email, full_name, user_type, is_external")
  .eq("email", "abdulmuiz.adaranijo@mcrpathways.org")
  .single();
if (profileErr) {
  console.error("  ERROR:", profileErr.message);
  process.exit(1);
}
console.log("  ", profile);

console.log("\n=== 4. Sample existing native articles (for content_json shape) ===");
const { data: sampleArticles, error: sampleErr } = await supabase
  .from("resource_articles")
  .select("id, slug, title, content_type, status, content_json")
  .eq("content_type", "native")
  .is("deleted_at", null)
  .order("updated_at", { ascending: false })
  .limit(3);
if (sampleErr) {
  console.error("  ERROR:", sampleErr.message);
} else {
  for (const a of sampleArticles ?? []) {
    console.log(`\n  - ${a.title}  (slug=${a.slug}, status=${a.status})`);
    if (Array.isArray(a.content_json)) {
      // Collect node types used + show first 3 nodes verbatim
      const types = new Set();
      const collectTypes = (nodes) => {
        if (!Array.isArray(nodes)) return;
        for (const n of nodes) {
          if (n && typeof n === "object" && typeof n.type === "string") {
            types.add(n.type);
          }
          if (n && Array.isArray(n.children)) collectTypes(n.children);
        }
      };
      collectTypes(a.content_json);
      console.log("    node types used:", [...types].sort().join(", "));
      console.log("    first 3 nodes (verbatim):");
      console.log(
        "    " +
          JSON.stringify(a.content_json.slice(0, 3), null, 2)
            .split("\n")
            .join("\n    "),
      );
    } else {
      console.log("    content_json is not an array:", a.content_json);
    }
  }
}

console.log("\n=== 5. Existing 'mentor-training' slug usage ===");
const { data: existingArt } = await supabase
  .from("resource_articles")
  .select("id, slug, title, status, content_type, category_id")
  .eq("slug", "mentor-training")
  .limit(5);
if (existingArt && existingArt.length > 0) {
  console.log("  EXISTS (script will upsert):");
  for (const a of existingArt) {
    console.log("  ", a);
  }
} else {
  console.log("  (none — script will INSERT a new article)");
}

console.log("\n=== Summary for migration script ===");
console.log(`  PROGRAMME_RESOURCES_ID = ${parentCat.id}`);
console.log(`  MENTOR_TRAINING_CATEGORY_ID = ${mentorCat.id}`);
console.log(`  AUTHOR_PROFILE_ID = ${profile.id}`);
console.log(`  DRIVE_ROOT_FOLDER_ID = 1u0nCOG8fvuw81lRrKXDwbHtuvaT2O-q5  (MCR Intranet Attachments)`);
console.log(`  DRIVE_SUBFOLDER_PATH = ["Resources", "mentor-training"]`);
