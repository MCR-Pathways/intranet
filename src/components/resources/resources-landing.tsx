"use client";

import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { FeaturedResources } from "./featured-resources";
import { CategoryGrid } from "./category-grid";
import { AdminBar } from "./admin-bar";
import { cn, formatDate } from "@/lib/utils";
import type { FeaturedArticle } from "@/app/(protected)/resources/actions";
import type { CategoryTreeNode } from "@/types/database.types";

interface RecentArticle {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  category_name: string;
  category_slug: string;
  parent_category_name: string | null;
}

interface ResourcesLandingProps {
  featuredArticles: FeaturedArticle[];
  recentArticles: RecentArticle[];
  categories: CategoryTreeNode[];
}

/** Open the global search overlay via custom event. */
function openGlobalSearch() {
  document.dispatchEvent(new CustomEvent("open-global-search"));
}

export function ResourcesLanding({
  featuredArticles,
  recentArticles,
  categories,
}: ResourcesLandingProps) {
  return (
    <div className="space-y-6">
      {/* Page header — matches Home ("News Feed") and Learning ("Learning") */}
      <PageHeader
        title="Resources"
        subtitle="Policies, procedures, and organisational documents"
      />

      {/* Admin bar — visible when editor mode on */}
      <AdminBar />

      {/* Search prompt — opens global Cmd+K overlay */}
      <button
        type="button"
        onClick={openGlobalSearch}
        className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:shadow-sm"
      >
        <Search className="h-4 w-4" />
        <span>Search resources...</span>
        <kbd
          suppressHydrationWarning
          className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {typeof window !== "undefined" && !/mac/i.test(navigator.platform)
            ? "Ctrl+K"
            : "⌘K"}
        </kbd>
      </button>

      {/* Featured articles — above categories (Zendesk pattern) */}
      {featuredArticles.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Key Resources
          </h2>
          <FeaturedResources articles={featuredArticles} />
        </section>
      )}

      {/* Browse by Category — empty categories hidden by CategoryGrid */}
      {categories.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Browse by Category
          </h2>
          <CategoryGrid categories={categories} />
        </section>
      )}

      {/* Recently updated — inside its own card surface */}
      {recentArticles.length > 0 && (
        <section className="rounded-xl bg-card shadow-sm border border-border p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Recently Updated
          </h2>
          <div>
            {recentArticles.map((article, i) => {
              const categoryPath = article.parent_category_name
                ? `${article.parent_category_name} / ${article.category_name}`
                : article.category_name;

              return (
                <Link
                  key={article.id}
                  href={`/resources/article/${article.slug}`}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 transition-colors group",
                    i % 2 === 1 && "bg-muted/40",
                    "hover:bg-muted"
                  )}
                >
                  <FileText className="h-[18px] w-[18px] text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-foreground">
                      {article.title}
                    </p>
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
