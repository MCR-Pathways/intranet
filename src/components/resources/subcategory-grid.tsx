"use client";

import Link from "next/link";
import type { CategoryWithCount } from "@/types/database.types";

interface SubcategoryGridProps {
  subcategories: CategoryWithCount[];
  parentSlugPath?: string;
}

export function SubcategoryGrid({
  subcategories,
  parentSlugPath,
}: SubcategoryGridProps) {
  if (subcategories.length === 0) return null;

  return (
    <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
      {subcategories.map((sub) => (
        <Link
          key={sub.id}
          href={`/resources/${parentSlugPath ? `${parentSlugPath}/${sub.slug}` : sub.slug}`}
          className="block rounded-[10px] border border-border bg-card px-4 py-3.5 transition-all hover:border-foreground/20 hover:shadow-sm"
        >
          <div className="text-[13px] font-semibold truncate">{sub.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {sub.article_count} {sub.article_count === 1 ? "article" : "articles"}
          </div>
        </Link>
      ))}
    </div>
  );
}
