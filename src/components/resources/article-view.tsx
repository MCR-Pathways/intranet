"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArticleRenderer } from "./article-renderer";
import { DeleteResourceDialog } from "./delete-resource-dialog";
import {
  updateArticle,
  deleteArticle,
} from "@/app/(protected)/intranet/resources/actions";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import type { ArticleWithAuthor } from "@/types/database.types";
import type { TiptapDocument } from "@/lib/tiptap";

interface ArticleViewProps {
  article: ArticleWithAuthor;
  categorySlug: string;
  isHRAdmin: boolean;
}

export function ArticleView({
  article,
  categorySlug,
  isHRAdmin,
}: ArticleViewProps) {
  const [isPending, startTransition] = useTransition();

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

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteArticle(article.id);
      if (result.success) {
        toast.success("Article deleted");
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            disabled={isPending}
          >
            {article.status === "published" ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Unpublish
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Publish
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/intranet/resources/${categorySlug}/${article.slug}/edit`}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Link>
          </Button>
          <DeleteResourceDialog
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            }
            itemName={article.title}
            onConfirm={handleDelete}
            disabled={isPending}
          />
        </div>
      )}

      {/* Article content */}
      <Card>
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
    </div>
  );
}
