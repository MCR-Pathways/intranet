import type { Hit } from "@algolia/client-search";
import type {
  AlgoliaResourceRecord,
  AlgoliaCourseRecord,
  AlgoliaPostRecord,
} from "@/lib/algolia";

/** Grouped global-search results — one bucket per Algolia index. */
export interface SearchResults {
  resources: Hit<AlgoliaResourceRecord>[];
  courses: Hit<AlgoliaCourseRecord>[];
  news: Hit<AlgoliaPostRecord>[];
}

/**
 * Scope tabs for the search dropdown — the single source for both the tab row
 * and the SearchScope union (derived below), so the two can't drift apart.
 */
export const SCOPE_TABS = [
  { value: "all", label: "All" },
  { value: "resources", label: "Resources" },
  { value: "courses", label: "Courses" },
  { value: "news", label: "News" },
] as const;

/** Search scope, derived from SCOPE_TABS so adding a tab extends the type. */
export type SearchScope = (typeof SCOPE_TABS)[number]["value"];

/**
 * Narrow grouped results to a single type. "all" returns the input
 * unchanged; any other scope keeps that bucket and empties the rest. Pure —
 * the dropdown renders whichever buckets are non-empty, so emptying hides them.
 */
export function filterResultsByScope(
  results: SearchResults,
  scope: SearchScope,
): SearchResults {
  if (scope === "all") return results;
  return {
    resources: scope === "resources" ? results.resources : [],
    courses: scope === "courses" ? results.courses : [],
    news: scope === "news" ? results.news : [],
  };
}
