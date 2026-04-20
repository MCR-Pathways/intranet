"use client";

import { createElement, useEffect, useMemo, useState, useTransition } from "react";
import parse, { type DOMNode, type Element, domToReact } from "html-react-parser";
import { getEmbedUrl } from "@/lib/video";
import {
  ExternalLink,
  RefreshCw,
  MoreHorizontal,
  FolderInput,
  Unlink,
  Loader2,
  Link as LinkIcon,
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
import { UnlinkDialog } from "./unlink-dialog";
import { MoveArticleDialog } from "./move-article-dialog";
import { syncArticle, unlinkGoogleDoc } from "@/app/(protected)/resources/drive-actions";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate } from "@/lib/utils";
import { ArticleBreadcrumb } from "./article-breadcrumb";
import { BookmarkToggle } from "./bookmark-toggle";
import { recordArticleView } from "@/lib/recently-viewed";
import { useScrollSpy } from "@/lib/use-scroll-spy";
import { createSlugDeduplicator, ARTICLE_PROSE_CLASSES, ARTICLE_CARD_CLASSES, APP_ORIGIN } from "@/lib/article-constants";
import { extractDocId, unwrapGoogleRedirect } from "@/lib/google-doc-url";
import { toast } from "sonner";
import type { ArticleWithAuthor, ResourceCategory } from "@/types/database.types";

interface SiblingArticle {
  id: string;
  title: string;
  slug: string;
}

interface GoogleDocArticleViewProps {
  article: ArticleWithAuthor;
  category: ResourceCategory;
  parentCategory: { name: string; slug: string } | null;
  canEdit: boolean;
  isBookmarked?: boolean;
  siblings?: SiblingArticle[];
  categoryPath?: string;
  serverNow: number;
  crossLinkMap?: Record<string, string>;
}

