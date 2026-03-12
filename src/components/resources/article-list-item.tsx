"use client";

import Link from "next/link";
import { FileText, Pencil, Trash2, MoreHorizontal, FolderInput } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VisibilityBadge } from "./visibility-badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials, getAvatarColour, filterAvatarUrl } from "@/lib/utils";
import type { ArticleWithAuthor } from "@/types/database.types";

interface ArticleListItemProps {
  article: ArticleWithAuthor;
  categorySlug: string;
  canEdit: boolean;
  onDelete?: () => void;
  onMove?: () => void;
}

export function ArticleListItem({
  article,
  categorySlug,
  canEdit,
  onDelete,
  onMove,
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
          {canEdit && article.status === "draft" && (
            <Badge variant="outline" className="shrink-0 text-xs">
              Draft
            </Badge>
          )}
          {canEdit && article.visibility && (
            <VisibilityBadge visibility={article.visibility as "all" | "internal"} />
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="h-4 w-4">
            <AvatarImage src={filterAvatarUrl(article.author?.avatar_url)} />
            <AvatarFallback className={cn(getAvatarColour(authorName).bg, getAvatarColour(authorName).fg, "text-[8px]")}>
              {getInitials(authorName)}
            </AvatarFallback>
          </Avatar>
          <span>{authorName}</span>
          <span>&middot;</span>
          <span>
            {displayDate.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {canEdit && (
        <div className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.preventDefault()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions for {article.title}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link
                  href={`/intranet/resources/${categorySlug}/${article.slug}/edit`}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMove?.()}>
                <FolderInput className="h-4 w-4" />
                Move to...
              </DropdownMenuItem>
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
  );
}
