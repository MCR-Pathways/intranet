"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  moveArticle,
  fetchCategoriesForMove,
  fetchTopLevelCategories,
} from "@/app/(protected)/intranet/resources/actions";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import { toast } from "sonner";
import type { MoveCategoryOption } from "@/app/(protected)/intranet/resources/actions";

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
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, currentCategoryId]);

  // Group categories: top-level (no parent) + grouped under parent names
  const grouped = useMemo(() => {
    const parentMap = new Map(parents.map((p) => [p.id, p.name]));
    const topLevel: MoveCategoryOption[] = [];
    const byParent = new Map<string, MoveCategoryOption[]>();

    for (const cat of categories) {
      if (cat.parent_id) {
        const group = byParent.get(cat.parent_id) ?? [];
        group.push(cat);
        byParent.set(cat.parent_id, group);
      } else {
        topLevel.push(cat);
      }
    }

    // Build ordered list: top-level first, then each parent group
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
  }, [categories, parents]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move Article</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Move &ldquo;{articleTitle}&rdquo; to a different category.
        </p>

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading categories...
          </div>
        ) : categories.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No other categories available.
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            {grouped.map((group, gi) => (
              <div key={group.label ?? `top-${gi}`}>
                {group.label && (
                  <div className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </div>
                )}
                <div className="space-y-1 p-1">
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
                            ? "bg-primary/10 ring-1 ring-primary/30"
                            : "hover:bg-muted"
                        )}
                        onClick={() => setSelectedId(cat.id)}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                            colour.bg,
                            colour.fg
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <LoadingButton
            onClick={handleMove}
            loading={isPending}
            disabled={!selectedId}
          >
            Move
          </LoadingButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
