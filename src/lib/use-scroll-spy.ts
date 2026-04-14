"use client";

import { useEffect, useRef, useState } from "react";
import type { ArticleHeading } from "./article-constants";

/**
 * IntersectionObserver-based scroll-spy for article TOC.
 *
 * Returns `[activeId, setActiveId]` — the observer sets it on scroll,
 * and the parent can set it on click for instant visual feedback
 * (the observer will naturally overwrite on the next scroll event).
 */
export function useScrollSpy(
  headings: ArticleHeading[]
): [string, (id: string) => void] {
  const [activeId, setActiveId] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (headings.length < 2) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -80% 0px" }
    );

    for (const h of headings) {
      const el = document.getElementById(h.slug);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, [headings]);

  return [activeId, setActiveId];
}
