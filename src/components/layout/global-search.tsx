"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Command as CommandPrimitive } from "cmdk";
import {
  Search,
  FileText,
  GraduationCap,
  Newspaper,
  Clock,
  X,
} from "lucide-react";
import {
  getSearchClient,
  RESOURCES_INDEX,
  COURSES_INDEX,
  NEWS_INDEX,
} from "@/lib/algolia";
import type {
  AlgoliaResourceRecord,
  AlgoliaCourseRecord,
  AlgoliaPostRecord,
} from "@/lib/algolia";
import {
  filterResultsByScope,
  SCOPE_TABS,
  type SearchResults,
  type SearchScope,
} from "@/lib/search-scope";
import { cn, formatDuration, timeAgo } from "@/lib/utils";
import { getRecentlyViewed } from "@/lib/recently-viewed";

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

const RECENT_SEARCHES_KEY = "mcr-recent-searches";
const MAX_RECENT = 5;

const EMPTY_RESULTS: SearchResults = {
  resources: [],
  courses: [],
  news: [],
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

// Algolia snippet values are HTML (Algolia's <mark> tags plus entity-escaped
// text). dangerouslySetInnerHTML decodes the entities when rendering, but a raw
// title attribute would show them literally, so strip the tags and decode the
// common entities for the hover tooltip. Decode &amp; LAST so an escaped entity
// like &amp;lt; doesn't double-decode into <.
function snippetToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
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
  const [activeScope, setActiveScope] = useState<SearchScope>("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<
    Array<{ id: string; title: string; slug: string }>
  >([]);
  const [isMac, setIsMac] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Monotonic token guarding against an older in-flight Algolia response
  // landing after a newer one and overwriting fresher results.
  const searchSeqRef = useRef(0);

  // Platform-specific shortcut hint (⌘ on Mac, Ctrl elsewhere). Computed after
  // mount to avoid an SSR/client mismatch; suppressHydrationWarning on the node.
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  // Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows/Linux) focuses the bar.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Custom event: lets other components open search programmatically
  // (the resources landing page dispatches it).
  useEffect(() => {
    function handleOpenSearch() {
      inputRef.current?.focus();
      setOpen(true);
    }
    document.addEventListener("open-global-search", handleOpenSearch);
    return () =>
      document.removeEventListener("open-global-search", handleOpenSearch);
  }, []);

  // While open, close on Escape or a click outside the bar + panel — both keep
  // the typed query. Document-level so Escape fires wherever focus sits (the
  // input, a scope tab, a result); cmdk's root keydown has no Escape case.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        (document.activeElement as HTMLElement | null)?.blur();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  // Load recent searches + recently viewed, and reset the scope, on open.
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setRecentlyViewed(getRecentlyViewed());
      setActiveScope("all");
    }
  }, [open]);

  // Debounced Algolia multi-index search
  useEffect(() => {
    const seq = ++searchSeqRef.current;
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
        // (e.g. no courses published, or news not backfilled), it shouldn't
        // break the others.
        const [resourcesResult, coursesResult, newsResult] =
          await Promise.allSettled([
            client.searchSingleIndex<AlgoliaResourceRecord>({
              indexName: RESOURCES_INDEX,
              searchParams: { query, hitsPerPage: 5 },
            }),
            client.searchSingleIndex<AlgoliaCourseRecord>({
              indexName: COURSES_INDEX,
              searchParams: { query, hitsPerPage: 5 },
            }),
            client.searchSingleIndex<AlgoliaPostRecord>({
              indexName: NEWS_INDEX,
              searchParams: { query, hitsPerPage: 5 },
            }),
          ]);
        // A newer keystroke superseded this request mid-flight — drop the
        // stale response rather than overwrite the fresher results.
        if (seq !== searchSeqRef.current) return;
        setResults({
          resources:
            resourcesResult.status === "fulfilled"
              ? resourcesResult.value.hits
              : [],
          courses:
            coursesResult.status === "fulfilled"
              ? coursesResult.value.hits
              : [],
          news: newsResult.status === "fulfilled" ? newsResult.value.hits : [],
        });
      } catch {
        if (seq === searchSeqRef.current) setResults(EMPTY_RESULTS);
      } finally {
        if (seq === searchSeqRef.current) setIsSearching(false);
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
      inputRef.current?.blur();
      // Use window.location.href for hash URLs so the browser scrolls to the target
      if (url.includes("#")) {
        window.location.href = url;
      } else {
        router.push(url);
      }
    },
    [router, query]
  );

  const handleRecentSelect = useCallback((search: string) => {
    setQuery(search);
    inputRef.current?.focus();
  }, []);

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const handleRemoveRecent = useCallback((search: string) => {
    removeRecentSearch(search);
    setRecentSearches((prev) => prev.filter((s) => s !== search));
  }, []);

  // Close when focus leaves the bar + panel entirely (keyboard Tab-out). A
  // result item isn't focusable, so clicking one blurs the input with a null
  // relatedTarget — guard on relatedTarget so the click still registers.
  const handleContainerBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && !containerRef.current?.contains(next)) {
      setOpen(false);
    }
  }, []);

  const shown = filterResultsByScope(results, activeScope);
  const totalResults =
    results.resources.length + results.courses.length + results.news.length;
  // Count within the active scope — the empty/loading states key off this, so
  // a scope with no matches shows "no results" rather than a blank panel.
  const shownTotal =
    shown.resources.length + shown.courses.length + shown.news.length;
  const hasQuery = query.length >= 2;
  const activeLabel =
    SCOPE_TABS.find((t) => t.value === activeScope)?.label ?? "All";

  // Shared item styles
  const itemClassName =
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer select-none outline-none data-[selected=true]:bg-primary/8 transition-colors";

  // Shared group heading styles
  const groupClassName =
    "px-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/70";

  return (
    <div
      ref={containerRef}
      onBlur={handleContainerBlur}
      className="relative w-full"
    >
      <CommandPrimitive shouldFilter={false} className="w-full text-foreground">
        {/* The bar — recessed warm fill on the white header, lifts to card on focus */}
        <div className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-input bg-muted px-3.5 transition-colors focus-within:border-ring/40 focus-within:bg-card focus-within:shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <CommandPrimitive.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            onFocus={() => setOpen(true)}
            placeholder="Search resources, courses and news"
            aria-label="Search resources, courses and news"
            className="h-full w-full bg-transparent text-sm placeholder:text-muted-foreground !outline-none !ring-0"
            style={{ outline: "none", boxShadow: "none" }}
          />
          {!open && !query && (
            <kbd
              suppressHydrationWarning
              className="pointer-events-none hidden shrink-0 select-none items-center rounded border border-border/70 bg-card px-1.5 font-mono text-[10px] text-muted-foreground/70 sm:inline-flex"
            >
              {isMac ? "⌘K" : "Ctrl K"}
            </kbd>
          )}
        </div>

        {/* Anchored dropdown — kept mounted (hidden when closed) so cmdk's
            aria-controls always resolves to the listbox. cmdk hardcodes the
            input's aria-expanded; that inline-combobox quirk is unavoidable. */}
        <div
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-border bg-popover shadow-[0_16px_50px_-12px_rgba(0,0,0,0.25)]",
            !open && "hidden"
          )}
        >
            {/* Scope tabs — only when there are results to narrow */}
            {hasQuery && (
              <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5">
                {SCOPE_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    // Keep caret focus in the input so arrow-key nav stays live
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setActiveScope(tab.value);
                      // Keyboard activation leaves focus on the tab; return it
                      // to the input so arrow-nav over results resumes.
                      inputRef.current?.focus();
                    }}
                    aria-pressed={activeScope === tab.value}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      activeScope === tab.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <CommandPrimitive.List className="max-h-[min(60vh,420px)] overflow-y-auto overflow-x-hidden py-1">
              {/* ─── Initial state: Recent searches or empty ─── */}
              {!hasQuery && !isSearching && (
                <>
                  {recentlyViewed.length > 0 && (
                    <CommandPrimitive.Group
                      heading="Recently viewed"
                      className={groupClassName}
                    >
                      {recentlyViewed.map((item) => (
                        <CommandPrimitive.Item
                          key={item.id}
                          value={`viewed-${item.id}`}
                          onSelect={() =>
                            handleSelect(`/resources/article/${item.slug}`)
                          }
                          className={itemClassName}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                            <FileText className="h-4 w-4" />
                          </div>
                          <span
                            className="flex-1 truncate font-medium"
                            title={item.title}
                          >
                            {item.title}
                          </span>
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                  )}

                  {recentSearches.length > 0 ? (
                    <CommandPrimitive.Group
                      heading={
                        <span className="flex items-center justify-between">
                          <span>Recent searches</span>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
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
                            type="button"
                            aria-label={`Remove "${search}" from recent searches`}
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
                  ) : recentlyViewed.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground/50">
                      Search across resources, courses and news
                    </div>
                  ) : null}
                </>
              )}

              {/* ─── Empty results (for the active scope) ─── */}
              {hasQuery && !isSearching && shownTotal === 0 && (
                <CommandPrimitive.Empty className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Search className="h-10 w-10 mb-3 opacity-15" />
                  <p className="text-sm font-medium">
                    No results for &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground/60">
                    {activeScope !== "all" && totalResults > 0
                      ? `No matches under ${activeLabel} — try the All tab`
                      : "Try a different search term"}
                  </p>
                </CommandPrimitive.Empty>
              )}

              {/* ─── Loading ─── */}
              {hasQuery && isSearching && shownTotal === 0 && (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                  Searching...
                </div>
              )}

              {/* ─── Resources ─── */}
              {shown.resources.length > 0 && (
                <CommandPrimitive.Group
                  heading="Resources"
                  className={groupClassName}
                >
                  {shown.resources.map((hit) => (
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
                        <p
                          className="truncate font-medium"
                          title={
                            hit.sectionHeading
                              ? `${hit.title} › ${hit.sectionHeading}`
                              : hit.title
                          }
                        >
                          {hit.title}
                          {hit.sectionHeading && (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              &rsaquo; {hit.sectionHeading}
                            </span>
                          )}
                        </p>
                        <p
                          className="text-xs text-muted-foreground truncate"
                          title={hit.categoryName}
                        >
                          {hit.categoryName}
                        </p>
                        {(hit._snippetResult?.content as { value?: string } | undefined)
                          ?.value && (
                          <p
                            className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1 [&_mark]:bg-amber-200/60 [&_mark]:text-foreground [&_mark]:rounded-sm [&_mark]:px-0.5"
                            title={snippetToPlainText(
                              (hit._snippetResult!.content as { value: string }).value
                            )}
                            dangerouslySetInnerHTML={{
                              __html: (hit._snippetResult!.content as { value: string }).value,
                            }}
                          />
                        )}
                      </div>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}

              {/* ─── Courses ─── */}
              {shown.courses.length > 0 && (
                <CommandPrimitive.Group
                  heading="Courses"
                  className={groupClassName}
                >
                  {shown.courses.map((hit) => (
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
                        <p className="truncate font-medium" title={hit.title}>{hit.title}</p>
                        <p
                          className="text-xs text-muted-foreground truncate"
                          title={
                            hit.categoryLabel +
                            (hit.duration != null
                              ? ` · ${formatDuration(hit.duration)}`
                              : "")
                          }
                        >
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

              {/* ─── News ─── */}
              {shown.news.length > 0 && (
                <CommandPrimitive.Group
                  heading="News"
                  className={groupClassName}
                >
                  {shown.news.map((hit) => {
                    const highlighted = (
                      hit._highlightResult?.excerpt as { value?: string } | undefined
                    )?.value;
                    const subtitle = `${hit.authorName} · ${timeAgo(hit.createdAt)}`;
                    return (
                      <CommandPrimitive.Item
                        key={hit.objectID}
                        value={hit.objectID}
                        onSelect={() =>
                          handleSelect(`/intranet/post/${hit.postId}`)
                        }
                        className={itemClassName}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-50 text-orange-600">
                          <Newspaper className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {highlighted ? (
                            <p
                              className="truncate font-medium [&_mark]:bg-amber-200/60 [&_mark]:text-foreground [&_mark]:rounded-sm [&_mark]:px-0.5"
                              title={snippetToPlainText(highlighted)}
                              dangerouslySetInnerHTML={{ __html: highlighted }}
                            />
                          ) : (
                            <p
                              className="truncate font-medium"
                              title={hit.excerpt}
                            >
                              {hit.excerpt}
                            </p>
                          )}
                          <p
                            className="text-xs text-muted-foreground truncate"
                            title={subtitle}
                          >
                            {subtitle}
                          </p>
                        </div>
                      </CommandPrimitive.Item>
                    );
                  })}
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
          </div>
      </CommandPrimitive>
    </div>
  );
}
