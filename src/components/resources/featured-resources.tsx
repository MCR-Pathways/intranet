"use client";

import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import { getExcerpt } from "@/lib/resource-utils";
import type { FeaturedArticle } from "@/app/(protected)/resources/actions";

interface FeaturedResourcesProps {
  articles: FeaturedArticle[];
}

export function FeaturedResources({ articles }: FeaturedResourcesProps) {
  if (articles.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => {
        const Icon = resolveIcon(article.category_icon);
        const colour = resolveIconColour(article.category_icon_colour);
        const excerpt = getExcerpt(article.synced_html, 100);

        return (
          <Link
            key={article.id}
            href={`/resources/article/${article.slug}`}
            className="flex gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:shadow-sm"
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
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{article.title}</p>
              {excerpt && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {excerpt}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5 opacity-70">
                {article.category_name}
                <span className="mx-1">&middot;</span>
                Updated {formatDate(new Date(article.updated_at))}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
