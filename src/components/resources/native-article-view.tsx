"use client";

/**
 * View component for native Plate articles.
 *
 * Renders content_json via PlateStatic in the same prose container
 * as Google Doc articles for visual parity. Includes kebab menu
 * with edit, feature, move, and delete actions.
 */

import { createElement, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  Pencil,
  Star,
  StarOff,
  FolderInput,
  Trash2,
  Eye,
  EyeOff,
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
import { MoveArticleDialog } from "./move-article-dialog";
import { DeleteResourceDialog } from "./delete-resource-dialog";
import { useEditorMode } from "./editor-mode-context";
import {
  toggleArticleFeatured,
  deleteArticle,
} from "@/app/(protected)/resources/actions";
import {
  publishNativeArticle,
  unpublishNativeArticle,
} from "@/app/(protected)/resources/native-actions";
import { cn, formatDate } from "@/lib/utils";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import { recordArticleView } from "@/lib/recently-viewed";
import { PlateStaticView } from "./plate-static-view";
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
  siblings?: SiblingArticle[];
  categoryPath?: string;
}

export function NativeArticleView({
  article: initialArticle,
  category,
  parentCategory,
  canEdit,
  siblings = [],
  categoryPath = "",
}: NativeArticleViewProps) {
  const { editorMode } = useEditorMode();
  const [article, setArticle] = useState(initialArticle);
  const [isPending, startTransition] = useTransition();
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    setArticle(initialArticle);
  }, [initialArticle]);

  useEffect(() => {
    recordArticleView({ id: article.id, title: article.title, slug: article.slug });
  }, [article.id, article.title, article.slug]);

  const handleToggleFeatured = () => {
    startTransition(async () => {
      const result = await toggleArticleFeatured(article.id);
      if (result.success) {
        setArticle((prev) => ({
          ...prev,
          is_featured: !prev.is_featured,
        }));
        toast.success(
          article.is_featured ? "Removed from featured" : "Added to featured"
        );
      }
    });
  };

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
  const contentJson = (article as unknown as { content_json?: unknown }).content_json as Value | undefined;

  const iconFg = resolveIconColour(category.icon_colour).fg;

  // Edit URL — native articles open the Plate editor
  const editUrl = `/resources/article/${article.slug}/edit`;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/resources" className="hover:underline underline-offset-4">
          Resources
        </Link>
        <span className="text-muted-foreground/50">/</span>
        {parentCategory && (
          <>
            <Link
              href={`/resources/${parentCategory.slug}`}
              className="hover:underline underline-offset-4"
            >
              {parentCategory.name}
            </Link>
            <span className="text-muted-foreground/50">/</span>
          </>
        )}
        <Link
          href={`/resources/${categoryPath}`}
          className="hover:underline underline-offset-4 inline-flex items-center gap-1.5"
        >
          {createElement(resolveIcon(category.icon), {
            className: cn("h-3.5 w-3.5", iconFg),
          })}
          {category.name}
        </Link>
      </nav>

      {/* Article header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">
            {article.title}
          </h1>

          {editorMode && canEdit && (
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
                <DropdownMenuItem asChild>
                  <Link href={editUrl}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
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
                <DropdownMenuItem onSelect={handleToggleFeatured}>
                  {article.is_featured ? (
                    <>
                      <StarOff className="h-4 w-4" />
                      Unfeature
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4" />
                      Feature
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

        <div className="flex items-center gap-2 mt-1.5 text-[13px] text-muted-foreground flex-wrap">
          <span>Updated {formatDate(new Date(updatedAt))}</span>
          {editorMode && article.is_featured && (
            <>
              <span className="text-border">&middot;</span>
              <Badge variant="secondary" className="text-[10px] py-0">
                Featured
              </Badge>
            </>
          )}
          {editorMode && article.status === "draft" && (
            <>
              <span className="text-border">&middot;</span>
              <Badge variant="outline" className="text-[10px] py-0 text-amber-600 border-amber-300">
                Draft
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Article body */}
      {contentJson ? (
        <article className="prose prose-sm max-w-[720px] prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-foreground/85 prose-p:leading-relaxed prose-li:text-foreground/85 prose-a:text-link prose-a:underline-offset-4 hover:prose-a:text-link/80 prose-img:rounded-lg prose-hr:border-border">
          <PlateStaticView value={contentJson} />
        </article>
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
