"use client";

import { useState, useMemo, useTransition } from "react";
import { Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ArticleListItem } from "./article-list-item";
import { DeleteResourceDialog } from "./delete-resource-dialog";
import { MoveArticleDialog } from "./move-article-dialog";
import { deleteArticle } from "@/app/(protected)/resources/actions";
import { toast } from "sonner";
import type { ArticleWithAuthor } from "@/types/database.types";

interface ArticlesListProps {
  articles: ArticleWithAuthor[];
  categoryId: string;
  categorySlug: string;
  canEdit: boolean;
  bookmarkedIds?: Set<string>;
}

/**
 * Direct-articles list for a category page (articles attached at the
 * category root, not in a subcategory).
 *
 * Renders zebra-striped rows that flow edge-to-edge inside the parent
 * CategoryContent wrapper. The search input (shown when > 5 articles) sits
 * above the list with its own divider.
 */
export function ArticlesList({
  articles,
  categoryId,
  categorySlug,
  canEdit,
  bookmarkedIds = new Set(),
}: ArticlesListProps) {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ArticleWithAuthor | null>(
    null
  );
  const [moveTarget, setMoveTarget] = useState<ArticleWithAuthor | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter((a) => a.title.toLowerCase().includes(q));
  }, [articles, search]);

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

  return (
    <>
      {articles.length > 5 && (
        <div className="px-6 md:px-7 py-3 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="px-6 py-10">
          <EmptyState
            icon={FileText}
            title={search ? "No articles match your search" : "No articles yet"}
            description={
              canEdit
                ? "Link a Google Doc to add content to this category."
                : "Articles will appear here once published."
            }
          />
        </div>
      ) : (
        <div>
          {filtered.map((article) => (
            <div
              key={article.id}
              className="odd:bg-muted/50 border-b border-border last:border-b-0"
            >
              <ArticleListItem
                article={article}
                categorySlug={categorySlug}
                canEdit={canEdit}
                isBookmarked={bookmarkedIds.has(article.id)}
                onDelete={() => setDeleteTarget(article)}
                onMove={() => setMoveTarget(article)}
              />
            </div>
          ))}
        </div>
      )}

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
          currentCategoryId={categoryId}
          open={!!moveTarget}
          onOpenChange={(open) => {
            if (!open) setMoveTarget(null);
          }}
        />
      )}
    </>
  );
}
