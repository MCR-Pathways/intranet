"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIconColour } from "@/lib/resource-icons";
import { CategoryCardActions } from "./category-card-actions";
import type { CategoryWithCount } from "@/types/database.types";

interface SubcategoryGridProps {
  subcategories: CategoryWithCount[];
  parentSlugPath?: string;
  parentIconColour?: string | null;
  canEdit?: boolean;
}

export function SubcategoryGrid({
  subcategories,
  parentSlugPath,
  parentIconColour,
  canEdit = false,
}: SubcategoryGridProps) {
  if (subcategories.length === 0) return null;

  const colour = resolveIconColour(parentIconColour);

  return (
    <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
      {subcategories.map((sub) => (
        <div
          key={sub.id}
          className="group/card relative rounded-xl border border-border overflow-hidden transition-all hover:border-foreground/20 hover:shadow-sm"
        >
          <Link
            href={`/resources/${parentSlugPath ? `${parentSlugPath}/${sub.slug}` : sub.slug}`}
            className="group block"
          >
            {/* Coloured accent bar */}
            <div className={cn("h-0.5", colour.bg.replace(/\/15/g, "/40"))} />

            <div className="px-4 py-3.5">
              <div className="flex items-center gap-2 mb-1">
                <FolderOpen className={cn("h-4 w-4 shrink-0", colour.fg)} />
                <span className="text-[13px] font-semibold truncate">
                  {sub.name}
                </span>
              </div>
              {sub.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-1.5">
                  {sub.description}
                </p>
              )}
              <div className="text-[11px] text-muted-foreground opacity-75">
                {sub.article_count} {sub.article_count === 1 ? "article" : "articles"}
              </div>
            </div>
          </Link>
          <CategoryCardActions category={sub} canEdit={canEdit} />
        </div>
      ))}
    </div>
  );
}
