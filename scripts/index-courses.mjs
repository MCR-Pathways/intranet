/**
 * Bulk index all published + active courses into Algolia.
 *
 * Usage:
 *   NEXT_PUBLIC_ALGOLIA_APP_ID="..." ALGOLIA_ADMIN_KEY="..." \
 *   NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
 *   node scripts/index-courses.mjs
 *
 * Or with .env.local already loaded via dotenv:
 *   node -e "require('dotenv').config({path:'.env.local'})" scripts/index-courses.mjs
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

const CATEGORY_LABELS = {
  compliance: "Compliance",
  upskilling: "Upskilling",
  soft_skills: "Soft Skills",
};

async function main() {
  console.log("Fetching published + active courses...");

  const { data: courses, error } = await supabase
    .from("courses")
    .select(
      "id, title, description, category, duration_minutes, is_required, updated_at"
    )
    .eq("status", "published")
    .eq("is_active", true);

  if (error) {
    console.error("Failed to fetch courses:", error.message);
    process.exit(1);
  }

  if (!courses || courses.length === 0) {
    console.log("No published courses found.");
    process.exit(0);
  }

  console.log(`Found ${courses.length} published courses.`);

  // Fetch section counts per course
  const courseIds = courses.map((c) => c.id);
  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, course_id")
    .in("course_id", courseIds)
    .eq("is_active", true);

  const sectionCounts = new Map();
  for (const s of sections ?? []) {
    sectionCounts.set(s.course_id, (sectionCounts.get(s.course_id) ?? 0) + 1);
  }

  // Build Algolia records
  const records = courses.map((course) => ({
    objectID: course.id,
    courseId: course.id,
    title: course.title,
    description: course.description ?? "",
    category: course.category,
    categoryLabel: CATEGORY_LABELS[course.category] ?? course.category,
    duration: course.duration_minutes,
    isRequired: course.is_required,
    sectionCount: sectionCounts.get(course.id) ?? 0,
    updatedAt: course.updated_at,
    _type: "course",
  }));

  console.log(`Indexing ${records.length} courses to Algolia...`);

  await algolia.saveObjects({
    indexName: "learning_courses",
    objects: records,
  });

  console.log(
    `Successfully indexed ${records.length} courses to learning_courses.`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
