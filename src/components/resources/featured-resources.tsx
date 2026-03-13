"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import type { FeaturedArticle } from "@/app/(protected)/resources/actions";

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
          const Icon = resolveIcon(article.category_icon);
          const colour = resolveIconColour(article.category_icon_colour);

          return (
            <Link
              key={article.id}
              href={`/resources/${article.category_slug}/${article.slug}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:shadow-sm"
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  colour.bg,
                  colour.fg
                )}
              >
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
