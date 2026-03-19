"use client";

import { useEffect, useState, useTransition } from "react";
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

// Client-side URL validation (same regex as extractDocId in google-drive.ts)
function isValidGoogleDocUrl(url: string): boolean {
  return /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/.test(url);
}

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

export function LinkGoogleDocDialog({
  open,
  onOpenChange,
  defaultCategoryId,
}: LinkGoogleDocDialogProps) {
  const [docUrl, setDocUrl] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [customTitle, setCustomTitle] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [urlError, setUrlError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Fetch categories when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoadingCategories(true);
    fetchCategoriesForMove()
      .then((cats) => {
        setCategories(cats as CategoryOption[]);
      })
      .catch((err) => {
        console.error("Failed to fetch categories:", err);
        toast.error("Failed to load categories");
      })
      .finally(() => {
        setLoadingCategories(false);
      });
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setDocUrl("");
      setCategoryId(defaultCategoryId ?? "");
      setCustomTitle("");
      setUrlError("");
    }
  }, [open, defaultCategoryId]);

  function handleUrlChange(value: string) {
    setDocUrl(value);
    if (value && !isValidGoogleDocUrl(value)) {
      setUrlError("Please enter a valid Google Docs URL");
    } else {
      setUrlError("");
    }
  }

  function handleSubmit() {
    if (!docUrl || !categoryId) return;
    if (!isValidGoogleDocUrl(docUrl)) {
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

  const canSubmit = docUrl && categoryId && !urlError && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-mcr-teal" />
            Link Google Doc
          </DialogTitle>
          <DialogDescription>
            Paste a Google Docs URL to add it to Resources. The document will be
            synced automatically.
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

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
              disabled={isPending || loadingCategories}
            >
              <SelectTrigger id="category">
                <SelectValue
                  placeholder={
                    loadingCategories ? "Loading..." : "Select a category"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
