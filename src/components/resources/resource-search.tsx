"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  InstantSearch,
  SearchBox,
  useHits,
  useInstantSearch,
  useSearchBox,
} from "react-instantsearch";
import { getSearchClient, RESOURCES_INDEX } from "@/lib/algolia";
import type { AlgoliaResourceRecord } from "@/lib/algolia";

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

/** Algolia-powered search for the Resources landing page. */
export function ResourceSearch() {
  // If Algolia isn't configured, show a static search input
  if (!APP_ID || !SEARCH_KEY) {
    return (
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search all resources..."
          className="pl-12 py-6 text-[15px] bg-background"
          disabled
        />
      </div>
    );
  }

  return (
    <SearchErrorBoundary>
      <AlgoliaSearch />
    </SearchErrorBoundary>
  );
}

function AlgoliaSearch() {
  const searchClient = getSearchClient();

  return (
    <InstantSearch searchClient={searchClient} indexName={RESOURCES_INDEX}>
      <SearchInput />
      <SearchResults />
    </InstantSearch>
  );
}

function SearchInput() {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10" />
      <SearchBox
        placeholder="Search all resources..."
        classNames={{
          root: "[&_.ais-SearchBox-form]:relative [&_.ais-SearchBox-form]:border-0 [&_.ais-SearchBox-form]:shadow-none [&_.ais-SearchBox-form]:bg-transparent",
          form: "relative !border-0 !shadow-none",
          input:
            "w-full rounded-lg border border-input bg-background pl-12 pr-4 py-3.5 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring !outline-none",
          submit: "hidden",
          reset: "hidden",
          loadingIndicator: "hidden",
        }}
      />
    </div>
  );
}

function SearchResults() {
  const { query } = useSearchBox();
  const { hits } = useHits<AlgoliaResourceRecord>();
  const { status, error } = useInstantSearch();

  if (!query || query.length < 2) return null;

  // Algolia RetryError is async — ErrorBoundary can't catch it.
  // Detect via useInstantSearch() status instead.
  if (status === "error" || error) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Search is temporarily unavailable. Please browse categories instead.
      </p>
    );
  }

  return (
    <section className="mt-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {hits.length} {hits.length === 1 ? "result" : "results"}
      </h2>
      {hits.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No articles match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="flex flex-col">
          {hits.map((hit) => (
            <Link
              key={hit.objectID}
              href={`/resources/article/${hit.slug}${hit.sectionSlug ? `#${hit.sectionSlug}` : ""}`}
              className="flex items-start gap-3 px-3.5 py-3 rounded-lg hover:bg-muted transition-colors group"
            >
              <FileText className="h-[18px] w-[18px] text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-foreground">
                  {hit.title}
                  {hit.sectionHeading && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      &rsaquo; {hit.sectionHeading}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {hit.categoryName}
                </p>
                {(hit._snippetResult?.content as { value?: string } | undefined)
                  ?.value && (
                  <p
                    className="text-xs text-muted-foreground mt-1 line-clamp-2 [&_mark]:bg-amber-100 [&_mark]:text-foreground [&_mark]:rounded-sm [&_mark]:px-0.5"
                    dangerouslySetInnerHTML={{
                      __html: (
                        hit._snippetResult!.content as { value: string }
                      ).value,
                    }}
                  />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Error boundary — graceful fallback if Algolia is unreachable ────────────

interface ErrorBoundaryState {
  hasError: boolean;
}

class SearchErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search all resources..."
            className="pl-12 py-6 text-[15px] bg-background"
            disabled
          />
        </div>
      );
    }
    return this.props.children;
  }
}
