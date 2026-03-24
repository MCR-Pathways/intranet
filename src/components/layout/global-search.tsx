"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Command as CommandPrimitive } from "cmdk";
import {
  Search,
  FileText,
  GraduationCap,
  Send,
  Clock,
  X,
} from "lucide-react";
import {
  getSearchClient,
  RESOURCES_INDEX,
  COURSES_INDEX,
  TOOL_SHED_INDEX,
} from "@/lib/algolia";
import type {
  AlgoliaResourceRecord,
  AlgoliaCourseRecord,
  AlgoliaToolShedRecord,
} from "@/lib/algolia";
import { cn, formatDuration } from "@/lib/utils";

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

const RECENT_SEARCHES_KEY = "mcr-recent-searches";
const MAX_RECENT = 5;

interface SearchResults {
  resources: AlgoliaResourceRecord[];
  courses: AlgoliaCourseRecord[];
  toolShed: AlgoliaToolShedRecord[];
}

const EMPTY_RESULTS: SearchResults = {
  resources: [],
  courses: [],
  toolShed: [],
};

// ─── localStorage helpers for recent searches ────────────────────────────────

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const recent = getRecentSearches().filter((s) => s !== trimmed);
    recent.unshift(trimmed);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT))
    );
  } catch {
    // localStorage unavailable
  }
}

function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // localStorage unavailable
  }
}

