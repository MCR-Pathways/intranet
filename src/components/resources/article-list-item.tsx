"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText,
  MoreHorizontal,
  FolderInput,
  Trash2,
  Pencil,
  Send,
  EyeOff,
  Link2Off,
  ExternalLink,
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
import { cn, formatDate } from "@/lib/utils";
import { getExcerpt } from "@/lib/resource-utils";
import { updateArticle } from "@/app/(protected)/resources/actions";
import { BookmarkToggle } from "./bookmark-toggle";
import { toast } from "sonner";
import type { ArticleWithAuthor } from "@/types/database.types";

interface ArticleListItemProps {
  article: ArticleWithAuthor;
  categorySlug: string;
  canEdit: boolean;
  isBookmarked?: boolean;
  onDelete?: () => void;
  onMove?: () => void;
  onUnlink?: () => void;
  /**
   * "compact" trims the excerpt and tightens vertical padding for nested
   * use inside GroupedIndex subcategory sections. Default ("default") shows
   * the full excerpt + generous spacing for direct-category article lists.
   */
  variant?: "default" | "compact";
}

export function ArticleListItem({
  article,
  categorySlug: _categorySlug,
  canEdit,
  isBookmarked = false,
  onDelete,
  onMove,
  onUnlink,
  variant = "default",
}: ArticleListItemProps) {
  const [publishOpen, setPublishOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isCompact = variant === "compact";

  const displayDate = article.published_at
    ? new Date(article.published_at)
    : new Date(article.updated_at);
  const excerpt = isCompact ? null : getExcerpt(article.synced_html, 120);

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
      <div className="flex items-center hover:bg-muted/70 transition-colors">
        <Link
          href={`/resources/article/${article.slug}`}
          className={cn(
            "flex items-start gap-3 flex-1 min-w-0 hover:underline underline-offset-4 decoration-muted-foreground/30",
            // Compact rows are nested under an expanded folder — indent past
            // the folder icon so the hierarchy reads without a left border.
            isCompact
              ? "pl-11 md:pl-12 pr-4 py-2"
              : "px-5 md:px-6 py-2.5"
          )}
        >
          <div className="text-muted-foreground shrink-0 mt-0.5 no-underline">
            <FileText className={cn(isCompact ? "h-4 w-4" : "h-[18px] w-[18px]")} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{article.title}</div>
            {excerpt && (
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 opacity-75 no-underline">
                {excerpt}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-0.5 no-underline">
              {isPublished ? "Updated" : "Draft · edited"} {formatDate(displayDate)}
            </div>
          </div>
        </Link>

        {isPublished && (
          <div className="px-1 shrink-0">
            <BookmarkToggle articleId={article.id} initialBookmarked={isBookmarked} />
          </div>
        )}

        {canEdit && (
          <div className="px-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${article.title}`}
                  title="Actions"
                >
                  <MoreHorizontal />
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
                      {isGoogleDoc && (
                        <ExternalLink className="h-3 w-3 ml-auto opacity-60" />
                      )}
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
