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

/** The scope tabs offered in the search dropdown. */
export type SearchScope = "all" | "resources" | "courses" | "news";

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
