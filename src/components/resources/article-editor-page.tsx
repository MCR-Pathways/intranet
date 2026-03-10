"use client";

import { useRef, useTransition } from "react";
import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { ArticleComposer } from "./article-composer";
import {
  createArticle,
  updateArticle,
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

  const isEdit = !!article;
  const backHref = isEdit
    ? `/intranet/resources/${category.slug}/${article.slug}`
    : `/intranet/resources/${category.slug}`;

  function handleContentChange(json: TiptapDocument) {
    contentRef.current = json;
  }

  function handleSave(status: "draft" | "published") {
    const title = titleRef.current?.value.trim() ?? "";
    if (!title) {
      toast.error("Title is required");
      titleRef.current?.focus();
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateArticle(article!.id, {
            title,
            content_json: contentRef.current ?? undefined,
            status,
          })
        : await createArticle(category.id, {
            title,
            content_json: contentRef.current ?? undefined,
            status,
          });

      if (result.success) {
        if (isEdit) {
          toast.success("Article updated");
        } else {
          toast.success(
            status === "published" ? "Article published" : "Draft saved"
          );
          // Navigate to reading view — full reload ensures fresh server data
          const article =
            "article" in result ? (result.article as Record<string, unknown>) : null;
          const slug =
            article && typeof article.slug === "string" ? article.slug : null;
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
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                )}
                {"href" in item && item.href ? (
                  <Link
                    href={item.href}
                    className="hover:text-foreground transition-colors"
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

      {/* Title input */}
      <Input
        ref={titleRef}
        defaultValue={article?.title ?? ""}
        placeholder="Untitled"
        className="text-3xl font-bold h-auto py-2 border-none shadow-none bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground/50"
        autoFocus={!isEdit}
      />

      {/* Editor */}
      <ArticleComposer
        onChange={handleContentChange}
        initialContent={article?.content_json}
        disabled={isPending}
      />
    </div>
  );
}
