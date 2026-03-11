"use client";

import { useState, useEffect, useTransition } from "react";
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
} from "@/app/(protected)/intranet/resources/actions";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import { toast } from "sonner";

interface MoveArticleDialogProps {
  articleId: string;
  articleTitle: string;
  currentCategoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CategoryOption {
  id: string;
  name: string;
  icon: string | null;
  icon_colour: string | null;
}

export function MoveArticleDialog({
  articleId,
  articleTitle,
  currentCategoryId,
  open,
  onOpenChange,
}: MoveArticleDialogProps) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronous loading state for data-fetching UX
    setLoading(true);
    fetchCategoriesForMove(currentCategoryId)
      .then((data) => {
        if (!cancelled) {
          setCategories(data);
          setSelectedId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, currentCategoryId]);

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
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {categories.map((cat) => {
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
