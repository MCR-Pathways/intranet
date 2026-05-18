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
  bookmarkedIds?: Set<string>;
}

/**
 * Grouped index for category pages — each subcategory is an expandable row
 * showing its articles inline when expanded.
 *
 * Layout: a flat list of zebra-striped rows that flow edge-to-edge inside
 * the parent CategoryContent wrapper. Folder rows alternate `bg-muted/50` /
 * `bg-card`; article rows nest inside the expanded folder with a softer
 * background tint so the hierarchy is visible without per-row borders.
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
  bookmarkedIds = new Set(),
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
      <div>
        {groups.map(({ subcategory, articles }) => {
          const isOpen = !collapsed.has(subcategory.id);
          const subcatPath = `${parentSlugPath}/${subcategory.slug}`;

          return (
            <div
              key={subcategory.id}
              className="odd:bg-muted/50 border-b border-border last:border-b-0"
            >
              {/* Folder row — name navigates, kebab handles actions, chevron toggles */}
              <div className="flex items-center hover:bg-muted/70 transition-colors">
                <Link
                  href={`/resources/${subcatPath}`}
                  className="group/link flex items-center gap-2.5 px-5 md:px-6 py-2.5 flex-1 min-w-0"
                >
                  <FolderOpen
                    className={cn("h-4 w-4 shrink-0", colour.fg)}
                  />
                  {/* Underline only the name — parent-Link underline cascades
                      through the icon otherwise. `title` exposes the full
                      name when truncated by `truncate`. */}
                  <span
                    className="font-medium text-sm truncate group-hover/link:underline underline-offset-4 decoration-muted-foreground/30"
                    title={subcategory.name}
                  >
                    {subcategory.name}
                  </span>
                </Link>
                {canEdit && (
                  <div className="px-1 shrink-0">
                    <CategoryCardActions
                      category={subcategory}
                      canEdit={canEdit}
                      variant="inline"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => toggleSection(subcategory.id)}
                  className="flex items-center px-3 md:px-4 py-2.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label={
                    isOpen
                      ? `Collapse ${subcategory.name}`
                      : `Expand ${subcategory.name}`
                  }
                  aria-expanded={isOpen}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      !isOpen && "-rotate-90"
                    )}
                  />
                </button>
              </div>

              {/* Articles list — nested under the folder. Inherits the
                  folder row's zebra background; a thin top border separates
                  the folder header from its children. Article rows indent
                  via `variant="compact"` (see article-list-item.tsx). */}
              {isOpen && articles.length > 0 && (
                <div className="border-t border-border/50">
                  {articles.map((article) => (
                    <ArticleListItem
                      key={article.id}
                      article={article}
                      categorySlug={subcategory.slug}
                      canEdit={canEdit}
                      isBookmarked={bookmarkedIds.has(article.id)}
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
