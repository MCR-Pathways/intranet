"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { extractHeadings, type HeadingItem } from "@/lib/tiptap";
import type { TiptapDocument } from "@/lib/tiptap";

interface ArticleOutlineProps {
  contentJson?: TiptapDocument | Record<string, unknown> | null;
}

/**
 * Sticky right sidebar showing a table of contents (H2/H3 headings).
 * Highlights the currently visible section via IntersectionObserver.
 * Hidden on smaller screens and when fewer than 2 headings exist.
 */
export function ArticleOutline({ contentJson }: ArticleOutlineProps) {
  const headings = useMemo(() => extractHeadings(contentJson), [contentJson]);
  const [activeId, setActiveId] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (headings.length < 2) return;

    // Clean up previous observer
    observerRef.current?.disconnect();

    const callback: IntersectionObserverCallback = (entries) => {
      // Find the topmost visible heading
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
          break;
        }
      }
    };

    observerRef.current = new IntersectionObserver(callback, {
      // Account for fixed header (~80px) and give the heading some runway
      rootMargin: "-80px 0px -80% 0px",
    });

    // Observe all heading elements
    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [headings]);

  // Don't render if fewer than 2 headings
  if (headings.length < 2) return null;

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setActiveId(id);
    }
  }

  return (
    <nav aria-label="Table of contents" className="hidden lg:block">
      <div className="sticky top-24">
        <h4 className="text-sm font-semibold mb-3 text-foreground">
          On this page
        </h4>
        <ul className="space-y-1">
          {headings.map((heading) => (
            <OutlineItem
              key={heading.id}
              heading={heading}
              isActive={activeId === heading.id}
              onClick={handleClick}
            />
          ))}
        </ul>
      </div>
    </nav>
  );
}

function OutlineItem({
  heading,
  isActive,
  onClick,
}: {
  heading: HeadingItem;
  isActive: boolean;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>, id: string) => void;
}) {
  return (
    <li>
      <a
        href={`#${heading.id}`}
        onClick={(e) => onClick(e, heading.id)}
        className={cn(
          "block text-sm py-1 transition-colors",
          heading.level === 3 && "pl-4",
          isActive
            ? "text-primary font-medium"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {heading.text}
      </a>
    </li>
  );
}
