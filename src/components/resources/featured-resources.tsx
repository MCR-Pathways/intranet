"use client";

import Link from "next/link";
import { Folder } from "lucide-react";
import { ICON_MAP } from "./category-card";
import type { FeaturedArticle } from "@/app/(protected)/intranet/resources/actions";

interface FeaturedResourcesProps {
  articles: FeaturedArticle[];
}

export function FeaturedResources({ articles }: FeaturedResourcesProps) {
  if (articles.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Key Resources
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => {
          const Icon =
            (article.category_icon && ICON_MAP[article.category_icon]) ||
            Folder;

          return (
            <Link
              key={article.id}
              href={`/intranet/resources/${article.category_slug}/${article.slug}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{article.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {article.category_name}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
