"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ExternalLink,
  RefreshCw,
  MoreHorizontal,
  Star,
  StarOff,
  FolderInput,
  Unlink,
  Loader2,
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
import { UnlinkDialog } from "./unlink-dialog";
import { MoveArticleDialog } from "./move-article-dialog";
import { useEditorMode } from "./editor-mode-context";
import { syncArticle, unlinkGoogleDoc } from "@/app/(protected)/resources/drive-actions";
import { toggleArticleFeatured } from "@/app/(protected)/resources/actions";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { ArticleWithAuthor, ResourceCategory } from "@/types/database.types";

interface GoogleDocArticleViewProps {
  article: ArticleWithAuthor;
  category: ResourceCategory;
  parentCategory: { name: string; slug: string } | null;
  canEdit: boolean;
}

export function GoogleDocArticleView({
  article: initialArticle,
  category,
  parentCategory,
  canEdit,
}: GoogleDocArticleViewProps) {
  const { editorMode } = useEditorMode();
  const [article, setArticle] = useState(initialArticle);
  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  // Keep article in sync with server re-renders
  useEffect(() => {
    setArticle(initialArticle);
  }, [initialArticle]);

  // ─── Supabase Realtime: live updates when synced_html changes ──────────────

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
          setArticle((prev) => ({
            ...prev,
            synced_html: (updated.synced_html as string) ?? prev.synced_html,
            last_synced_at: (updated.last_synced_at as string) ?? prev.last_synced_at,
            updated_at: (updated.updated_at as string) ?? prev.updated_at,
            title: (updated.title as string) ?? prev.title,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [article.id]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  function handleSync() {
    setIsSyncing(true);
    startTransition(async () => {
      const result = await syncArticle(article.id);
      setIsSyncing(false);
      if (result.success) {
        toast.success("Article synced from Google Docs");
      } else {
        toast.error(result.error ?? "Failed to sync article");
      }
    });
  }

  function handleToggleFeatured() {
    startTransition(async () => {
      const result = await toggleArticleFeatured(article.id);
      if (result.success) {
        toast.success(
          article.is_featured ? "Article unfeatured" : "Article featured"
        );
      } else {
        toast.error(result.error ?? "Failed to update article");
      }
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      const result = await unlinkGoogleDoc(article.id);
      if (result.success) {
        toast.success("Google Doc unlinked");
        window.location.href = `/resources/${category.slug}`;
      } else {
        toast.error(result.error ?? "Failed to unlink document");
      }
    });
  }

  const lastSynced = article.last_synced_at
    ? formatDate(new Date(article.last_synced_at))
    : null;

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
        {parentCategory && (
          <>
            <span className="text-muted-foreground/50 select-none">/</span>
            <Link
              href={`/resources/${parentCategory.slug}`}
              className="hover:text-foreground hover:underline underline-offset-4"
            >
              {parentCategory.name}
            </Link>
          </>
        )}
        <span className="text-muted-foreground/50 select-none">/</span>
        <Link
          href={`/resources/${parentCategory ? `${parentCategory.slug}/${category.slug}` : category.slug}`}
          className="hover:text-foreground hover:underline underline-offset-4"
        >
          {category.name}
        </Link>
        <span className="text-muted-foreground/50 select-none">/</span>
        <span className="text-foreground font-medium">{article.title}</span>
      </nav>

      {/* Google Docs bar — editor mode only */}
      {editorMode && canEdit && (
        <div className="flex items-center justify-between rounded-lg bg-mcr-teal/[0.06] border border-mcr-teal/15 px-5 py-3">
          <div className="flex items-center gap-2 text-[13px] text-mcr-teal font-medium">
            <ExternalLink className="h-4 w-4" />
            Synced from Google Docs
            {lastSynced && (
              <span className="text-muted-foreground font-normal ml-1">
                &middot; Last synced {lastSynced}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing || isPending}
              className="text-mcr-teal hover:text-mcr-teal"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Sync now
            </Button>
            <Button size="sm" asChild className="bg-mcr-pink hover:bg-mcr-pink/90">
              <a
                href={article.google_doc_url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in Google Docs
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Article header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">
            {article.title}
          </h1>

          {/* Kebab menu — editor mode only */}
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
                  onSelect={() => setShowUnlinkDialog(true)}
                >
                  <Unlink className="h-4 w-4" />
                  Unlink
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Article meta */}
        <div className="flex items-center gap-2 mt-1.5 text-[13px] text-muted-foreground flex-wrap">
          <span>{category.name}</span>
          <span className="text-border">&middot;</span>
          <span>Updated {formatDate(new Date(article.updated_at))}</span>
          {editorMode && article.is_featured && (
            <>
              <span className="text-border">&middot;</span>
              <Badge variant="secondary" className="text-[10px] py-0">
                Featured
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Article body — sanitised HTML rendered with prose */}
      {article.synced_html ? (
        <article
          className="prose prose-sm max-w-[720px] prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-foreground/85 prose-p:leading-relaxed prose-li:text-foreground/85 prose-a:text-link prose-a:underline-offset-4 hover:prose-a:text-link/80"
          dangerouslySetInnerHTML={{ __html: article.synced_html }}
        />
      ) : (
        <div className="text-sm text-muted-foreground italic py-8">
          This document has no content yet. Click &ldquo;Sync now&rdquo; to fetch content from Google Docs.
        </div>
      )}

      {/* Unlink confirmation */}
      <UnlinkDialog
        articleTitle={article.title}
        onConfirm={handleUnlink}
        disabled={isPending}
        open={showUnlinkDialog}
        onOpenChange={setShowUnlinkDialog}
      />

      {/* Move dialog */}
      {showMoveDialog && (
        <MoveArticleDialog
          articleId={article.id}
          articleTitle={article.title}
          currentCategoryId={category.id}
          open={showMoveDialog}
          onOpenChange={setShowMoveDialog}
        />
      )}
    </div>
  );
}
