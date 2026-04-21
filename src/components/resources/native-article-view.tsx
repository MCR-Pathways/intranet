"use client";

/**
 * View component for native Plate articles.
 *
 * Renders content_json via PlateStatic in the same prose container
 * as Google Doc articles for visual parity. Includes kebab menu
 * with edit, feature, move, and delete actions.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { PlateStatic } from "platejs/static";
import {
  MoreHorizontal,
  Pencil,
  FolderInput,
  Trash2,
  Eye,
  EyeOff,
  FileEdit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreInSection } from "./more-in-section";
import { ArticleOutline } from "./article-outline";
import { MoveArticleDialog } from "./move-article-dialog";
import { DeleteResourceDialog } from "./delete-resource-dialog";
import {
  deleteArticle,
} from "@/app/(protected)/resources/actions";
import {
  publishNativeArticle,
  unpublishNativeArticle,
} from "@/app/(protected)/resources/native-actions";
import { cn, formatDate } from "@/lib/utils";
import { ArticleBreadcrumb } from "./article-breadcrumb";
import { BookmarkToggle } from "./bookmark-toggle";
import { recordArticleView } from "@/lib/recently-viewed";
import { useScrollSpy } from "@/lib/use-scroll-spy";
import { ARTICLE_PROSE_CLASSES, ARTICLE_CARD_CLASSES } from "@/lib/article-constants";
import { prepareNativeArticle } from "@/lib/plate-static-plugins";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Value } from "platejs";
import type { ArticleWithAuthor, ResourceCategory } from "@/types/database.types";

interface SiblingArticle {
  id: string;
  title: string;
  slug: string;
}

interface NativeArticleViewProps {
  article: ArticleWithAuthor;
  category: ResourceCategory;
  parentCategory: { name: string; slug: string } | null;
  canEdit: boolean;
  isBookmarked?: boolean;
  siblings?: SiblingArticle[];
  categoryPath?: string;
  serverNow: number;
}

export function NativeArticleView({
  article: initialArticle,
  category,
  parentCategory,
  canEdit,
  isBookmarked = false,
  siblings = [],
  categoryPath = "",
  serverNow,
}: NativeArticleViewProps) {
  const [article, setArticle] = useState(initialArticle);
  const [isPending, startTransition] = useTransition();
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    setArticle(initialArticle);
  }, [initialArticle]);

  // Drafts never enter the recently-viewed list — prevents stale entries.
  useEffect(() => {
    if (article.status !== "published") return;
    recordArticleView({ id: article.id, title: article.title, slug: article.slug });
  }, [article.id, article.title, article.slug, article.status]);

  // ─── Prepare content: editor + headings for TOC ───────────────────────────

  const contentJson = (article as unknown as { content_json?: unknown }).content_json as Value | undefined;

  const { editor, headings } = useMemo(() => {
    if (!contentJson) return { editor: null, headings: [] };
    return prepareNativeArticle(contentJson);
  }, [contentJson]);

  const [activeHeadingId, setActiveHeadingId] = useScrollSpy(headings);

  // ─── Freshness indicator ──────────────────────────────────────────────────

  const isStale = useMemo(() => {
    const ts = new Date(article.updated_at).getTime();
    const monthsOld = Math.floor(
      (serverNow - ts) / (1000 * 60 * 60 * 24 * 30)
    );
    return monthsOld >= 12;
  }, [article.updated_at, serverNow]);

  // ─── Supabase Realtime: live updates for status/title changes ─────────────

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`article-${article.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "resource_articles",
          filter: `id=eq.${article.id}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          // Only update status/title/timestamp — skip content_json
          // (auto-save fires every 5s during editing, we don't want noise)
          const newStatus = updated.status as "draft" | "published" | undefined;
          const newTitle = updated.title as string | undefined;
          setArticle((prev) => {
            if (
              newStatus === prev.status &&
              newTitle === prev.title
            ) {
              return prev; // No meaningful change
            }
            return {
              ...prev,
              status: newStatus ?? prev.status,
              title: newTitle ?? prev.title,
              updated_at: (updated.updated_at as string) ?? prev.updated_at,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [article.id]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleTogglePublish = () => {
    const isPublished = article.status === "published";
    startTransition(async () => {
      const result = isPublished
        ? await unpublishNativeArticle(article.id)
        : await publishNativeArticle(article.id);
      if (result.success) {
        setArticle((prev) => ({
          ...prev,
          status: isPublished ? "draft" : "published",
        }));
        toast.success(isPublished ? "Article unpublished" : "Article published");
      } else {
        toast.error(result.error ?? "Failed to update status");
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteArticle(article.id);
      if (result.success) {
        toast.success("Article moved to bin");
        window.location.href = `/resources/${categoryPath}`;
      } else {
        toast.error(result.error ?? "Failed to delete article");
      }
    });
  };

  const updatedAt = article.updated_at;

  // Edit URL — native articles open the Plate editor
  const editUrl = `/resources/article/${article.slug}/edit`;

  return (
    <div className={ARTICLE_CARD_CLASSES} style={{ minHeight: "calc(100vh - 14rem)" }}>
      <ArticleBreadcrumb
        category={category}
        parentCategory={parentCategory}
        title={article.title}
      />

      {/* Article header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <h1 className="text-[26px] font-bold tracking-tight leading-tight">
              {article.title}
            </h1>
            {canEdit && article.status === "draft" && (
              <Badge
                variant="secondary"
                className="gap-1 font-medium"
                title="Only content editors can see this article"
                aria-label="Draft — only visible to editors"
              >
                <FileEdit className="h-3 w-3" />
                Draft
              </Badge>
            )}
          </div>

          {/* gap-2 intentionally differs from google-doc-article-view's
              gap-1: its cluster is all ghost icons with "halo" of transparent
              space, so 4px between them breathes. This cluster mixes ghost
              icons with the solid-fill Edit button, which has no halo — 4px
              reads cramped, 8px restores breathing room. Numeric parity on
              gap value is less important than within-cluster visual balance. */}
          <div className="flex items-center gap-2 shrink-0">
            {article.status === "published" && (
              <BookmarkToggle articleId={article.id} initialBookmarked={isBookmarked} />
            )}
            {/* Navy Edit button — kept on native because it routes to the
                in-product Plate editor at /edit (a real product surface).
                google-doc-article-view deliberately removed its Edit button
                because it would just punt to Drive, which the banner already
                covers. Intentional asymmetry between the two views. */}
            {canEdit && (
              <Button size="sm" asChild>
                <Link href={editUrl}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}

          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={isPending}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions for {article.title}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Edit is the primary button next to the title — not duplicated here. */}
                <DropdownMenuItem onSelect={handleTogglePublish}>
                  {article.status === "published" ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Unpublish
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Publish
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowMoveDialog(true)}>
                  <FolderInput className="h-4 w-4" />
                  Move to...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1.5 text-[13px] text-muted-foreground flex-wrap">
          <span className={isStale ? "text-amber-600" : undefined}>
            Updated {formatDate(new Date(updatedAt))}
            {isStale && " — may need review"}
          </span>
        </div>
      </div>

      {/* Article body — two-column: content + outline sidebar */}
      {editor ? (
        <div className="flex gap-8">
          <article className={cn(ARTICLE_PROSE_CLASSES, "flex-1 min-w-0")}>
            <PlateStatic editor={editor} />
          </article>

          {/* Article outline sidebar (table of contents) */}
          <ArticleOutline
            headings={headings}
            activeHeadingId={activeHeadingId}
            onHeadingClick={setActiveHeadingId}
          />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic py-8">
          This article has no content yet.
          {canEdit && (
            <>
              {" "}
              <Link href={editUrl} className="text-link underline underline-offset-4">
                Start editing
              </Link>
            </>
          )}
        </div>
      )}

      {/* Sibling navigation */}
      <MoreInSection
        categoryName={category.name}
        categoryPath={categoryPath}
        siblings={siblings}
        currentArticleId={article.id}
      />

      {/* Dialogs */}
      <MoveArticleDialog
        articleId={article.id}
        articleTitle={article.title}
        currentCategoryId={category.id}
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
      />
      <DeleteResourceDialog
        itemName={article.title}
        onConfirm={handleDelete}
        disabled={isPending}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </div>
  );
}
