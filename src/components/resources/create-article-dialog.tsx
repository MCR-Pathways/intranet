"use client";

/**
 * Dialog for creating a new native Plate article.
 *
 * Reuses the cascading category select pattern from LinkGoogleDocDialog.
 * Creates a draft article and redirects to the editor.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createNativeArticle } from "@/app/(protected)/resources/native-actions";
import { fetchCategoriesForMove } from "@/app/(protected)/resources/actions";
import { toast } from "sonner";

interface CategoryOption {
  id: string;
  name: string;
  parent_id: string | null;
}

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

interface CreateArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategoryId?: string;
}

export function CreateArticleDialog({
  open,
  onOpenChange,
  defaultCategoryId,
}: CreateArticleDialogProps) {
  const [title, setTitle] = useState("");
  const [majorCategoryId, setMajorCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [subSubcategoryId, setSubSubcategoryId] = useState("");
  const [allCategories, setAllCategories] = useState<CategoryOption[]>([]);
  const [isPending, startTransition] = useTransition();
  const [loadingCategories, setLoadingCategories] = useState(false);

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

  const categoryId = subSubcategoryId || subcategoryId || majorCategoryId;

  // Load categories when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoadingCategories(true);
    fetchCategoriesForMove()
      .then((cats) => {
        const options = cats as CategoryOption[];
        setAllCategories(options);

        if (defaultCategoryId) {
          const chain = resolveParentChain(defaultCategoryId, options);
          setMajorCategoryId(chain.majorId);
          setSubcategoryId(chain.subId);
          setSubSubcategoryId(chain.subSubId);
        }
      })
      .catch(() => {
        toast.error("Failed to load categories");
      })
      .finally(() => {
        setLoadingCategories(false);
      });
  }, [open, defaultCategoryId]);

  // Reset state on close
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setTitle("");
      setMajorCategoryId("");
      setSubcategoryId("");
      setSubSubcategoryId("");
      setAllCategories([]);
    }
    onOpenChange(nextOpen);
  }

  function handleMajorCategoryChange(value: string) {
    setMajorCategoryId(value);
    setSubcategoryId("");
    setSubSubcategoryId("");
  }

  function handleSubcategoryChange(value: string) {
    setSubcategoryId(value);
    setSubSubcategoryId("");
  }

  function handleSubmit() {
    if (!title.trim() || !categoryId) return;

    startTransition(async () => {
      const result = await createNativeArticle(title.trim(), categoryId);
      if (result.success && result.slug) {
        toast.success("Article created");
        onOpenChange(false);
        window.location.href = `/resources/article/${result.slug}/edit`;
      } else {
        toast.error(result.error ?? "Failed to create article");
      }
    });
  }

  const canSubmit = title.trim() && majorCategoryId && !isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle>Create article</DialogTitle>
          <DialogDescription>
            Create a new article with the built-in editor. You can add content
            after creating it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="article-title">Title</Label>
            <Input
              id="article-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Jargon Buster"
              maxLength={200}
              autoFocus
            />
          </div>

          {/* Category cascade */}
          <div className="space-y-2">
            <Label>Category</Label>
            {loadingCategories ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading categories...
              </div>
            ) : (
              <div className="space-y-2">
                <Select
                  value={majorCategoryId}
                  onValueChange={handleMajorCategoryChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {topLevelCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {subcategories.length > 0 && (
                  <Select
                    value={subcategoryId}
                    onValueChange={handleSubcategoryChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subcategory (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {subSubcategories.length > 0 && (
                  <Select
                    value={subSubcategoryId}
                    onValueChange={setSubSubcategoryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub-subcategory (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {subSubcategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <FileText className="h-4 w-4 mr-1" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
