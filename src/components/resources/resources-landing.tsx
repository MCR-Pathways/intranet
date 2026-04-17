"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryGrid } from "./category-grid";
import { ResourceHeaderActions } from "./resource-header-actions";
import { formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Resources"
          subtitle="Policies, procedures, and organisational documents"
        />
        <ResourceHeaderActions canEdit={canEdit} draftCount={draftCount} />
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

      {/* Categories — the primary browsing structure */}
      <CategoryGrid
        categories={categories}
        canEdit={canEdit}
        heading={
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Browse by Category
          </h2>
        }
      />

      {/* Recently Updated — Finder-style zebra table */}
      {recentArticles.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Recently Updated
          </h2>
          <div className="w-full overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentArticles.map((article) => {
                  const categoryPath = article.parent_category_name
                    ? `${article.parent_category_name} / ${article.category_name}`
                    : article.category_name;

                  return (
                    <TableRow key={article.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/resources/article/${article.slug}`}
                          className="hover:underline underline-offset-4"
                        >
                          {article.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {categoryPath}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right whitespace-nowrap">
                        {formatDate(new Date(article.updated_at))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
