"use client";

import Link from "next/link";
import { FileText, ChevronRight, MoreHorizontal, FolderInput, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import { getExcerpt } from "@/lib/resource-utils";
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
  const excerpt = getExcerpt(article.synced_html, 120);

  return (
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
          Updated {formatDate(displayDate)}
        </div>
      </div>

      {canEdit && (
        <div className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.preventDefault()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions for {article.title}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

      <div className="text-muted-foreground shrink-0">
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );
}
