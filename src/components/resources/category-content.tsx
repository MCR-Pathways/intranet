"use client";

import { createElement } from "react";
import Link from "next/link";
import { Folder, FolderOpen } from "lucide-react";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import { GroupedIndex } from "./grouped-index";
import { ArticlesList } from "./articles-list";
import { ResourceHeaderActions } from "./resource-header-actions";
import type {
  ResourceCategory,
  CategoryWithCount,
  ArticleWithAuthor,
} from "@/types/database.types";

interface SubcategoryGroup {
  subcategory: CategoryWithCount;
  articles: ArticleWithAuthor[];
}

interface CategoryContentProps {
  category: ResourceCategory;
  categorySlugPath: string;
  ancestors: Array<{ name: string; slug: string; slugPath: string }>;
  subcategoryGroups: SubcategoryGroup[];
  directArticles: ArticleWithAuthor[];
  canEdit: boolean;
  draftCount: number;
  bookmarkedIds?: Set<string>;
}

export function CategoryContent({
  category,
  categorySlugPath,
  ancestors,
  subcategoryGroups,
  directArticles,
  canEdit,
  draftCount,
  bookmarkedIds = new Set(),
}: CategoryContentProps) {
  const colour = resolveIconColour(category.icon_colour);

  // macOS-style: FolderOpen when category has articles, Folder when empty
  const baseIcon = resolveIcon(category.icon);
  const hasContent = directArticles.length > 0 || subcategoryGroups.length > 0;
  const categoryIcon =
    baseIcon === Folder && hasContent ? FolderOpen : baseIcon;

  return (
    <div className="bg-card border border-border shadow-sm rounded-xl overflow-clip">
      {/* Padded top section: breadcrumb + category header */}
      <div className="p-5 md:p-6 space-y-4">
        {/* Breadcrumbs — no "Home", starts from Resources */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
          <Link
            href="/resources"
            className="hover:text-foreground hover:underline underline-offset-4"
          >
            Resources
          </Link>
          {ancestors.map((a) => (
            <span key={a.slug} className="contents">
              <span className="text-muted-foreground/50 select-none">/</span>
              <Link
                href={`/resources/${a.slugPath}`}
                className="hover:text-foreground hover:underline underline-offset-4"
              >
                {a.name}
              </Link>
            </span>
          ))}
          <span className="text-muted-foreground/50 select-none">/</span>
          <span className="text-foreground font-medium">{category.name}</span>
        </nav>

        {/* Category header with contextual editor actions (WS2). */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colour.bg} ${colour.fg}`}
            >
              {createElement(categoryIcon, {
                className: "h-[18px] w-[18px]",
              })}
            </div>
            <div className="min-w-0">
              <h2 className="text-[18px] font-semibold tracking-tight leading-tight">
                {category.name}
              </h2>
              {category.description && (
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {category.description}
                </p>
              )}
            </div>
          </div>
          <ResourceHeaderActions
            canEdit={canEdit}
            draftCount={draftCount}
            defaultCategoryId={category.id}
          />
        </div>
      </div>

      {/* Direct articles in this category (not in subcategories).
          Renders edge-to-edge as zebra rows; its own top border separates
          it from the padded header above. */}
      {directArticles.length > 0 && (
        <section className="border-t border-border">
          <ArticlesList
            articles={directArticles}
            categoryId={category.id}
            categorySlug={category.slug}
            canEdit={canEdit}
            bookmarkedIds={bookmarkedIds}
          />
        </section>
      )}

      {/* Grouped index — subcategories as expandable zebra rows with
          inline articles. */}
      {subcategoryGroups.length > 0 && (
        <section className="border-t border-border">
          <GroupedIndex
            groups={subcategoryGroups}
            parentSlugPath={categorySlugPath}
            parentIconColour={category.icon_colour}
            canEdit={canEdit}
            bookmarkedIds={bookmarkedIds}
          />
        </section>
      )}

      {/* Empty state */}
      {!hasContent && (
        <div className="border-t border-border px-6 py-12 text-sm text-muted-foreground text-center">
          No content in this category yet.
        </div>
      )}
    </div>
  );
}
