"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface SiblingArticle {
  id: string;
  title: string;
  slug: string;
}

interface MoreInSectionProps {
  /** Name of the parent category/folder */
  categoryName: string;
  /** URL path to the parent category */
  categoryPath: string;
  /** Sibling articles in the same category */
  siblings: SiblingArticle[];
  /** ID of the current article (to highlight it) */
  currentArticleId: string;
}

/**
 * "More in [folder]" section shown at the bottom of article pages.
 * Replaces the sidebar tree for sibling article navigation.
 */
export function MoreInSection({
  categoryName,
  categoryPath,
  siblings,
  currentArticleId,
}: MoreInSectionProps) {
  // Fallback: always show a footer — at minimum a "Back to [category]" link
  if (siblings.length <= 1) {
    return (
      <div className="mt-8 border-t border-border/50 pt-6 flex justify-center">
        <Link
          href={`/resources/${categoryPath}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors hover:underline underline-offset-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {categoryName}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          More in {categoryName}
        </h4>
        <Link
          href={`/resources/${categoryPath}`}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
        >
          View all
        </Link>
      </div>
      <div className="space-y-0.5">
        {siblings.map((article) => {
          const isCurrent = article.id === currentArticleId;
          return (
            <Link
              key={article.id}
              href={`/resources/article/${article.slug}`}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors",
                isCurrent
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{article.title}</span>
              {isCurrent && (
                <span className="ml-auto text-[10px] text-muted-foreground font-normal shrink-0">
                  Current
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
