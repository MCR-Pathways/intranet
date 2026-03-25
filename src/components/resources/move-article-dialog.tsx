"use client";

import { useState, useEffect, useMemo, useTransition, createElement } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  moveArticle,
  fetchCategoriesForMove,
  fetchTopLevelCategories,
} from "@/app/(protected)/resources/actions";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import { Search } from "lucide-react";
import { toast } from "sonner";
import type { MoveCategoryOption } from "@/app/(protected)/resources/actions";

interface MoveArticleDialogProps {
  articleId: string;
  articleTitle: string;
  currentCategoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParentInfo {
  id: string;
  name: string;
}

export function MoveArticleDialog({
  articleId,
  articleTitle,
  currentCategoryId,
  open,
  onOpenChange,
}: MoveArticleDialogProps) {
  const [categories, setCategories] = useState<MoveCategoryOption[]>([]);
  const [parents, setParents] = useState<ParentInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronous loading state for data-fetching UX
    setLoading(true);
    Promise.all([
      fetchCategoriesForMove(currentCategoryId),
      fetchTopLevelCategories(),
    ])
      .then(([cats, topLevel]) => {
        if (!cancelled) {
          setCategories(cats);
          setParents(topLevel);
          setSelectedId(null);
          setSearch("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, currentCategoryId]);

  // Filter by search query
  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  // Group categories: top-level (no parent) + grouped under parent names
  const grouped = useMemo(() => {
    const parentMap = new Map(parents.map((p) => [p.id, p.name]));
    const topLevel: MoveCategoryOption[] = [];
    const byParent = new Map<string, MoveCategoryOption[]>();

    for (const cat of filtered) {
      if (cat.parent_id) {
        const group = byParent.get(cat.parent_id) ?? [];
        group.push(cat);
        byParent.set(cat.parent_id, group);
      } else {
        topLevel.push(cat);
      }
    }

    const result: { label?: string; items: MoveCategoryOption[] }[] = [];

    if (topLevel.length > 0) {
      result.push({ items: topLevel });
    }

    for (const [parentId, items] of byParent) {
      result.push({
        label: parentMap.get(parentId) ?? "Unknown",
        items,
      });
    }

    return result;
  }, [filtered, parents]);

  function handleMove() {
    if (!selectedId) return;
    startTransition(async () => {
      const result = await moveArticle(articleId, selectedId);
      if (result.success) {
        const targetName = categories.find((c) => c.id === selectedId)?.name;
        toast.success(`Article moved to ${targetName}`);
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Failed to move article");
      }
    });
  }

  const totalFiltered = filtered.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move Article</DialogTitle>
          <DialogDescription>
            Move &ldquo;{articleTitle}&rdquo; to a different category.
          </DialogDescription>
        </DialogHeader>

        {/* Search filter */}
        {!loading && categories.length > 6 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        )}

        {/* Category list */}
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading categories...
          </div>
        ) : categories.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No other categories available.
          </div>
        ) : totalFiltered === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No categories match &ldquo;{search}&rdquo;
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background">
            {grouped.map((group, gi) => (
              <div key={group.label ?? `top-${gi}`}>
                {group.label && (
                  <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 pt-3 pb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                    {group.label}
                  </div>
                )}
                <div className="p-1">
                  {group.items.map((cat) => {
                    const Icon = resolveIcon(cat.icon);
                    const colour = resolveIconColour(cat.icon_colour);
                    const isSelected = selectedId === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                          isSelected
                            ? "bg-primary/10 text-foreground ring-1 ring-primary/30"
                            : "hover:bg-muted text-foreground/80"
                        )}
                        onClick={() => setSelectedId(cat.id)}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                            colour.bg,
                            colour.fg
                          )}
                        >
                          {createElement(Icon, { className: "h-3.5 w-3.5" })}
                        </div>
                        <span className={cn("font-medium", isSelected && "font-semibold")}>
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            onClick={handleMove}
            loading={isPending}
            disabled={!selectedId}
          >
            Move
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
