"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { FeaturedResources } from "./featured-resources";
import { CategoryGrid } from "./category-grid";
import { AdminBar } from "./admin-bar";
import { ResourceSearch } from "./resource-search";
import { formatDate } from "@/lib/utils";
import { getExcerpt } from "@/lib/resource-utils";
import type { FeaturedArticle } from "@/app/(protected)/resources/actions";
import type { CategoryTreeNode } from "@/types/database.types";

interface RecentArticle {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  synced_html: string | null;
  category_name: string;
  category_slug: string;
  parent_category_name: string | null;
}

interface ResourcesLandingProps {
  featuredArticles: FeaturedArticle[];
  recentArticles: RecentArticle[];
  categories: CategoryTreeNode[];
}

export function ResourcesLanding({
  featuredArticles,
  recentArticles,
  categories,
}: ResourcesLandingProps) {
  return (
    <div className="space-y-8">
      {/* Admin bar — visible when editor mode on */}
      <AdminBar />

      {/* Algolia-powered search + results */}
      <ResourceSearch />

      {/* Browse by Category */}
      {categories.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">
            Browse by Category
          </h2>
          <CategoryGrid categories={categories} />
        </section>
      )}

      {/* Featured articles */}
      {featuredArticles.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            Key Resources
          </h2>
          <FeaturedResources articles={featuredArticles} />
        </section>
      )}

      {/* Recently updated */}
      {recentArticles.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            Recently Updated
          </h2>
          <div className="flex flex-col">
            {recentArticles.map((article) => {
              const excerpt = getExcerpt(article.synced_html, 100);
              const categoryPath = article.parent_category_name
                ? `${article.parent_category_name} / ${article.category_name}`
                : article.category_name;

              return (
                <Link
                  key={article.id}
                  href={`/resources/article/${article.slug}`}
                  className="flex items-start gap-3 px-3.5 py-3 rounded-lg hover:bg-muted transition-colors group"
                >
                  <FileText className="h-[18px] w-[18px] text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-foreground">
                      {article.title}
                    </p>
                    {excerpt && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate opacity-75">
                        {excerpt}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {categoryPath}
                      <span className="mx-1.5 text-border">&middot;</span>
                      {formatDate(new Date(article.updated_at))}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
