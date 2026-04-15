"use client";

import Link from "next/link";
import { ArrowRight, FileEdit, FileText, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { FeaturedResources } from "./featured-resources";
import { CategoryGrid } from "./category-grid";
import { EditorHeaderActions } from "./editor-header-actions";
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

interface RecentDraft {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  category_name: string;
  parent_category_name: string | null;
}

interface ResourcesLandingProps {
  featuredArticles: FeaturedArticle[];
  recentArticles: RecentArticle[];
  categories: CategoryTreeNode[];
  canEdit: boolean;
  draftCount: number;
  /** 5 most-recent drafts for the editor-only "In progress" section. Empty for readers. */
  recentDrafts: RecentDraft[];
}

/** Open the global search overlay via custom event. */
function openGlobalSearch() {
  document.dispatchEvent(new CustomEvent("open-global-search"));
}

export function ResourcesLanding({
  featuredArticles,
  recentArticles,
  categories,
  canEdit,
  draftCount,
  recentDrafts,
}: ResourcesLandingProps) {
  return (
    <div className="space-y-6">
      {/* Page header with contextual editor actions (WS2). */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Resources"
          subtitle="Policies, procedures, and organisational documents"
        />
        <EditorHeaderActions canEdit={canEdit} draftCount={draftCount} />
      </div>

      {/* Search input — on focus, opens the global Cmd+K overlay. Radix Dialog's
          focus trap then steals focus to the overlay input, so keystrokes flow
          there naturally. */}
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search resources..."
          onFocus={openGlobalSearch}
          className="w-full rounded-xl border border-border bg-card pl-10 pr-16 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors hover:border-foreground/20 hover:shadow-sm focus:outline-none focus:border-foreground/20 focus:shadow-sm"
        />
        <kbd
          suppressHydrationWarning
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {typeof window !== "undefined" && !/mac/i.test(navigator.platform)
            ? "Ctrl+K"
            : "⌘K"}
        </kbd>
      </div>

      {/* In progress — editor-only section. Ambient awareness for "what was I writing?" */}
      {canEdit && recentDrafts.length > 0 && (
        <section className="rounded-xl bg-card shadow-sm border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              In progress
            </h2>
            <Link
              href="/resources/drafts"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View all drafts
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div>
            {recentDrafts.map((draft, i) => {
              const categoryPath = draft.parent_category_name
                ? `${draft.parent_category_name} / ${draft.category_name}`
                : draft.category_name;
              return (
                <Link
                  key={draft.id}
                  href={`/resources/article/${draft.slug}`}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 transition-colors group",
                    i % 2 === 1 && "bg-muted/40",
                    "hover:bg-muted"
                  )}
                >
                  <FileEdit className="h-[18px] w-[18px] text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-foreground">
                      {draft.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {categoryPath}
                      <span className="mx-1.5 text-border">&middot;</span>
                      Updated {formatDate(new Date(draft.updated_at))}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured articles — above categories (Zendesk pattern).
          Editors see an empty-state placeholder when nothing is featured yet. */}
      {featuredArticles.length > 0 ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Key Resources
          </h2>
          <FeaturedResources articles={featuredArticles} canEdit={canEdit} />
        </section>
      ) : canEdit ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Key Resources
          </h2>
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No featured resources yet. Open an article&apos;s menu and select
            &ldquo;Feature&rdquo; to surface up to 3 key resources here.
          </div>
        </section>
      ) : null}

      {/* Recently Updated — promoted above Browse by Category (WS3 finding F7) */}
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
                      Updated {formatDate(new Date(article.updated_at))}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Browse by Category — empty categories hidden by CategoryGrid */}
      {categories.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Browse by Category
          </h2>
          <CategoryGrid categories={categories} canEdit={canEdit} />
        </section>
      )}
    </div>
  );
}
