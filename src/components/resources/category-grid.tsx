"use client";

import { createElement } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import type { CategoryTreeNode } from "@/types/database.types";

interface CategoryGridProps {
  categories: CategoryTreeNode[];
}

/** Recursively count all articles in a category and its descendants. */
function totalArticleCount(cat: CategoryTreeNode): number {
  let count = cat.article_count;
  for (const child of cat.children) {
    count += totalArticleCount(child);
  }
  return count;
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  // Show only top-level categories (parent_id === null)
  const topLevel = categories.filter((c) => !c.parent_id);

  if (topLevel.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {topLevel.map((cat) => {
        const Icon = resolveIcon(cat.icon);
        const colour = resolveIconColour(cat.icon_colour);
        const articles = totalArticleCount(cat);
        const subcategories = cat.children.length;

        return (
          <Link
            key={cat.id}
            href={`/resources/${cat.slugPath}`}
            className="group block rounded-xl border border-border overflow-hidden transition-all hover:border-foreground/20 hover:shadow-sm"
          >
            {/* Coloured accent bar */}
            <div className={cn("h-1", colour.bg.replace(/\/15/g, "/40"))} />

            <div className="p-4">
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
                <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2 mb-2">
                  {cat.description}
                </p>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground opacity-75">
                <FileText className="h-3.5 w-3.5" />
                <span>
                  {subcategories > 0 && `${subcategories} ${subcategories === 1 ? "subcategory" : "subcategories"} · `}
                  {articles} {articles === 1 ? "article" : "articles"}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
