"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen, Loader2, Plus, Search } from "lucide-react";
import { toolShedFormatConfig, type ToolShedFormat } from "@/lib/learning";
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

  // Edit/delete handlers
  const handleEdit = (entry: ToolShedEntryWithAuthor) => {
    setEditEntry(entry);
  };

  const handleDelete = (id: string) => {
    setDeleteEntryId(id);
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
      {/* Share button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowShareDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Share an Insight
        </Button>
      </div>

      {/* Filter tabs */}
      <Tabs
        value={activeFormat}
        onValueChange={(v) => setActiveFormat(v as FormatFilter)}
      >
        <TabsList>
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search insights by title or event..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card"
        />
      </div>

      {/* Tag chips */}
      {popularTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {popularTags.slice(0, 8).map((tag) => (
            <Badge
              key={tag}
              variant={activeTag === tag ? "default" : "muted"}
              className="cursor-pointer"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
            </Badge>
          ))}
          {popularTags.length > 8 && !activeTag && (
            <span className="text-xs text-muted-foreground self-center">
              +{popularTags.length - 8} more
            </span>
          )}
        </div>
      )}

      {/* Loading indicator for filter changes */}
      {isFiltering && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Entry list */}
      {!isFiltering && entries.length === 0 && (
        <Card className="bg-card shadow-md rounded-xl overflow-clip">
          <CardContent className="p-0">
            {hasFilters ? (
              <EmptyState
                icon={Search}
                title="No insights match your filters"
                description="Try adjusting your search or filters."
                action={
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No insights shared yet"
                description="Be the first to share what you've learned from a training event."
                action={
                  <Button size="sm" onClick={() => setShowShareDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Share an Insight
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      )}

      {!isFiltering &&
        entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onEdit={handleEdit}
            onDelete={handleDelete}
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
