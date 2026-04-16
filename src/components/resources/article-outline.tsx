"use client";

import { cn } from "@/lib/utils";
import type { ArticleHeading } from "@/lib/article-constants";

interface ArticleOutlineProps {
  headings: ArticleHeading[];
  activeHeadingId: string;
  onHeadingClick?: (slug: string) => void;
}

/**
 * Sticky right sidebar showing a table of contents (H1-H4 headings).
 * Highlights the currently visible section via the parent's scroll-spy.
 * Hidden on smaller screens and when fewer than 2 headings exist.
 *
 * Format-agnostic — works with Google Doc, native Plate, and legacy
 * Tiptap articles. The parent extracts headings and manages scroll state.
 */
export function ArticleOutline({
  headings,
  activeHeadingId,
  onHeadingClick,
}: ArticleOutlineProps) {
  if (headings.length < 2) return null;

  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <nav className="hidden lg:block w-48 shrink-0 sticky top-20 self-start">
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          On this page
        </h4>
        <ul className="space-y-1">
          {headings.map((h) => (
            <li key={h.slug}>
              <a
                href={`#${h.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(h.slug)?.scrollIntoView({ behavior: "smooth" });
                  onHeadingClick?.(h.slug);
                }}
                className={cn(
                  "text-xs block truncate py-1 transition-colors",
                  activeHeadingId === h.slug
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={h.level > minLevel ? { paddingLeft: `${(h.level - minLevel) * 12}px` } : undefined}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