function removeRecentSearch(query: string) {
  try {
    const recent = getRecentSearches().filter((s) => s !== query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
  } catch {
    // localStorage unavailable
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GlobalSearch() {
  if (!APP_ID || !SEARCH_KEY) return null;
  return <GlobalSearchInner />;
}

function GlobalSearchInner() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Load recent searches when dialog opens
  useEffect(() => {
    if (open) setRecentSearches(getRecentSearches());
  }, [open]);

  // Debounced Algolia multi-index search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(EMPTY_RESULTS);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const client = getSearchClient();
        // Query each index individually — if one index doesn't exist yet
        // (e.g. no courses published), it shouldn't break the others.
        const [resourcesResult, coursesResult, toolShedResult] =
          await Promise.allSettled([
            client.searchSingleIndex({
              indexName: RESOURCES_INDEX,
              searchParams: { query, hitsPerPage: 5, attributesToSnippet: ["content:30"] },
            }),
            client.searchSingleIndex({
              indexName: COURSES_INDEX,
              searchParams: { query, hitsPerPage: 5 },
            }),
            client.searchSingleIndex({
              indexName: TOOL_SHED_INDEX,
              searchParams: { query, hitsPerPage: 5 },
            }),
          ]);
        setResults({
          resources:
            resourcesResult.status === "fulfilled"
              ? (resourcesResult.value.hits as unknown as AlgoliaResourceRecord[])
              : [],
          courses:
            coursesResult.status === "fulfilled"
              ? (coursesResult.value.hits as unknown as AlgoliaCourseRecord[])
              : [],
          toolShed:
            toolShedResult.status === "fulfilled"
              ? (toolShedResult.value.hits as unknown as AlgoliaToolShedRecord[])
              : [],
        });
      } catch {
        setResults(EMPTY_RESULTS);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = useCallback(
    (url: string) => {
      // Save search to recents if there's a query
      if (query.length >= 2) saveRecentSearch(query);
      setOpen(false);
      setQuery("");
      setResults(EMPTY_RESULTS);
      // Use window.location.href for hash URLs so the browser scrolls to the target
      if (url.includes("#")) {
        window.location.href = url;
      } else {
        router.push(url);
      }
    },
    [router, query]
  );

  const handleRecentSelect = useCallback(
    (search: string) => {
      setQuery(search);
    },
    []
  );

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const handleRemoveRecent = useCallback((search: string) => {
    removeRecentSearch(search);
    setRecentSearches((prev) => prev.filter((s) => s !== search));
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setResults(EMPTY_RESULTS);
    }
  }, []);

  const totalResults =
    results.resources.length + results.courses.length + results.toolShed.length;
  const hasQuery = query.length >= 2;

  // Shared item styles
  const itemClassName =
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer select-none outline-none data-[selected=true]:bg-primary/8 transition-colors";

  // Shared group heading styles
  const groupClassName =
    "px-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/70";

  return (
    <>
      {/* Trigger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="relative"
      >
        <Search className="h-5 w-5" />
        <span className="sr-only">Search</span>
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            "overflow-hidden p-0 border-0 max-w-2xl bg-card",
            "shadow-[0_16px_70px_-12px_rgba(0,0,0,0.3)]",
            "top-[28%]",
            "[&>button]:hidden"
          )}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>
              Search across resources, courses, and Tool Shed
            </DialogDescription>
          </VisuallyHidden.Root>

          <CommandPrimitive
            shouldFilter={false}
            className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-card text-foreground"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <CommandPrimitive.Input
                placeholder="Search resources, courses, and insights..."
                value={query}
                onValueChange={setQuery}
                className="flex h-13 w-full bg-transparent py-4 text-[15px] placeholder:text-muted-foreground !outline-none !ring-0"
                style={{ outline: "none", boxShadow: "none" }}
              />
            </div>

            {/* Content */}
            <CommandPrimitive.List className="max-h-[380px] overflow-y-auto overflow-x-hidden py-1">
              {/* ─── Initial state: Recent searches or empty ─── */}
              {!hasQuery && !isSearching && (
                <>
                  {recentSearches.length > 0 ? (
                    <CommandPrimitive.Group
                      heading={
                        <span className="flex items-center justify-between">
                          <span>Recent</span>
                          <button
                            onClick={handleClearRecent}
                            className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground/50 hover:text-foreground transition-colors"
                          >
                            Clear
                          </button>
                        </span>
                      }
                      className={groupClassName}
                    >
                      {recentSearches.map((search) => (
                        <CommandPrimitive.Item
                          key={search}
                          value={`recent-${search}`}
                          onSelect={() => handleRecentSelect(search)}
                          className={itemClassName}
                        >
                          <Clock className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                          <span className="flex-1 text-muted-foreground">
                            {search}
                          </span>
                          <button
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoveRecent(search);
                            }}
                            className="shrink-0 p-0.5 rounded text-muted-foreground/30 hover:text-foreground transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground/50">
                      Search across resources, courses, and insights
                    </div>
                  )}
                </>
              )}

              {/* ─── Empty results ─── */}
              {hasQuery && !isSearching && totalResults === 0 && (
                <CommandPrimitive.Empty className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-10 w-10 mb-3 opacity-15" />
                  <p className="text-sm font-medium">
                    No results for &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground/60">
                    Try a different search term
                  </p>
                </CommandPrimitive.Empty>
              )}

              {/* ─── Loading ─── */}
              {hasQuery && isSearching && totalResults === 0 && (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                  Searching...
                </div>
              )}

              {/* ─── Resources ─── */}
              {results.resources.length > 0 && (
                <CommandPrimitive.Group
                  heading="Resources"
                  className={groupClassName}
                >
                  {results.resources.map((hit) => (
                    <CommandPrimitive.Item
                      key={hit.objectID}
                      value={hit.objectID}
                      onSelect={() =>
                        handleSelect(
                          `/resources/article/${hit.slug}${hit.sectionSlug ? `#${hit.sectionSlug}` : ""}`
                        )
                      }
                      className={itemClassName}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">
                          {hit.title}
                          {hit.sectionHeading && (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              &rsaquo; {hit.sectionHeading}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {hit.categoryName}
                        </p>
                      </div>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}

              {/* ─── Courses ─── */}
              {results.courses.length > 0 && (
                <CommandPrimitive.Group
                  heading="Courses"
                  className={groupClassName}
                >
                  {results.courses.map((hit) => (
                    <CommandPrimitive.Item
                      key={hit.objectID}
                      value={hit.objectID}
                      onSelect={() =>
                        handleSelect(`/learning/courses/${hit.courseId}`)
                      }
                      className={itemClassName}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-50 text-green-600">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{hit.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {hit.categoryLabel}
                          {hit.duration != null &&
                            ` · ${formatDuration(hit.duration)}`}
                        </p>
                      </div>
                      {hit.isRequired && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] shrink-0"
                        >
                          Required
                        </Badge>
                      )}
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}

              {/* ─── Tool Shed ─── */}
              {results.toolShed.length > 0 && (
                <CommandPrimitive.Group
                  heading="Tool Shed"
                  className={groupClassName}
                >
                  {results.toolShed.map((hit) => (
                    <CommandPrimitive.Item
                      key={hit.objectID}
                      value={hit.objectID}
                      onSelect={() => handleSelect(`/learning/tool-shed#${hit.entryId}`)}
                      className={itemClassName}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                        <Send className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{hit.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {hit.authorName}
                          {hit.eventName && ` · ${hit.eventName}`}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] shrink-0"
                      >
                        {hit.formatLabel}
                      </Badge>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}
            </CommandPrimitive.List>

            {/* Footer */}
            <div className="flex items-center gap-5 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground/50">
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border/60 bg-muted/50 px-1 font-mono text-[10px]">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border/60 bg-muted/50 px-1 font-mono text-[10px]">
                  ↵
                </kbd>
                Open
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border/60 bg-muted/50 px-1 font-mono text-[10px]">
                  esc
                </kbd>
                Close
              </span>
            </div>
          </CommandPrimitive>
        </DialogContent>
      </Dialog>
    </>
  );
}
