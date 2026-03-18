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
}

export function ArticlesList({
  articles,
  categoryId,
  categorySlug,
  canEdit,
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
    <div className="space-y-3">
      {articles.length > 5 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search ? "No articles match your search" : "No articles yet"}
          description={
            canEdit
              ? "Link a Google Doc to add content to this category."
              : "Articles will appear here once published."
          }
        />
      ) : (
        <div className="rounded-lg bg-background p-1">
          {filtered.map((article) => (
            <ArticleListItem
              key={article.id}
              article={article}
              categorySlug={categorySlug}
              canEdit={canEdit}
              onDelete={() => setDeleteTarget(article)}
              onMove={() => setMoveTarget(article)}
            />
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
    </div>
  );
}
