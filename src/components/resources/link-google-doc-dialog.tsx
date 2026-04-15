"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
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
import { linkGoogleDoc } from "@/app/(protected)/resources/drive-actions";
import { fetchCategoriesForMove } from "@/app/(protected)/resources/actions";
import { toast } from "sonner";
import { extractDocId } from "@/lib/google-doc-url";

interface LinkGoogleDocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a category when linking from a category page */
  defaultCategoryId?: string;
}

interface CategoryOption {
  id: string;
  name: string;
  parent_id: string | null;
}

/**
 * Resolve a category ID to its full parent chain.
 * Returns [majorId, subcategoryId?, subSubcategoryId?] depending on depth.
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

export function LinkGoogleDocDialog({
  open,
  onOpenChange,
  defaultCategoryId,
}: LinkGoogleDocDialogProps) {
  const [docUrl, setDocUrl] = useState("");
  const [majorCategoryId, setMajorCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [subSubcategoryId, setSubSubcategoryId] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [allCategories, setAllCategories] = useState<CategoryOption[]>([]);
  const [urlError, setUrlError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Derived category lists
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

  // Final category ID = most specific selection
  const categoryId = subSubcategoryId || subcategoryId || majorCategoryId;

  // Load categories when dialog opens. See create-article-dialog for the
  // onOpenChange constraint that prevents moving this out of the effect.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      .catch((err) => {
        console.error("Failed to fetch categories:", err);
        toast.error("Failed to load categories");
      })
      .finally(() => {
        setLoadingCategories(false);
      });
  }, [open, defaultCategoryId]);

  // Reset form on close
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setDocUrl("");
      setMajorCategoryId("");
      setSubcategoryId("");
      setSubSubcategoryId("");
      setCustomTitle("");
      setUrlError("");
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

  function handleUrlChange(value: string) {
    setDocUrl(value);
    if (value && !extractDocId(value)) {
      setUrlError("Please enter a valid Google Docs URL");
    } else {
      setUrlError("");
    }
  }

  function handleSubmit() {
    if (!docUrl || !categoryId) return;
    if (!extractDocId(docUrl)) {
      setUrlError("Please enter a valid Google Docs URL");
      return;
    }

    startTransition(async () => {
      const result = await linkGoogleDoc(
        docUrl,
        categoryId,
        customTitle || undefined
      );
      if (result.success && result.slug) {
        toast.success("Google Doc linked successfully");
        onOpenChange(false);
        // Navigate to the new article — use window.location.href per CLAUDE.md
        // (inside Radix dialog, router.push() conflicts with dialog event handling)
        window.location.href = `/resources/article/${result.slug}`;
      } else {
        toast.error(result.error ?? "Failed to link Google Doc");
      }
    });
  }

  const canSubmit = docUrl && majorCategoryId && !urlError && !isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-mcr-teal" />
            Link Google Doc
          </DialogTitle>
          <DialogDescription>
            Paste a Google Docs URL to add it to Resources. The document will be
            synced automatically. Make sure the document is shared with &ldquo;Anyone
            in MCR Pathways&rdquo; before linking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Google Doc URL */}
          <div className="space-y-2">
            <Label htmlFor="doc-url">Google Doc URL</Label>
            <Input
              id="doc-url"
              placeholder="https://docs.google.com/document/d/..."
              value={docUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={isPending}
            />
            {urlError && (
              <p className="text-xs text-destructive">{urlError}</p>
            )}
          </div>

          {/* Major Category (required) */}
          <div className="space-y-2">
            <Label htmlFor="major-category">Category</Label>
            <Select
              value={majorCategoryId}
              onValueChange={handleMajorCategoryChange}
              disabled={isPending || loadingCategories}
            >
              <SelectTrigger id="major-category">
                <SelectValue
                  placeholder={
                    loadingCategories ? "Loading..." : "Select a category"
                  }
                />
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

          {/* Subcategory (optional — only shown if major category has children) */}
          {subcategories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="subcategory">
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
                <SelectTrigger id="subcategory">
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

          {/* Sub-subcategory (optional — only shown if subcategory has children) */}
          {subSubcategories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="sub-subcategory">
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
                <SelectTrigger id="sub-subcategory">
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

          {/* Custom title (optional) */}
          <div className="space-y-2">
            <Label htmlFor="custom-title">
              Custom title{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="custom-title"
              placeholder="Uses the Google Doc title if left blank"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Link Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
