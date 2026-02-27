"use client";

import { useState, useRef, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { ArticleComposer } from "./article-composer";
import {
  createArticle,
  updateArticle,
} from "@/app/(protected)/intranet/resources/actions";
import { toast } from "sonner";
import type { TiptapDocument } from "@/lib/tiptap";
import type { ArticleWithAuthor } from "@/types/database.types";

interface ArticleFormDialogProps {
  trigger?: React.ReactNode;
  categoryId: string;
  /** Pass existing article for edit mode; omit for create mode */
  article?: ArticleWithAuthor;
  /** Controlled open state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ArticleFormDialog({
  trigger,
  categoryId,
  article,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ArticleFormDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen;

  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(article?.title ?? "");
  const contentRef = useRef<TiptapDocument | null>(
    (article?.content_json as unknown as TiptapDocument) ?? null
  );

  const isEdit = !!article;

  function handleContentChange(json: TiptapDocument) {
    contentRef.current = json;
  }

  function handleSave(status: "draft" | "published") {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateArticle(article!.id, {
            title,
            content_json: contentRef.current ?? undefined,
            status,
          })
        : await createArticle(categoryId, {
            title,
            content_json: contentRef.current ?? undefined,
            status,
          });

      if (result.success) {
        toast.success(
          isEdit
            ? "Article updated"
            : status === "published"
              ? "Article published"
              : "Draft saved"
        );
        setOpen(false);
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Article" : "New Article"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="article-title">Title</Label>
            <Input
              id="article-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Content</Label>
            <ArticleComposer
              onChange={handleContentChange}
              initialContent={article?.content_json}
              disabled={isPending}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleSave("draft")}
            >
              Save as Draft
            </Button>
            <LoadingButton
              loading={isPending}
              onClick={() => handleSave("published")}
            >
              {isEdit && article?.status === "published"
                ? "Update"
                : "Publish"}
            </LoadingButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
