"use client";

import { createElement } from "react";
import Link from "next/link";
import { Folder, FolderOpen } from "lucide-react";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import { GroupedIndex } from "./grouped-index";
import { ArticlesList } from "./articles-list";
import { AdminBar } from "./admin-bar";
import type {
  ResourceCategory,
  CategoryWithCount,
  ArticleWithAuthor,
} from "@/types/database.types";

interface SubcategoryGroup {
  subcategory: CategoryWithCount;
  articles: Array<{ id: string; title: string; slug: string; updated_at: string }>;
}

interface CategoryContentProps {
  category: ResourceCategory;
  categorySlugPath: string;
  ancestors: Array<{ name: string; slug: string; slugPath: string }>;
  /** Subcategories with their articles for the grouped index */
  subcategoryGroups: SubcategoryGroup[];
  /** Articles directly in this category (not in subcategories) */
  directArticles: ArticleWithAuthor[];
  canEdit: boolean;
}

export function CategoryContent({
  category,
  categorySlugPath,
  ancestors,
  subcategoryGroups,
  directArticles,
  canEdit,
}: CategoryContentProps) {
  const colour = resolveIconColour(category.icon_colour);

  // macOS-style: FolderOpen when category has articles, Folder when empty
  const baseIcon = resolveIcon(category.icon);
  const hasContent = directArticles.length > 0 || subcategoryGroups.length > 0;
  const categoryIcon =
    baseIcon === Folder && hasContent ? FolderOpen : baseIcon;

  return (
    <div className="bg-card shadow-md rounded-xl overflow-clip p-6 md:p-7 space-y-5" style={{ minHeight: "calc(100vh - 14rem)" }}>
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

      {/* Admin bar — visible when editor mode on */}
      <AdminBar />

      {/* Category header */}
      <div className="flex items-center gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colour.bg} ${colour.fg}`}
        >
          {createElement(categoryIcon, {
            className: "h-[22px] w-[22px]",
          })}
        </div>
        <div>
          <h2 className="text-[22px] font-bold tracking-tight">
            {category.name}
          </h2>
          {category.description && (
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {category.description}
            </p>
          )}
        </div>
      </div>

      {/* Direct articles in this category (not in subcategories) */}
      {directArticles.length > 0 && (
        <section>
          <ArticlesList
            articles={directArticles}
            categoryId={category.id}
            categorySlug={category.slug}
            canEdit={canEdit}
          />
        </section>
      )}

      {/* Grouped index — subcategories as expandable sections with articles */}
      {subcategoryGroups.length > 0 && (
        <GroupedIndex
          groups={subcategoryGroups}
          parentSlugPath={categorySlugPath}
          parentIconColour={category.icon_colour}
        />
      )}

      {/* Empty state */}
      {!hasContent && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No content in this category yet.
        </div>
      )}
    </div>
  );
}
