"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { Search, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FeaturedResources } from "./featured-resources";
import { AdminBar } from "./admin-bar";
import { formatDate } from "@/lib/utils";
import {
  searchArticles,
  type FeaturedArticle,
  type SearchResult,
} from "@/app/(protected)/resources/actions";

interface RecentArticle {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  category_name: string;
  category_slug: string;
}

interface ResourcesLandingProps {
  featuredArticles: FeaturedArticle[];
  recentArticles: RecentArticle[];
}

export function ResourcesLanding({
  featuredArticles,
  recentArticles,
}: ResourcesLandingProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, startSearch] = useTransition();
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);

      // Clear previous timer
      if (debounceTimer) clearTimeout(debounceTimer);

      if (!value.trim() || value.trim().length < 2) {
        setResults([]);
        return;
      }

      // Debounce 300ms
      const timer = setTimeout(() => {
        startSearch(async () => {
          const data = await searchArticles(value);
          setResults(data);
        });
      }, 300);
      setDebounceTimer(timer);
    },
    [debounceTimer]
  );

  const isShowingResults = query.trim().length >= 2;

  return (
    <div className="space-y-6">
      {/* Admin bar — visible when editor mode on */}
      <AdminBar />

      {/* Hero search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search all resources..."
          className="pl-12 py-6 text-[15px] bg-background"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {isSearching && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Search results — replace featured/recent while searching */}
      {isShowingResults ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {isSearching
              ? "Searching..."
              : `${results.length} ${results.length === 1 ? "result" : "results"}`}
          </h2>
          {results.length === 0 && !isSearching ? (
            <p className="text-sm text-muted-foreground py-4">
              No articles match &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            <div className="flex flex-col">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={`/resources/article/${result.slug}`}
                  className="flex items-start gap-3 px-3.5 py-3 rounded-lg hover:bg-muted transition-colors group"
                >
                  <FileText className="h-[18px] w-[18px] text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-foreground">
                      {result.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {result.category_name}
                      <span className="mx-1.5 text-border">&middot;</span>
                      {formatDate(new Date(result.updated_at))}
                    </p>
                    {result.snippet && (
                      <p
                        className="text-xs text-muted-foreground mt-1 line-clamp-2 [&_mark]:bg-amber-100 [&_mark]:text-foreground [&_mark]:rounded-sm [&_mark]:px-0.5"
                        dangerouslySetInnerHTML={{ __html: result.snippet }}
                      />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Featured articles */}
          {featuredArticles.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Key Resources
              </h2>
              <FeaturedResources articles={featuredArticles} />
            </section>
          )}

          {/* Recently updated */}
          {recentArticles.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Recently Updated
              </h2>
              <div className="flex flex-col">
                {recentArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/resources/article/${article.slug}`}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <FileText className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-foreground">
                        {article.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {article.category_name}
                        <span className="mx-1.5 text-border">&middot;</span>
                        {formatDate(new Date(article.updated_at))}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
