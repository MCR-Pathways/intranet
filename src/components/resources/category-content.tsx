"use client";

import { createElement } from "react";
import Link from "next/link";
import { Folder, FolderOpen } from "lucide-react";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import { SubcategoryGrid } from "./subcategory-grid";
import { ArticlesList } from "./articles-list";
import type {
  ResourceCategory,
  CategoryWithCount,
  ArticleWithAuthor,
} from "@/types/database.types";

interface CategoryContentProps {
  category: ResourceCategory;
  categorySlugPath: string;
  ancestors: Array<{ name: string; slug: string; slugPath: string }>;
  subcategories: CategoryWithCount[];
  articles: ArticleWithAuthor[];
  canEdit: boolean;
}

export function CategoryContent({
  category,
  categorySlugPath,
  ancestors,
  subcategories,
  articles,
  canEdit,
}: CategoryContentProps) {
  const colour = resolveIconColour(category.icon_colour);

  // macOS-style: FolderOpen when category has articles, Folder when empty
  const baseIcon = resolveIcon(category.icon);
  const categoryIcon =
    baseIcon === Folder && articles.length > 0 ? FolderOpen : baseIcon;

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

      {/* Subcategory cards */}
      {subcategories.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Subcategories
          </h3>
          <SubcategoryGrid
            subcategories={subcategories}
            parentSlugPath={categorySlugPath}
          />
        </section>
      )}

      {/* Article list */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Articles
          {articles.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              {articles.length}
            </span>
          )}
        </h3>
        <ArticlesList
          articles={articles}
          categoryId={category.id}
          categorySlug={category.slug}
          canEdit={canEdit}
        />
      </section>
    </div>
  );
}
