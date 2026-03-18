"use client";

import { createElement, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import parse, { type DOMNode, type Element, domToReact } from "html-react-parser";
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

  // ─── Parse HTML into React elements with heading IDs ───────────────────────

  const { parsedContent, headings } = useMemo(() => {
    if (!article.synced_html) return { parsedContent: null, headings: [] as { text: string; slug: string; level: number }[] };

    const extractedHeadings: { text: string; slug: string; level: number }[] = [];
    const slugCounts = new Map<string, number>();

    function slugify(text: string): string {
      const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const count = slugCounts.get(base) ?? 0;
      slugCounts.set(base, count + 1);
      return count > 0 ? `${base}-${count}` : base;
    }

    const content = parse(article.synced_html, {
      replace: (domNode) => {
        if (domNode.type !== "tag") return;
        const el = domNode as Element;
        const tagName = el.name?.toLowerCase();

        // Add IDs to headings for deep linking + TOC
        if (/^h[1-4]$/.test(tagName)) {
          const text = getTextContent(el);
          if (text) {
            const level = parseInt(tagName[1], 10);
            const slug = slugify(text);
            extractedHeadings.push({ text, slug, level });

            return createElement(
              tagName,
              { ...el.attribs, id: slug, key: slug },
              domToReact(el.children as DOMNode[])
            );
          }
        }
      },
    });

    return { parsedContent: content, headings: extractedHeadings };
  }, [article.synced_html]);

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

      {/* Article body — two-column: content + outline sidebar */}
      {article.synced_html ? (
        <div className="flex gap-8">
          <article className="prose prose-sm max-w-[720px] flex-1 min-w-0 prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-foreground/85 prose-p:leading-relaxed prose-li:text-foreground/85 prose-a:text-link prose-a:underline-offset-4 hover:prose-a:text-link/80">
            {parsedContent}
          </article>

          {/* Article outline sidebar (table of contents) */}
          {headings.length > 1 && (
            <nav className="hidden lg:block w-48 shrink-0 sticky top-6 self-start">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                On this page
              </h4>
              <ul className="space-y-1.5">
                {headings.map((h) => (
                  <li key={h.slug}>
                    <a
                      href={`#${h.slug}`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors block truncate"
                      style={h.level > 2 ? { paddingLeft: `${(h.level - 2) * 12}px` } : undefined}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract text content from an html-react-parser Element node. */
function getTextContent(el: Element): string {
  let text = "";
  for (const child of el.children) {
    if (child.type === "text") {
      text += (child as unknown as { data: string }).data;
    } else if (child.type === "tag") {
      text += getTextContent(child as Element);
    }
  }
  return text.trim();
}
