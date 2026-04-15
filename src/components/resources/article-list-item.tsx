"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText,
  ChevronRight,
  MoreHorizontal,
  FolderInput,
  Trash2,
  Pencil,
  Send,
  EyeOff,
  Link2Off,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PublishConfirmDialog } from "./publish-confirm-dialog";
import { formatDate } from "@/lib/utils";
import { getExcerpt } from "@/lib/resource-utils";
import { updateArticle } from "@/app/(protected)/resources/actions";
import { toast } from "sonner";
import type { ArticleWithAuthor } from "@/types/database.types";

interface ArticleListItemProps {
  article: ArticleWithAuthor;
  categorySlug: string;
  canEdit: boolean;
  onDelete?: () => void;
  onMove?: () => void;
  onUnlink?: () => void;
}

export function ArticleListItem({
  article,
  categorySlug: _categorySlug,
  canEdit,
  onDelete,
  onMove,
  onUnlink,
}: ArticleListItemProps) {
  const [publishOpen, setPublishOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const displayDate = article.published_at
    ? new Date(article.published_at)
    : new Date(article.updated_at);
  const excerpt = getExcerpt(article.synced_html, 120);

  const isGoogleDoc = article.content_type === "google_doc";
  const isNative = article.content_type === "native";
  const isComponent = article.content_type === "component";
  const isPublished = article.status === "published";

  // "Edit" direct jump — Google Doc opens in Drive in a new tab; native
  // jumps to the Plate editor; component pages are developer-owned.
  const editHref = isNative
    ? `/resources/article/${article.slug}/edit`
    : isGoogleDoc
      ? (article.google_doc_url ?? "#")
      : null;
  const editTarget = isGoogleDoc ? "_blank" : undefined;

  function handlePublishToggle() {
    startTransition(async () => {
      const result = await updateArticle(article.id, {
        status: isPublished ? "draft" : "published",
      });
      if (result.success) {
        toast.success(isPublished ? "Article unpublished" : "Article published");
        setPublishOpen(false);
      } else {
        toast.error(result.error ?? "Failed to update article");
      }
    });
  }

  return (
    <>
      <div className="group relative flex items-start gap-3 rounded-lg px-3.5 py-3 transition-colors hover:bg-muted">
        <Link
          href={`/resources/article/${article.slug}`}
          className="absolute inset-0 z-0"
        >
          <span className="sr-only">Read {article.title}</span>
        </Link>

        <div className="text-muted-foreground shrink-0 mt-0.5">
          <FileText className="h-[18px] w-[18px]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{article.title}</div>
          {excerpt && (
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 opacity-75">
              {excerpt}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-0.5">
            {isPublished ? "Updated" : "Draft · edited"} {formatDate(displayDate)}
          </div>
        </div>

        {canEdit && (
          <div className="relative z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${article.title}`}
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {editHref && !isComponent && (
                  <DropdownMenuItem asChild>
                    <Link
                      href={editHref}
                      target={editTarget}
                      rel={editTarget ? "noopener noreferrer" : undefined}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => onMove?.()}>
                  <FolderInput className="h-4 w-4" />
                  Move to...
                </DropdownMenuItem>
                {!isComponent && (
                  <DropdownMenuItem onSelect={() => setPublishOpen(true)}>
                    {isPublished ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Unpublish
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Publish
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {isGoogleDoc && onUnlink && (
                  <DropdownMenuItem onSelect={() => onUnlink()}>
                    <Link2Off className="h-4 w-4" />
                    Unlink
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onDelete?.()}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div className="text-muted-foreground shrink-0">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>

      <PublishConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={article.title}
        mode={isPublished ? "unpublish" : "publish"}
        onConfirm={handlePublishToggle}
        disabled={isPending}
      />
    </>
  );
}
