"use client";

import {
  Children,
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { PlateElement } from "platejs/react";
import type { PlateElementProps } from "platejs/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToggleV2ContextValue {
  open: boolean;
  setOpen: (o: boolean) => void;
  contentId: string;
}

const ToggleV2Context = createContext<ToggleV2ContextValue | null>(null);

function useToggleV2() {
  const ctx = useContext(ToggleV2Context);
  if (!ctx) {
    throw new Error("ToggleV2Summary must be inside ToggleV2 container");
  }
  return ctx;
}

export function ToggleV2Element({ children, element, ...props }: PlateElementProps) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  useEffect(() => {
    function syncToHash() {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const target = document.getElementById(hash);
      if (!target) return;
      const owner = target.closest(`[data-toggle-v2-id="${contentId}"]`);
      if (!owner) return;
      setOpen(true);
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    syncToHash();
    window.addEventListener("hashchange", syncToHash);
    return () => window.removeEventListener("hashchange", syncToHash);
  }, [contentId]);

  const childArray = Children.toArray(children);
  const summary = childArray[0];
  const body = childArray.slice(1);

  return (
    <PlateElement element={element} {...props}>
      <ToggleV2Context.Provider value={{ open, setOpen, contentId }}>
        <div
          data-toggle-v2-id={contentId}
          data-open={open ? "true" : "false"}
          className={cn(
            "my-2 border-l-2 transition-colors",
            open ? "border-border" : "border-border/40 border-dashed",
          )}
        >
          {summary}
          {/* `grid-template-rows: 0fr → 1fr` is the modern CSS trick for
              animating height: auto. The body lives in a single grid row;
              opening transitions the row's track size between 0fr and 1fr,
              and the wrapper's `overflow-hidden` clips during the
              transition. The inner div carries `min-h-0` because grid
              items default to a min-content floor that would force the
              wrapper to expand to full content size and break the
              transition. `aria-hidden` mirrors the visual state for
              screen readers; `inert` prevents tab-focus into hidden
              content. */}
          <div
            id={contentId}
            role="region"
            aria-hidden={!open}
            inert={!open || undefined}
            className={cn(
              "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="ml-3 min-h-0">{body}</div>
          </div>
        </div>
      </ToggleV2Context.Provider>
    </PlateElement>
  );
}

export function ToggleV2SummaryElement({
  children,
  element,
  ...props
}: PlateElementProps) {
  const { open, setOpen, contentId } = useToggleV2();

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setOpen(!open);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(!open);
    }
  }

  return (
    <PlateElement element={element} {...props}>
      <div className="flex items-start gap-1 py-1 pl-1">
        <button
          type="button"
          contentEditable={false}
          onClick={handleClick}
          onMouseDown={(e) => e.preventDefault()}
          onKeyDown={handleKeyDown}
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={open ? "Collapse toggle" : "Expand toggle"}
          title={open ? "Collapse toggle" : "Expand toggle"}
          className="mt-0.5 flex-shrink-0 select-none rounded p-0.5 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none transition-colors"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
        </button>
        <div className="flex-1 min-w-0 font-semibold text-foreground">{children}</div>
      </div>
    </PlateElement>
  );
}
