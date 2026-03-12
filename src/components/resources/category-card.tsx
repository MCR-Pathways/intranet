"use client";

import Link from "next/link";
import {
  Pencil,
  Trash2,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import type { CategoryWithCount } from "@/types/database.types";

interface CategoryCardProps {
  category: CategoryWithCount;
  canEdit: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function CategoryCard({
  category,
  canEdit,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: CategoryCardProps) {
  const Icon = resolveIcon(category.icon);
  const colour = resolveIconColour(category.icon_colour);

  return (
    <Card className="group relative transition-colors hover:bg-muted/50">
      <Link
        href={`/intranet/resources/${category.slug}`}
        className="absolute inset-0 z-0"
      >
        <span className="sr-only">View {category.name}</span>
      </Link>
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            colour.bg,
            colour.fg
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{category.name}</h3>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {category.article_count}{" "}
              {category.article_count === 1 ? "article" : "articles"}
            </Badge>
          </div>
          {category.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {category.description}
            </p>
          )}
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
                  <span className="sr-only">Actions for {category.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => onEdit?.()}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {!isFirst && (
                  <DropdownMenuItem onSelect={() => onMoveUp?.()}>
                    <ArrowUp className="h-4 w-4" />
                    Move up
                  </DropdownMenuItem>
                )}
                {!isLast && (
                  <DropdownMenuItem onSelect={() => onMoveDown?.()}>
                    <ArrowDown className="h-4 w-4" />
                    Move down
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
      </CardContent>
    </Card>
  );
}
