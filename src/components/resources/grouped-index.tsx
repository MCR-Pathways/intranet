"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIconColour } from "@/lib/resource-icons";
import { CategoryCardActions } from "./category-card-actions";
import { ArticleListItem } from "./article-list-item";
import { DeleteResourceDialog } from "./delete-resource-dialog";
import { MoveArticleDialog } from "./move-article-dialog";
import { UnlinkDialog } from "./unlink-dialog";
import { deleteArticle } from "@/app/(protected)/resources/actions";
import { unlinkGoogleDoc } from "@/app/(protected)/resources/drive-actions";
import { toast } from "sonner";
import type { CategoryWithCount, ArticleWithAuthor } from "@/types/database.types";

interface SubcategoryGroup {
  subcategory: CategoryWithCount;
  articles: ArticleWithAuthor[];
}

interface GroupedIndexProps {
  groups: SubcategoryGroup[];
  parentSlugPath: string;
  parentIconColour?: string | null;
  canEdit?: boolean;
}

/**
 * Grouped index for category pages — each subcategory is an expandable
 * section showing its articles inline. Replaces the old subcategory cards
 * + flat article list pattern to eliminate duplication.
 *
 * WS2: editors see a kebab on each subcategory section header (Rename /
 * + New subcategory / Delete) and a kebab on each nested article row
 * (Edit / Move / Publish-or-Unpublish / Unlink / Delete).
 */
export function GroupedIndex({
  groups,
  parentSlugPath,
  parentIconColour,
  canEdit = false,
}: GroupedIndexProps) {
  // Empty sections start collapsed to reduce noise
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () =>
      new Set(
        groups
          .filter((g) => g.articles.length === 0)
          .map((g) => g.subcategory.id)
      )
  );
  const [deleteTarget, setDeleteTarget] = useState<ArticleWithAuthor | null>(null);
  const [moveTarget, setMoveTarget] = useState<ArticleWithAuthor | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<ArticleWithAuthor | null>(null);
  const [isPending, startTransition] = useTransition();

  const colour = resolveIconColour(parentIconColour);

  function toggleSection(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteArticle(deleteTarget.id);
      if (result.success) {
        toast.success("Article removed");
        setDeleteTarget(null);
      } else {
        toast.error(result.error ?? "Failed to delete article");
      }
    });
  }

  function handleUnlink() {
    if (!unlinkTarget) return;
    startTransition(async () => {
      const result = await unlinkGoogleDoc(unlinkTarget.id);
      if (result.success) {
        toast.success("Google Doc unlinked");
        setUnlinkTarget(null);
      } else {
        toast.error(result.error ?? "Failed to unlink");
      }
    });
  }

  if (groups.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No content in this category yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {groups.map(({ subcategory, articles }) => {
          const isOpen = !collapsed.has(subcategory.id);
          const subcatPath = `${parentSlugPath}/${subcategory.slug}`;

          return (
            <div
              key={subcategory.id}
              className="group/card relative rounded-xl border border-border overflow-hidden"
            >
              {/* Section header — name navigates, chevron toggles, kebab handles actions */}
              <div className="flex items-center bg-card">
                <Link
                  href={`/resources/${subcatPath}`}
                  className="flex items-center gap-2.5 px-4 py-3 flex-1 min-w-0 hover:bg-muted/50 transition-colors"
                >
                  <FolderOpen className={cn("h-4 w-4 shrink-0", colour.fg)} />
                  <span className="font-semibold text-[13px] truncate hover:underline underline-offset-4">
                    {subcategory.name}
                  </span>
                  {articles.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-1 shrink-0">
                      {articles.length} {articles.length === 1 ? "article" : "articles"}
                    </span>
                  )}
                </Link>
                {/* Editor kebab — between link and chevron per plan spec */}
                {canEdit && (
                  <div className="relative flex items-center pr-1">
                    <CategoryCardActions
                      category={subcategory}
                      canEdit={canEdit}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => toggleSection(subcategory.id)}
                  className="flex items-center px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-l border-border"
                  aria-label={isOpen ? `Collapse ${subcategory.name}` : `Expand ${subcategory.name}`}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      !isOpen && "-rotate-90"
                    )}
                  />
                </button>
              </div>

              {/* Articles list — collapses. Uses ArticleListItem compact variant
                  so each nested row gets the full editor kebab. */}
              {isOpen && articles.length > 0 && (
                <div className="border-t border-border p-1.5">
                  {articles.map((article) => (
                    <ArticleListItem
                      key={article.id}
                      article={article}
                      categorySlug={subcategory.slug}
                      canEdit={canEdit}
                      variant="compact"
                      onDelete={() => setDeleteTarget(article)}
                      onMove={() => setMoveTarget(article)}
                      onUnlink={() => setUnlinkTarget(article)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete confirmation */}
      <DeleteResourceDialog
        itemName={deleteTarget?.title ?? ""}
        onConfirm={handleDelete}
        disabled={isPending}
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />

      {/* Move dialog */}
      {moveTarget && (
        <MoveArticleDialog
          articleId={moveTarget.id}
          articleTitle={moveTarget.title}
          currentCategoryId={moveTarget.category_id}
          open={!!moveTarget}
          onOpenChange={(open) => {
            if (!open) setMoveTarget(null);
          }}
        />
      )}

      {/* Unlink dialog (Google Doc articles only) */}
      {unlinkTarget && (
        <UnlinkDialog
          articleTitle={unlinkTarget.title}
          onConfirm={handleUnlink}
          disabled={isPending}
          open={!!unlinkTarget}
          onOpenChange={(open) => {
            if (!open) setUnlinkTarget(null);
          }}
        />
      )}
    </>
  );
}
