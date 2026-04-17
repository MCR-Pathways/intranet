"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryGrid } from "./category-grid";
import { EditorHeaderActions } from "./editor-header-actions";
import { formatDate } from "@/lib/utils";
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
  recentArticles: RecentArticle[];
  categories: CategoryTreeNode[];
  canEdit: boolean;
  draftCount: number;
}

function openGlobalSearch() {
  document.dispatchEvent(new CustomEvent("open-global-search"));
}

export function ResourcesLanding({
  recentArticles,
  categories,
  canEdit,
  draftCount,
}: ResourcesLandingProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Resources"
          subtitle="Policies, procedures, and organisational documents"
        />
        <EditorHeaderActions canEdit={canEdit} draftCount={draftCount} />
      </div>

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

      {/* Categories first — the primary browsing structure */}
      <CategoryGrid
        categories={categories}
        canEdit={canEdit}
        heading={
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Browse by Category
          </h2>
        }
      />

      {/* Recently Updated — compact Finder-style list */}
      {recentArticles.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Recently Updated
          </h2>
          <div className="space-y-0.5">
            {recentArticles.map((article) => {
              const categoryPath = article.parent_category_name
                ? `${article.parent_category_name} / ${article.category_name}`
                : article.category_name;

              return (
                <Link
                  key={article.id}
                  href={`/resources/article/${article.slug}`}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-muted/50 group"
                >
                  <span className="font-medium truncate group-hover:text-foreground">
                    {article.title}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[200px] hidden sm:block">
                    {categoryPath}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(new Date(article.updated_at))}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
