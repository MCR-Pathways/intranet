"use client";

import { useState, useEffect, useRef, useTransition, useCallback, createElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lightbulb, Loader2, Plus, Search } from "lucide-react";
import { toolShedFormatConfig, type ToolShedFormat } from "@/lib/learning";
import { cn } from "@/lib/utils";
import { EntryCard } from "./entry-card";
import { ShareInsightDialog } from "./share-insight-dialog";
import { DeleteEntryDialog } from "./delete-entry-dialog";
import { getEntries } from "@/app/(protected)/learning/tool-shed/actions";
import type { ToolShedEntryWithAuthor } from "@/app/(protected)/learning/tool-shed/actions";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EntryFeedProps {
  initialEntries: ToolShedEntryWithAuthor[];
  initialHasMore: boolean;
  popularTags: string[];
  currentUserId: string;
  isAdmin: boolean;
}

type FormatFilter = "all" | ToolShedFormat;

// ─── Empty State ────────────────────────────────────────────────────────────

function ToolShedEmptyState({ onShare }: { onShare: () => void }) {
  const formatEntries = Object.entries(toolShedFormatConfig) as [
    ToolShedFormat,
    (typeof toolShedFormatConfig)[ToolShedFormat],
  ][];

  return (
    <Card className="bg-card shadow-md rounded-xl overflow-clip">
      <CardContent className="py-12 px-6">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Lightbulb className="h-7 w-7 text-primary" />
          </div>

          <h3 className="text-base font-semibold mb-1">
            Share what you&apos;ve learned
          </h3>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Attended a training event or conference? Share your insights so the whole team benefits.
          </p>

          {/* Format preview chips */}
          <div className="flex gap-2 mb-6">
            {formatEntries.map(([key, config]) => (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5",
                  config.accent.bg
                )}
              >
                {createElement(config.icon, {
                  className: cn("h-3.5 w-3.5", config.accent.text),
                })}
                <span className={cn("text-xs font-medium", config.accent.text)}>
                  {config.shortLabel}
                </span>
              </div>
            ))}
          </div>

          <Button onClick={onShare}>
            <Plus className="h-4 w-4 mr-2" />
            Share an Insight
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EntryFeed({
  initialEntries,
  initialHasMore,
  popularTags,
  currentUserId,
  isAdmin,
}: EntryFeedProps) {
  // Entry state
  const [entries, setEntries] = useState(initialEntries);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(2);

  // Filter state
  const [activeFormat, setActiveFormat] = useState<FormatFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Dialog state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<ToolShedEntryWithAuthor | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);

  // Loading
  const [isPending, startTransition] = useTransition();
  const [isFiltering, startFilterTransition] = useTransition();

  // Sync with server revalidation
  /* eslint-disable react-hooks/set-state-in-effect -- syncing client state with server-provided props after revalidation */
  useEffect(() => {
    setEntries(initialEntries);
    setHasMore(initialHasMore);
    setPage(2);
  }, [initialEntries, initialHasMore]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Fetch fresh when filters change
  const fetchFiltered = useCallback(
    (format: FormatFilter, search: string, tag: string | null) => {
      startFilterTransition(async () => {
        const result = await getEntries(
          1,
          10,
          format === "all" ? null : format,
          search || null,
          tag
        );
        setEntries(result.entries);
        setHasMore(result.hasMore);
        setPage(2);
      });
    },
    []
  );

  // Re-fetch when filters change (skip initial mount — server already provided data)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchFiltered(activeFormat, debouncedSearch, activeTag);
  }, [activeFormat, debouncedSearch, activeTag, fetchFiltered]);

  // Load more
  const handleLoadMore = () => {
    startTransition(async () => {
      const result = await getEntries(
        page,
        10,
        activeFormat === "all" ? null : activeFormat,
        debouncedSearch || null,
        activeTag
      );
      if (result.entries.length > 0) {
        setEntries((prev) => [...prev, ...result.entries]);
        setPage((p) => p + 1);
      }
      setHasMore(result.hasMore);
    });
  };

  const clearFilters = () => {
    setActiveFormat("all");
    setSearchQuery("");
    setDebouncedSearch("");
    setActiveTag(null);
  };

  const hasFilters = activeFormat !== "all" || debouncedSearch || activeTag;

  return (
    <div className="space-y-4">
      {/* Toolbar: tabs left, search + share right */}
      <div className="flex items-end justify-between gap-4">
        <Tabs
          value={activeFormat}
          onValueChange={(v) => setActiveFormat(v as FormatFilter)}
        >
          <TabsList variant="line">
            <TabsTrigger value="all">All</TabsTrigger>
            {(Object.entries(toolShedFormatConfig) as [ToolShedFormat, (typeof toolShedFormatConfig)[ToolShedFormat]][]).map(
              ([key, config]) => (
                <TabsTrigger key={key} value={key}>
                  {config.shortLabel}
                </TabsTrigger>
              )
            )}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48 h-9 border-0 bg-muted/50 focus:bg-card focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowShareDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Share
          </Button>
        </div>
      </div>

      {/* Active tag filter indicator */}
      {activeTag && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtered by:</span>
          <Badge
            variant="default"
            className="cursor-pointer"
            onClick={() => setActiveTag(null)}
          >
            {activeTag} ✕
          </Badge>
        </div>
      )}

      {/* Loading indicator for filter changes */}
      {isFiltering && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Entry list */}
      {!isFiltering && entries.length === 0 && (
        hasFilters ? (
          <Card className="bg-card shadow-md rounded-xl overflow-clip">
            <CardContent className="py-12 flex flex-col items-center text-center">
              <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No insights match your filters
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Try adjusting your search or filters.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ToolShedEmptyState onShare={() => setShowShareDialog(true)} />
        )
      )}

      {!isFiltering &&
        entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onEdit={(e) => setEditEntry(e)}
            onDelete={(id) => setDeleteEntryId(id)}
            onTagClick={(tag) => setActiveTag(tag)}
          />
        ))}

      {/* Load more */}
      {!isFiltering && hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <ShareInsightDialog
        open={showShareDialog || !!editEntry}
        onOpenChange={(open) => {
          if (!open) {
            setShowShareDialog(false);
            setEditEntry(null);
          }
        }}
        editEntry={editEntry}
        popularTags={popularTags}
      />

      <DeleteEntryDialog
        entryId={deleteEntryId}
        open={!!deleteEntryId}
        onOpenChange={(open) => {
          if (!open) setDeleteEntryId(null);
        }}
      />
    </div>
  );
}
