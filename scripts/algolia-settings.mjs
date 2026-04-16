/**
 * Push Algolia index settings from code.
 * Run after changing search configuration.
 *
 * Usage:
 *   NEXT_PUBLIC_ALGOLIA_APP_ID="..." ALGOLIA_ADMIN_KEY="..." \
 *   node scripts/algolia-settings.mjs
 */

import { algoliasearch } from "algoliasearch";

const ALGOLIA_APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;

if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
  console.error("Missing NEXT_PUBLIC_ALGOLIA_APP_ID or ALGOLIA_ADMIN_KEY");
  process.exit(1);
}

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);

const INDICES = {
  resources_articles: {
    searchableAttributes: ["title", "sectionHeading", "content"],
    attributesToSnippet: ["content:30"],
    attributesToHighlight: ["title", "sectionHeading", "content"],
    attributeForDistinct: "articleId",
    distinct: true,
  },
  learning_courses: {
    searchableAttributes: ["title", "description", "categoryLabel"],
    attributesToHighlight: ["title", "description"],
  },
  tool_shed_entries: {
    searchableAttributes: ["title", "eventName", "tags", "content"],
    attributesToSnippet: ["content:20"],
    attributesToHighlight: ["title", "eventName", "content"],
  },
};

for (const [indexName, settings] of Object.entries(INDICES)) {
  try {
    await client.setSettings({ indexName, indexSettings: settings });
    console.log(`Done: ${indexName}`);
  } catch (error) {
    console.error(`Failed: ${indexName} — ${error.message}`);
  }
}

console.log("\nSettings applied. May take a few seconds to propagate.");
