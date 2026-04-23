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
    <nav className="hidden lg:block lg:w-56 xl:w-64 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-border p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        On this page
      </h4>
      <ul className="space-y-1">
        {headings.map((h) => (
          <li key={h.slug}>
            <a
              href={`#${h.slug}`}
              aria-current={activeHeadingId === h.slug ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(h.slug)?.scrollIntoView({ behavior: "smooth" });
                onHeadingClick?.(h.slug);
              }}
              className={cn(
                "text-sm block break-words py-1.5 px-3 rounded-md transition-colors duration-200 ease-out text-muted-foreground",
                h.level > minLevel && "opacity-80",
                activeHeadingId === h.slug
                  ? "bg-accent opacity-100"
                  : "hover:bg-accent/50 hover:text-foreground"
              )}
              style={h.level > minLevel ? { paddingLeft: `${12 + (h.level - minLevel) * 12}px` } : undefined}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
