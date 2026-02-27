"use client";

import Link from "next/link";
import {
  Shield,
  BookOpen,
  Wrench,
  FileText,
  Folder,
  Star,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CategoryWithCount } from "@/types/database.types";

const ICON_MAP: Record<string, React.ElementType> = {
  Shield,
  BookOpen,
  Wrench,
  FileText,
  Folder,
  Star,
};

interface CategoryCardProps {
  category: CategoryWithCount;
  isHRAdmin: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CategoryCard({
  category,
  isHRAdmin,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  const Icon = (category.icon && ICON_MAP[category.icon]) || Folder;

  return (
    <Card className="group relative transition-colors hover:bg-muted/50">
      <Link
        href={`/intranet/resources/${category.slug}`}
        className="absolute inset-0 z-0"
      >
        <span className="sr-only">View {category.name}</span>
      </Link>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
        {isHRAdmin && (
          <div className="relative z-10 flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.preventDefault();
                onEdit?.();
              }}
              aria-label={`Edit ${category.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                onDelete?.();
              }}
              aria-label={`Delete ${category.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
