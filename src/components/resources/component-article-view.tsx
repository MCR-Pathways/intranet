"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
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
  componentData: Record<string, unknown>;
}

export function ComponentArticleView({
  article,
  category,
  parentCategory,
  componentData,
}: ComponentArticleViewProps) {
  const Component = article.component_name
    ? COMPONENT_MAP[article.component_name]
    : null;

  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
        <Link
          href="/intranet"
          className="hover:text-foreground hover:underline underline-offset-4"
        >
          Home
        </Link>
        <span className="text-muted-foreground/50 select-none">/</span>
        <Link
          href="/resources"
          className="hover:text-foreground hover:underline underline-offset-4"
        >
          Resources
        </Link>
        {parentCategory && (
          <>
            <span className="text-muted-foreground/50 select-none">/</span>
            <Link
              href={`/resources/${parentCategory.slug}`}
              className="hover:text-foreground hover:underline underline-offset-4"
            >
              {parentCategory.name}
            </Link>
          </>
        )}
        <span className="text-muted-foreground/50 select-none">/</span>
        <Link
          href={`/resources/${parentCategory ? `${parentCategory.slug}/${category.slug}` : category.slug}`}
          className="hover:text-foreground hover:underline underline-offset-4"
        >
          {category.name}
        </Link>
        <span className="text-muted-foreground/50 select-none">/</span>
        <span className="text-foreground font-medium">{article.title}</span>
      </nav>

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
