"use client";

import Link from "next/link";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { ArticleWithAuthor } from "@/types/database.types";

interface ArticleListItemProps {
  article: ArticleWithAuthor;
  categorySlug: string;
  isHRAdmin: boolean;
  onDelete?: () => void;
}

export function ArticleListItem({
  article,
  categorySlug,
  isHRAdmin,
  onDelete,
}: ArticleListItemProps) {
  const displayDate = article.published_at
    ? new Date(article.published_at)
    : new Date(article.updated_at);

  const authorName =
    article.author?.preferred_name || article.author?.full_name || "Unknown";

  return (
    <div className="group relative flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50">
      <Link
        href={`/intranet/resources/${categorySlug}/${article.slug}`}
        className="absolute inset-0 z-0"
      >
        <span className="sr-only">Read {article.title}</span>
      </Link>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileText className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate">{article.title}</h3>
          {isHRAdmin && article.status === "draft" && (
            <Badge variant="outline" className="shrink-0 text-xs">
              Draft
            </Badge>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="h-4 w-4">
            <AvatarImage src={article.author?.avatar_url ?? undefined} />
            <AvatarFallback className="text-[8px]">
              {getInitials(authorName)}
            </AvatarFallback>
          </Avatar>
          <span>{authorName}</span>
          <span>·</span>
          <span>
            {displayDate.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {isHRAdmin && (
        <div className="relative z-10 flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            asChild
          >
            <Link
              href={`/intranet/resources/${categorySlug}/${article.slug}/edit`}
              aria-label={`Edit ${article.title}`}
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.preventDefault();
              onDelete?.();
            }}
            aria-label={`Delete ${article.title}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
