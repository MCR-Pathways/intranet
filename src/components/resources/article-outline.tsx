"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ArticleHeading } from "@/lib/article-constants";

interface ArticleOutlineProps {
  headings: ArticleHeading[];
  activeHeadingId: string;
  onHeadingClick?: (slug: string) => void;
}

/**
 * Reading rail (§4): the article's "On this page" contents list.
 *
 * From `lg` it's a borderless sticky side rail: a track line, weight and size
 * encoding level, and the active section marked with a 3px teal bar plus teal
 * text. Below `lg` (including when a zoomed-in viewport reflows narrow) it
 * renders as a collapsed disclosure between the title block and the content,
 * so the contents list is never simply hidden. That was a WCAG reflow gap in
 * the old boxed TOC. The breakpoint split is pure CSS (`lg:` variants), so
 * server and client paint identically at every width with no flash.
 *
 * Layout contract: this nav is the second child of ARTICLE_LAYOUT_CLASSES
 * (see article-constants.ts) and places itself in the grid's second column,
 * spanning both rows, from `lg`.
 *
 * The parent passes an already-filtered heading list (`filterRailHeadings`)
 * and the scroll-spy `activeHeadingId`. Format-agnostic: Google Doc, native
 * Plate, and legacy Tiptap articles all feed it the same shape.
 */
export function ArticleOutline({
  headings,
  activeHeadingId,
  onHeadingClick,
}: ArticleOutlineProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  if (headings.length < 2) return null;

  const minLevel = Math.min(...headings.map((h) => h.level));

  const goToHeading = (slug: string) => {
    // Keep the section anchor shareable: preventDefault suppresses the
    // browser's hash update, so write it ourselves (pushState doesn't scroll).
    window.history.pushState(null, "", `#${slug}`);
    // Collapse the narrow disclosure first, then scroll on the next frame:
    // the list sits above the content when stacked, so collapsing after the
    // scroll starts would shift the target mid-animation and overshoot it.
    setExpanded(false);
    onHeadingClick?.(slug);
    requestAnimationFrame(() => {
      document.getElementById(slug)?.scrollIntoView({ behavior: "smooth" });
    });
  };

  return (
    <nav
      aria-label="On this page"
      className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:w-56 lg:self-start lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto xl:w-64"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={listId}
        className="w-full justify-between lg:hidden"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
          On this page
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "text-muted-foreground transition-transform duration-150",
            expanded && "rotate-180"
          )}
        />
      </Button>
      <p className="hidden text-xs font-semibold uppercase tracking-wide text-foreground lg:block">
        On this page
      </p>

      <ul
        id={listId}
        className={cn(
          "mt-3 border-l-2 border-border",
          !expanded && "max-lg:hidden"
        )}
      >
        {headings.map((h) => {
          const isActive = activeHeadingId === h.slug;
          const indent = h.level > minLevel;
          return (
            <li key={h.slug}>
              <a
                href={`#${h.slug}`}
                aria-current={isActive ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  goToHeading(h.slug);
                }}
                className={cn(
                  "-ml-0.5 block break-words border-l-[3px] py-1.5 pr-2 transition-colors duration-200 ease-out",
                  indent ? "pl-6 text-[0.8125rem]" : "pl-3 text-sm",
                  isActive
                    ? "border-link font-medium text-link"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
