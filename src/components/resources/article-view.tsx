"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArticleRenderer } from "./article-renderer";
import { ArticleOutline } from "./article-outline";
import { DeleteResourceDialog } from "./delete-resource-dialog";
import { MoveArticleDialog } from "./move-article-dialog";
import {
  updateArticle,
  deleteArticle,
  toggleArticleFeatured,
} from "@/app/(protected)/intranet/resources/actions";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Star,
  StarOff,
  FolderInput,
} from "lucide-react";
import { useState } from "react";
import type { ArticleWithAuthor } from "@/types/database.types";
import type { TiptapDocument } from "@/lib/tiptap";

interface ArticleViewProps {
  article: ArticleWithAuthor;
  categoryId: string;
  categorySlug: string;
  isHRAdmin: boolean;
}

export function ArticleView({
  article,
  categoryId,
  categorySlug,
  isHRAdmin,
}: ArticleViewProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  const authorName =
    article.author?.preferred_name || article.author?.full_name || "Unknown";

  const displayDate = article.published_at
    ? new Date(article.published_at)
    : new Date(article.updated_at);

  function handleToggleStatus() {
    const newStatus =
      article.status === "published" ? "draft" : "published";
    startTransition(async () => {
      const result = await updateArticle(article.id, { status: newStatus });
      if (result.success) {
        toast.success(
          newStatus === "published" ? "Article published" : "Article unpublished"
        );
      } else {
        toast.error(result.error ?? "Failed to update article");
      }
    });
  }

  function handleToggleFeatured() {
    startTransition(async () => {
      const result = await toggleArticleFeatured(article.id);
      if (result.success) {
        toast.success(
          article.is_featured ? "Article unfeatured" : "Article featured"
        );
      } else {
        toast.error(result.error ?? "Failed to update article");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteArticle(article.id);
      if (result.success) {
        toast.success("Article moved to bin");
        window.location.href = `/intranet/resources/${categorySlug}`;
      } else {
        toast.error(result.error ?? "Failed to delete article");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Admin toolbar */}
      {isHRAdmin && (
        <div className="flex items-center gap-2">
          {article.status === "draft" && (
            <Badge variant="outline">Draft</Badge>
          )}
          {article.is_featured && (
            <Badge variant="secondary">Featured</Badge>
          )}
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isPending}>
                  <MoreHorizontal className="h-4 w-4 mr-1" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={handleToggleStatus}
                >
                  {article.status === "published" ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Unpublish
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Publish
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={`/intranet/resources/${categorySlug}/${article.slug}/edit`}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleToggleFeatured}
                >
                  {article.is_featured ? (
                    <>
                      <StarOff className="h-4 w-4" />
                      Unfeature
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4" />
                      Feature
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setShowMoveDialog(true)}
                >
                  <FolderInput className="h-4 w-4" />
                  Move to...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <DeleteResourceDialog
            itemName={article.title}
            onConfirm={handleDelete}
            disabled={isPending}
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
          />

          <MoveArticleDialog
            articleId={article.id}
            articleTitle={article.title}
            currentCategoryId={categoryId}
            open={showMoveDialog}
            onOpenChange={setShowMoveDialog}
          />
        </div>
      )}

      {/* Two-column layout: content + outline sidebar */}
      <div className="flex gap-8">
        {/* Article content */}
        <Card className="flex-1 min-w-0">
          <CardContent className="p-6">
            {/* Author + date */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
              <Avatar className="h-8 w-8">
                <AvatarImage src={article.author?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(authorName)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <span className="font-medium">{authorName}</span>
                <span className="text-muted-foreground ml-2">
                  {displayDate.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* Body */}
            <ArticleRenderer
              json={article.content_json as unknown as TiptapDocument}
              fallback={article.content}
            />
          </CardContent>
        </Card>

        {/* Right sidebar — table of contents */}
        <div className="hidden lg:block w-56 shrink-0">
          <ArticleOutline
            contentJson={article.content_json as unknown as TiptapDocument}
          />
        </div>
      </div>
    </div>
  );
}
