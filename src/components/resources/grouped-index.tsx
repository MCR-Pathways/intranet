"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, FileText, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIconColour } from "@/lib/resource-icons";
import { formatDate } from "@/lib/utils";
import type { CategoryWithCount } from "@/types/database.types";

interface GroupedArticle {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
}

interface SubcategoryGroup {
  subcategory: CategoryWithCount;
  articles: GroupedArticle[];
}

interface GroupedIndexProps {
  groups: SubcategoryGroup[];
  parentSlugPath: string;
  parentIconColour?: string | null;
}

/**
 * Grouped index for category pages — each subcategory is an expandable
 * section showing its articles inline. Replaces the old subcategory cards
 * + flat article list pattern to eliminate duplication.
 */
export function GroupedIndex({
  groups,
  parentSlugPath,
  parentIconColour,
}: GroupedIndexProps) {
  // Empty sections start collapsed to reduce noise
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () =>
      new Set(
        groups
          .filter((g) => g.articles.length === 0)
          .map((g) => g.subcategory.id)
      )
  );

  const colour = resolveIconColour(parentIconColour);

  function toggleSection(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No content in this category yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(({ subcategory, articles }) => {
        const isOpen = !collapsed.has(subcategory.id);
        const subcatPath = `${parentSlugPath}/${subcategory.slug}`;

        return (
          <div
            key={subcategory.id}
            className="rounded-xl border border-border overflow-hidden"
          >
            {/* Section header — name navigates, chevron toggles */}
            <div className="flex items-center bg-card">
              <Link
                href={`/resources/${subcatPath}`}
                className="flex items-center gap-2.5 px-4 py-3 flex-1 min-w-0 hover:bg-muted/50 transition-colors"
              >
                <FolderOpen
                  className={cn("h-4 w-4 shrink-0", colour.fg)}
                />
                <span className="font-semibold text-[13px] truncate hover:underline underline-offset-4">
                  {subcategory.name}
                </span>
                {articles.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-1 shrink-0">
                    {articles.length} {articles.length === 1 ? "article" : "articles"}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => toggleSection(subcategory.id)}
                className="flex items-center px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-l border-border"
                aria-label={isOpen ? `Collapse ${subcategory.name}` : `Expand ${subcategory.name}`}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    !isOpen && "-rotate-90"
                  )}
                />
              </button>
            </div>

            {/* Articles list — collapses */}
            {isOpen && articles.length > 0 && (
              <div className="border-t border-border">
                {articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/resources/article/${article.slug}`}
                    className="flex items-center gap-2.5 px-4 py-2.5 pl-11 hover:bg-muted/50 transition-colors group"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[13px] font-medium truncate group-hover:text-foreground">
                      {article.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                      {formatDate(new Date(article.updated_at))}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
