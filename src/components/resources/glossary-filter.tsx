"use client";

/**
 * On-page filter for native articles that contain glossary blocks (the jargon
 * buster). One shared box narrows BOTH the Terms list and the Acronyms table.
 *
 * The query is owned by the parent (NativeArticleView) so the TOC can hide
 * sections this empties. The result count is derived from `entryTexts` (the
 * same term + definition texts the static render stamps as `data-glossary-text`
 * via glossary-text.ts) — pure state in render. PlateStatic emits zero-JS DOM,
 * so a single effect projects the result onto it: toggling `hidden`, wrapping
 * matches in <mark>, and hiding a section heading + its glossary when all its
 * entries drop out. A MutationObserver re-applies the projection if PlateStatic
 * ever repaints (e.g. a Realtime update) so the filter can't silently reset.
 *
 * Locked behaviour (memory/wp-migration-design-audit.md): term + definition
 * full-text, case-insensitive, highlight matches, live count, and a "no matches"
 * state with a Clear button (docs/ui-ux-principles.md §6 filtered-empty).
 */

import { useEffect, useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { normalizeFilterText } from "@/lib/glossary-text";

interface GlossaryFilterProps {
  /** Ref to the rendered article element the glossary lives in. */
  articleRef: React.RefObject<HTMLElement | null>;
  /** Filter text (term + definition, normalised) per entry, in document order. */
  entryTexts: string[];
  query: string;
  onQueryChange: (next: string) => void;
}

const HL_CLASS = "glossary-hl";

/** Walk back from a glossary to its nearest preceding heading element, so the
 *  heading can be hidden when the section empties. */
function precedingHeading(glossary: HTMLElement): HTMLElement | null {
  let el = glossary.previousElementSibling as HTMLElement | null;
  while (el) {
    if (/^H[1-4]$/.test(el.tagName) || el.querySelector("h1, h2, h3, h4")) {
      return el;
    }
    el = el.previousElementSibling as HTMLElement | null;
  }
  return null;
}

/** Remove every highlight <mark> under root, restoring the original text. */
function clearHighlights(root: HTMLElement) {
  root.querySelectorAll(`mark.${HL_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
  });
  // Merge the text nodes left behind in one pass, not once per mark.
  root.normalize();
}

/** Wrap each occurrence of `query` (already normalised, lower-cased) in
 *  `entry`'s text nodes with <mark class="glossary-hl">. */
function highlight(entry: HTMLElement, query: string) {
  const walker = document.createTreeWalker(entry, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    textNodes.push(n as Text);
  }
  for (const textNode of textNodes) {
    const value = textNode.nodeValue ?? "";
    const lower = normalizeFilterText(value);
    let idx = lower.indexOf(query);
    if (idx === -1) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    while (idx !== -1) {
      if (idx > last) frag.appendChild(document.createTextNode(value.slice(last, idx)));
      const mark = document.createElement("mark");
      mark.className = HL_CLASS;
      mark.textContent = value.slice(idx, idx + query.length);
      frag.appendChild(mark);
      last = idx + query.length;
      idx = lower.indexOf(query, last);
    }
    if (last < value.length) frag.appendChild(document.createTextNode(value.slice(last)));
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}

function restore(root: HTMLElement) {
  clearHighlights(root);
  root.querySelectorAll<HTMLElement>(".glossary-entry, .glossary").forEach((el) => {
    el.hidden = false;
  });
  root.querySelectorAll<HTMLElement>(".glossary").forEach((g) => {
    const h = precedingHeading(g);
    if (h) h.hidden = false;
  });
}

export function GlossaryFilter({
  articleRef,
  entryTexts,
  query,
  onQueryChange,
}: GlossaryFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const totalCount = entryTexts.length;
  const q = normalizeFilterText(query.trim());

  // Derived (not effect state): which entries match, and how many.
  const matches = useMemo(
    () => entryTexts.map((t) => !q || t.includes(q)),
    [entryTexts, q],
  );
  const visibleCount = useMemo(() => matches.filter(Boolean).length, [matches]);

  // Project the result onto the static DOM, re-applying if it ever repaints.
  useEffect(() => {
    const node = articleRef.current;
    if (!node) return;
    const observer = new MutationObserver(() => apply());

    function apply() {
      // Disconnect so our own mutations don't re-trigger the observer.
      observer.disconnect();
      clearHighlights(node!);
      node!.querySelectorAll<HTMLElement>(".glossary-entry").forEach((entry, i) => {
        const match = matches[i] ?? true;
        entry.hidden = !match;
        if (match && q) highlight(entry, q);
      });
      // A heading can precede more than one glossary (the block is reusable,
      // e.g. two groups under one H2). Aggregate visibility so a heading hides
      // only when ALL its glossaries are empty, not whichever the loop sees
      // last. Mirrors extractGlossarySections, which merges a heading's entries.
      const headingVisible = new Map<HTMLElement, boolean>();
      node!.querySelectorAll<HTMLElement>(".glossary").forEach((glossary) => {
        const anyVisible = Array.from(
          glossary.querySelectorAll<HTMLElement>(".glossary-entry"),
        ).some((e) => !e.hidden);
        glossary.hidden = !anyVisible;
        const heading = precedingHeading(glossary);
        if (heading) {
          headingVisible.set(
            heading,
            (headingVisible.get(heading) ?? false) || anyVisible,
          );
        }
      });
      headingVisible.forEach((visible, heading) => {
        heading.hidden = !visible;
      });
      observer.observe(node!, { childList: true, subtree: true });
    }

    apply();
    return () => {
      observer.disconnect();
      restore(node);
    };
  }, [matches, q, articleRef]);

  const hasQuery = q.length > 0;
  const noMatches = hasQuery && visibleCount === 0;
  const entryWord = (n: number) => (n === 1 ? "entry" : "entries");

  return (
    <>
      {/* Pinned bar — stays in reach while scrolling a long list. top-20 matches
          the sticky TOC. bg-card hides entries scrolling underneath. */}
      <div className="not-prose sticky top-20 z-20 -mt-2 bg-card pb-3 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            role="searchbox"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                onQueryChange("");
              }
            }}
            placeholder="Filter terms and acronyms…"
            aria-label="Filter terms and acronyms"
            className="bg-card pl-9 pr-9"
          />
          {hasQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Clear filter"
              title="Clear filter"
              onClick={() => {
                onQueryChange("");
                inputRef.current?.focus();
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X />
            </Button>
          )}
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground" aria-live="polite">
          {hasQuery
            ? `${visibleCount} of ${totalCount} ${entryWord(totalCount)}`
            : `${totalCount} ${entryWord(totalCount)}`}
        </p>
      </div>

      {noMatches && (
        <div className="not-prose mb-5 rounded-lg border border-border bg-card px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">
            No terms or acronyms match &ldquo;{query.trim()}&rdquo;
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Try a shorter or different word.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              onQueryChange("");
              inputRef.current?.focus();
            }}
          >
            Clear filter
          </Button>
        </div>
      )}
    </>
  );
}
