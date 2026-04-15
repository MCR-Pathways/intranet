"use client";

import { createElement } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import { CategoryCardActions } from "./category-card-actions";
import type { CategoryTreeNode } from "@/types/database.types";

interface CategoryGridProps {
  categories: CategoryTreeNode[];
  canEdit?: boolean;
}

/** Recursively count all articles in a category and its descendants. */
function totalArticleCount(cat: CategoryTreeNode): number {
  let count = cat.article_count;
  for (const child of cat.children) {
    count += totalArticleCount(child);
  }
  return count;
}

export function CategoryGrid({ categories, canEdit = false }: CategoryGridProps) {
  // Show only top-level categories with content (hide empty ones)
  const topLevel = categories
    .filter((c) => !c.parent_id)
    .filter((c) => totalArticleCount(c) > 0 || c.children.length > 0);

  if (topLevel.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {topLevel.map((cat) => {
        const Icon = resolveIcon(cat.icon);
        const colour = resolveIconColour(cat.icon_colour);

        return (
          <div
            key={cat.id}
            className="group/card relative rounded-xl border border-border bg-card overflow-hidden shadow-sm transition-all hover:border-foreground/20 hover:shadow-md"
          >
            <Link
              href={`/resources/${cat.slugPath}`}
              className="group block"
            >
              <div className="p-4 flex flex-col h-full">
                {/* Icon */}
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg mb-3",
                    colour.bg,
                    colour.fg
                  )}
                >
                  {createElement(Icon, { className: "h-5 w-5" })}
                </div>

                {/* Name */}
                <p className="font-semibold text-[15px] mb-1 group-hover:text-foreground">
                  {cat.name}
                </p>

                {/* Description (if populated) */}
                {cat.description && (
                  <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
                    {cat.description}
                  </p>
                )}
              </div>
            </Link>
            <CategoryCardActions category={cat} canEdit={canEdit} />
          </div>
        );
      })}
    </div>
  );
}
