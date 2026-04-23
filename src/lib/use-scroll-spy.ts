"use client";

import { useEffect, useRef, useState } from "react";
import type { ArticleHeading } from "./article-constants";

/**
 * IntersectionObserver-based scroll-spy for article TOC.
 *
 * Returns `[activeId, setActiveId]` — the observer sets it on scroll,
 * and the parent can set it on click for instant visual feedback
 * (the observer will naturally overwrite on the next scroll event).
 *
 * Tracks intersection state across callbacks and picks the topmost
 * heading currently inside the detection band. When scrolling slowly
 * between sections no heading may be in the band, so we fall back to
 * the last heading whose top is above the 80px threshold — that's the
 * section the user is reading, even though its heading has scrolled
 * above the viewport.
 */
export function useScrollSpy(
  headings: ArticleHeading[]
): [string, (id: string) => void] {
  const [activeId, setActiveId] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (headings.length < 2) return;

    const intersecting = new Map<string, boolean>();

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersecting.set(entry.target.id, entry.isIntersecting);
        }

        for (const h of headings) {
          if (intersecting.get(h.slug)) {
            setActiveId(h.slug);
            return;
          }
        }

        let above = "";
        for (const h of headings) {
          const el = document.getElementById(h.slug);
          if (!el) continue;
          if (el.getBoundingClientRect().top < 80) {
            above = h.slug;
          } else {
            break;
          }
        }
        setActiveId(above);
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
