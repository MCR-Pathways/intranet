"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  moveArticle,
  fetchCategoriesForMove,
} from "@/app/(protected)/resources/actions";
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
  parent_id: string | null;
}

/**
 * Resolve a category ID to its full parent chain for pre-selecting cascading selects.
 */
function resolveParentChain(
  categoryId: string,
  categories: CategoryOption[]
): { majorId: string; subId: string; subSubId: string } {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: string[] = [];
  let currentId: string | null | undefined = categoryId;

  while (currentId) {
    const cat = byId.get(currentId);
    if (!cat) break;
    chain.unshift(cat.id);
    currentId = cat.parent_id;
  }

  return {
    majorId: chain[0] ?? "",
    subId: chain[1] ?? "",
    subSubId: chain[2] ?? "",
  };
}

export function MoveArticleDialog({
  articleId,
  articleTitle,
  currentCategoryId,
  open,
  onOpenChange,
}: MoveArticleDialogProps) {
  const [allCategories, setAllCategories] = useState<CategoryOption[]>([]);
  const [majorCategoryId, setMajorCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [subSubcategoryId, setSubSubcategoryId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  // Derived category lists (cascading selects)
  const topLevelCategories = useMemo(
    () => allCategories.filter((c) => c.parent_id === null),
    [allCategories]
  );

  const subcategories = useMemo(
    () =>
      majorCategoryId
        ? allCategories.filter((c) => c.parent_id === majorCategoryId)
        : [],
    [allCategories, majorCategoryId]
  );

  const subSubcategories = useMemo(
    () =>
      subcategoryId
        ? allCategories.filter((c) => c.parent_id === subcategoryId)
        : [],
    [allCategories, subcategoryId]
  );

  // Final target = most specific selection
  const targetCategoryId = subSubcategoryId || subcategoryId || majorCategoryId;

  // Is the target the same as the current category?
  const isSameCategory = targetCategoryId === currentCategoryId;

  // Fetch all categories when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loading state for data-fetching UX
    setLoading(true);
    fetchCategoriesForMove()
      .then((cats) => {
        if (cancelled) return;
        const options = cats as CategoryOption[];
        setAllCategories(options);

        // Pre-select the current category's chain
        if (currentCategoryId) {
          const chain = resolveParentChain(currentCategoryId, options);
          setMajorCategoryId(chain.majorId);
          setSubcategoryId(chain.subId);
          setSubSubcategoryId(chain.subSubId);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load categories");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, currentCategoryId]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMajorCategoryId("");
      setSubcategoryId("");
      setSubSubcategoryId("");
    }
  }, [open]);

  function handleMajorCategoryChange(value: string) {
    setMajorCategoryId(value);
    setSubcategoryId("");
    setSubSubcategoryId("");
  }

  function handleSubcategoryChange(value: string) {
    setSubcategoryId(value);
    setSubSubcategoryId("");
  }

  function handleMove() {
    if (!targetCategoryId || isSameCategory) return;
    startTransition(async () => {
      const result = await moveArticle(articleId, targetCategoryId);
      if (result.success) {
        const targetName = allCategories.find((c) => c.id === targetCategoryId)?.name;
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
          <DialogDescription>
            Move &ldquo;{articleTitle}&rdquo; to a different category.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading categories...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Category (required) */}
            <div className="space-y-2">
              <Label htmlFor="move-category">Category</Label>
              <Select
                value={majorCategoryId}
                onValueChange={handleMajorCategoryChange}
                disabled={isPending}
              >
                <SelectTrigger id="move-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {topLevelCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategory (optional — only shown if category has children) */}
            {subcategories.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="move-subcategory">
                  Subcategory{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Select
                  value={subcategoryId}
                  onValueChange={handleSubcategoryChange}
                  disabled={isPending}
                >
                  <SelectTrigger id="move-subcategory">
                    <SelectValue placeholder="Select a subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Folder (optional — only shown if subcategory has children) */}
            {subSubcategories.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="move-folder">
                  Folder{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Select
                  value={subSubcategoryId}
                  onValueChange={setSubSubcategoryId}
                  disabled={isPending}
                >
                  <SelectTrigger id="move-folder">
                    <SelectValue placeholder="Select a folder" />
                  </SelectTrigger>
                  <SelectContent>
                    {subSubcategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Same-category warning */}
            {isSameCategory && majorCategoryId && (
              <p className="text-xs text-muted-foreground">
                This article is already in this category.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            onClick={handleMove}
            loading={isPending}
            disabled={!targetCategoryId || isSameCategory}
          >
            Move
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
