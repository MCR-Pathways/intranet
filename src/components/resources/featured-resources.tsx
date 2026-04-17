"use client";

import { createElement } from "react";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import { getExcerpt } from "@/lib/resource-utils";
import { FeaturedCardActions } from "./featured-card-actions";
import type { FeaturedArticle } from "@/app/(protected)/resources/actions";

interface FeaturedResourcesProps {
  articles: FeaturedArticle[];
  canEdit?: boolean;
}

export function FeaturedResources({ articles, canEdit = false }: FeaturedResourcesProps) {
  if (articles.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, idx) => {
        const Icon = resolveIcon(article.category_icon);
        const colour = resolveIconColour(article.category_icon_colour);
        const excerpt = getExcerpt(article.synced_html, 100);

        return (
          <div
            key={article.id}
            className="group/card relative rounded-xl border border-border bg-card shadow-sm transition-all hover:border-foreground/20 hover:shadow-md"
          >
            <Link
              href={`/resources/article/${article.slug}`}
              className="flex gap-3 p-4"
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  colour.bg,
                  colour.fg
                )}
              >
                {createElement(Icon, { className: "h-4 w-4" })}
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
            <FeaturedCardActions
              articleId={article.id}
              articleTitle={article.title}
              canEdit={canEdit}
              isFirst={idx === 0}
              isLast={idx === articles.length - 1}
            />
          </div>
        );
      })}
    </div>
  );
}
