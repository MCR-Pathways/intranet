"use client";

import dynamic from "next/dynamic";
import { ArticleBreadcrumb } from "./article-breadcrumb";
import { BookmarkToggle } from "./bookmark-toggle";
import type { ArticleWithAuthor, ResourceCategory } from "@/types/database.types";

// ─── Dynamic imports for component pages ────────────────────────────────────

const OrgChartContent = dynamic(
  () =>
    import("@/components/hr/org-chart-content").then(
      (mod) => mod.OrgChartContent
    ),
  { loading: () => <ComponentLoading /> }
);

function ComponentLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
      Loading...
    </div>
  );
}

// ─── Component map ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  "org-chart": OrgChartContent,
};

// ─── View ───────────────────────────────────────────────────────────────────

interface ComponentArticleViewProps {
  article: ArticleWithAuthor;
  category: ResourceCategory;
  parentCategory: { name: string; slug: string } | null;
  isBookmarked?: boolean;
  componentData: Record<string, unknown>;
}

export function ComponentArticleView({
  article,
  category,
  parentCategory,
  isBookmarked = false,
  componentData,
}: ComponentArticleViewProps) {
  const Component = article.component_name
    ? COMPONENT_MAP[article.component_name]
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <ArticleBreadcrumb
          category={category}
          parentCategory={parentCategory}
          title={article.title}
        />
        <BookmarkToggle articleId={article.id} initialBookmarked={isBookmarked} />
      </div>

      {/* Component content */}
      {Component ? (
        <Component {...componentData} />
      ) : (
        <div className="text-sm text-muted-foreground italic py-8">
          Component &ldquo;{article.component_name}&rdquo; not found in registry.
        </div>
      )}
    </div>
  );
}
