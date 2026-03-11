"use client";

import { useRef, useState, useCallback, useTransition } from "react";
import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { ArticleComposer } from "./article-composer";
import { SaveStatusIndicator } from "./save-status-indicator";
import { useAutoSave } from "@/hooks/use-auto-save";
import {
  createArticle,
  updateArticle,
  autoSaveArticle,
} from "@/app/(protected)/intranet/resources/actions";
import { toast } from "sonner";
import type { TiptapDocument } from "@/lib/tiptap";
import type { ArticleWithAuthor, ResourceCategory } from "@/types/database.types";

interface ArticleEditorPageProps {
  category: ResourceCategory;
  /** Pass existing article for edit mode; omit for create mode */
  article?: ArticleWithAuthor;
}

export function ArticleEditorPage({
  category,
  article,
}: ArticleEditorPageProps) {
  const [isPending, startTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<TiptapDocument | null>(
    (article?.content_json as unknown as TiptapDocument) ?? null
  );

  // Track article ID for create→edit transition.
  // In create mode, starts null. After first auto-save creates a draft, stores
  // the new ID so subsequent saves use update mode instead of creating duplicates.
  const [autoSavedId, setAutoSavedId] = useState<string | null>(null);

  const isEdit = !!article;
  const backHref = isEdit
    ? `/intranet/resources/${category.slug}/${article.slug}`
    : `/intranet/resources/${category.slug}`;

  // ── Auto-save callback ───────────────────────────────────────────────────

  const onAutoSave = useCallback(async (): Promise<{ success: boolean }> => {
    const title = titleRef.current?.value.trim() ?? "";

    // Don't create untitled drafts
    if (!title) return { success: true };

    const effectiveId = article?.id ?? autoSavedId;

    if (effectiveId) {
      // Update existing article (edit mode OR after first auto-save created draft)
      return autoSaveArticle({
        mode: "update",
        articleId: effectiveId,
        title,
        content_json: contentRef.current,
      });
    }

    // Create new draft (first auto-save in create mode)
    const result = await autoSaveArticle({
      mode: "create",
      categoryId: category.id,
      title,
      content_json: contentRef.current,
    });

    if (result.success && result.articleId) {
      setAutoSavedId(result.articleId);
    }

    return result;
  }, [article?.id, autoSavedId, category.id]);

  const { status, markDirty, flushSave, reset } = useAutoSave({
    onSave: onAutoSave,
    enabled: !isPending,
    debounceMs: 5000,
  });

  // ── Content / title change handlers ────────────────────────────────────

  function handleContentChange(json: TiptapDocument) {
    contentRef.current = json;
    markDirty();
  }

  // ── Manual save (Publish / Save as Draft) ──────────────────────────────

  function handleSave(saveStatus: "draft" | "published") {
    const title = titleRef.current?.value.trim() ?? "";
    if (!title) {
      toast.error("Title is required");
      titleRef.current?.focus();
      return;
    }

    startTransition(async () => {
      // Flush any pending auto-save first, then reset auto-save state
      await flushSave();
      reset();

      const effectiveId = article?.id ?? autoSavedId;

      // If auto-save already created a draft, update it via updateArticle
      // (which regenerates slug and calls revalidatePath)
      const result = effectiveId
        ? await updateArticle(effectiveId, {
            title,
            content_json: contentRef.current ?? undefined,
            status: saveStatus,
          })
        : await createArticle(category.id, {
            title,
            content_json: contentRef.current ?? undefined,
            status: saveStatus,
          });

      if (result.success) {
        if (isEdit) {
          toast.success("Article updated");
        } else {
          toast.success(
            saveStatus === "published" ? "Article published" : "Draft saved"
          );
          // Navigate to reading view — full reload ensures fresh server data
          const resultArticle =
            "article" in result ? (result.article as Record<string, unknown>) : null;
          const slug =
            resultArticle && typeof resultArticle.slug === "string"
              ? resultArticle.slug
              : null;
          if (slug) {
            window.location.href = `/intranet/resources/${category.slug}/${slug}`;
          } else {
            window.location.href = `/intranet/resources/${category.slug}`;
          }
        }
      } else {
        toast.error(
          ("error" in result ? result.error : null) ??
            "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org"
        );
      }
    });
  }

  const breadcrumbs = [
    { label: "Home", href: "/intranet" },
    { label: "Resources", href: "/intranet/resources" },
    { label: category.name, href: `/intranet/resources/${category.slug}` },
    ...(isEdit
      ? [
          {
            label: article.title,
            href: `/intranet/resources/${category.slug}/${article.slug}`,
          },
          { label: "Edit" },
        ]
      : [{ label: "New Article" }]),
  ];

  return (
    <div className="space-y-4">
      {/* Header: breadcrumbs + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            {breadcrumbs.map((item, i) => (
              <Fragment key={i}>
                {i > 0 && (
                  <span className="text-muted-foreground/50 select-none" aria-hidden>/</span>
                )}
                {"href" in item && item.href ? (
                  <Link
                    href={item.href}
                    className="hover:text-foreground hover:underline underline-offset-4 transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium truncate">
                    {item.label}
                  </span>
                )}
              </Fragment>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SaveStatusIndicator status={status} />
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleSave("draft")}
          >
            Save as Draft
          </Button>
          <LoadingButton
            size="sm"
            loading={isPending}
            onClick={() => handleSave("published")}
          >
            {isEdit && article?.status === "published"
              ? "Update"
              : "Publish"}
          </LoadingButton>
        </div>
      </div>

      {/* Title + Editor — unified card surface */}
      <div className="rounded-xl bg-card shadow-md overflow-clip">
        <Input
          ref={titleRef}
          defaultValue={article?.title ?? ""}
          placeholder="Untitled"
          className="text-3xl font-bold h-auto py-3 px-4 border-none shadow-none bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground/50 rounded-none"
          autoFocus={!isEdit}
          onInput={() => markDirty()}
        />
        <ArticleComposer
          onChange={handleContentChange}
          initialContent={article?.content_json}
          disabled={isPending}
        />
      </div>
    </div>
  );
}