export function GoogleDocArticleView({
  article: initialArticle,
  category,
  parentCategory,
  canEdit,
  isBookmarked = false,
  siblings = [],
  categoryPath = "",
  serverNow,
  crossLinkMap = {},
}: GoogleDocArticleViewProps) {
  const [article, setArticle] = useState(initialArticle);
  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  // Keep article in sync with server re-renders
  useEffect(() => {
    setArticle(initialArticle);
  }, [initialArticle]);

  // Track recently viewed articles for the global search overlay.
  // Drafts never enter the list — would leak stale entries into readers'
  // recents if the article was later unpublished.
  useEffect(() => {
    if (article.status !== "published") return;
    recordArticleView({ id: article.id, title: article.title, slug: article.slug });
  }, [article.id, article.title, article.slug, article.status]);

  // ─── Parse HTML into React elements with heading IDs ───────────────────────

  const { parsedContent, headings } = useMemo(() => {
    if (!article.synced_html) return { parsedContent: null, headings: [] as { text: string; slug: string; level: number }[] };

    const extractedHeadings: { text: string; slug: string; level: number }[] = [];
    const slugify = createSlugDeduplicator();

    const content = parse(article.synced_html, {
      replace: (domNode) => {
        if (domNode.type !== "tag") return;
        const el = domNode as Element;
        const tagName = el.name?.toLowerCase();

        // Convert paragraphs containing only a YouTube/Vimeo link into responsive embeds
        if (tagName === "p") {
          const meaningful = el.children.filter(
            (c) => c.type === "tag" || (c.type === "text" && (c as unknown as { data: string }).data.trim())
          );
          if (meaningful.length === 1 && meaningful[0].type === "tag") {
            const child = meaningful[0] as Element;
            if (child.name === "a" && child.attribs?.href) {
              const embedUrl = getEmbedUrl(child.attribs.href);
              if (embedUrl) {
                // Extract link text for accessible iframe title
                const linkText = child.children
                  .filter((c) => c.type === "text")
                  .map((c) => (c as unknown as { data: string }).data)
                  .join("")
                  .trim();
                return createElement(
                  "div",
                  { className: "not-prose my-4 aspect-video w-full overflow-hidden rounded-lg bg-muted", key: embedUrl },
                  createElement("iframe", {
                    src: embedUrl,
                    title: linkText || "Embedded video",
                    className: "h-full w-full",
                    sandbox: "allow-scripts allow-same-origin allow-presentation",
                    allowFullScreen: true,
                    allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                    loading: "lazy",
                  })
                );
              }
            }
          }
        }

        // Rewrite links: cross-link Google Docs, handle internal URLs
        if (tagName === "a" && el.attribs?.href) {
          const href = el.attribs.href;

          // Case 1: Google Doc URL → rewrite to intranet article
          const unwrapped = unwrapGoogleRedirect(href);
          const docId = extractDocId(unwrapped);
          if (docId && Object.hasOwn(crossLinkMap, docId)) {
            return createElement(
              "a",
              { href: `/resources/article/${crossLinkMap[docId]}` },
              domToReact(el.children as DOMNode[])
            );
          }

          // Case 2: Relative internal path → same-tab
          if (href.startsWith("/") && !href.startsWith("//")) {
            return createElement(
              "a",
              { href },
              domToReact(el.children as DOMNode[])
            );
          }

          // Case 3: Absolute intranet URL → strip origin, same-tab
          if (APP_ORIGIN) {
            try {
              const linkUrl = new URL(href);
              if (linkUrl.origin === APP_ORIGIN) {
                const internalPath = linkUrl.pathname + linkUrl.search + linkUrl.hash || "/";
                return createElement(
                  "a",
                  { href: internalPath },
                  domToReact(el.children as DOMNode[])
                );
              }
            } catch { /* not a valid URL, leave as external */ }
          }
        }

        // Add IDs to headings for deep linking + TOC
        if (/^h[1-4]$/.test(tagName)) {
          const text = getTextContent(el);
          if (text) {
            const level = parseInt(tagName[1], 10);
            const slug = slugify(text);
            extractedHeadings.push({ text, slug, level });

            return createElement(
              tagName,
              { ...el.attribs, id: slug, key: slug, className: "group relative scroll-mt-20" },
              createElement(
                "a",
                {
                  href: `#${slug}`,
                  "aria-hidden": true,
                  tabIndex: -1,
                  className: "absolute -left-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity select-none [text-decoration:none] [color:var(--color-muted-foreground)]",
                },
                createElement(LinkIcon, { className: "h-3.5 w-3.5" })
              ),
              domToReact(el.children as DOMNode[])
            );
          }
        }
      },
    });

    return { parsedContent: content, headings: extractedHeadings };
  }, [article.synced_html, crossLinkMap]);

  // ─── Scroll-spy: highlight active heading in TOC ───────────────────────────

  const [activeHeadingId, setActiveHeadingId] = useScrollSpy(headings);

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

  // Content freshness — flag articles not updated in 12+ months
  const updatedAt = new Date(article.updated_at);
  const isStale = useMemo(() => {
    const ts = new Date(article.updated_at).getTime();
    const monthsOld = Math.floor(
      (serverNow - ts) / (1000 * 60 * 60 * 24 * 30)
    );
    return monthsOld >= 12;
  }, [article.updated_at, serverNow]);

  return (
    <div className={ARTICLE_CARD_CLASSES} style={{ minHeight: "calc(100vh - 14rem)" }}>
      <ArticleBreadcrumb
        category={category}
        parentCategory={parentCategory}
        title={article.title}
      />

      {/* Google Docs bar — editor mode only */}
      {canEdit && (
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
                Edit in Google Docs
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Article header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <h1 className="text-[26px] font-bold tracking-tight leading-tight">
              {article.title}
            </h1>
            {article.status === "published" && (
              <BookmarkToggle articleId={article.id} initialBookmarked={isBookmarked} />
            )}
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

          <div className="flex items-center gap-2 shrink-0">
          {/* Editor actions — Move / Unlink. Edit lives in the banner above
              because editing happens in Google Docs, not on the intranet. */}
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
        </div>

        {/* Article meta */}
        <div className="flex items-center gap-2 mt-1.5 text-[13px] text-muted-foreground flex-wrap">
          <span className={isStale ? "text-amber-600" : undefined}>
            Updated {formatDate(updatedAt)}
            {isStale && " — may need review"}
          </span>
        </div>
      </div>

      {/* Article body — two-column: content + outline sidebar */}
      {article.synced_html ? (
        <div className="flex gap-8">
          <article className={cn(ARTICLE_PROSE_CLASSES, "flex-1 min-w-0")}>
            {parsedContent}
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
          This document has no content yet. Click &ldquo;Sync now&rdquo; to fetch content from Google Docs.
        </div>
      )}

      {/* More in [folder] — sibling article navigation */}
      <MoreInSection
        categoryName={category.name}
        categoryPath={categoryPath}
        siblings={siblings}
        currentArticleId={article.id}
      />

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
