"use client";

import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CardActionsKebabProps {
  /**
   * Entity name used in the aria-label (e.g. "Actions for Annual leave policy").
   * Required for screen reader usability.
   */
  triggerLabel: string;
  /** `DropdownMenuItem`s rendered inside the menu. */
  children: React.ReactNode;
  /** Additional classes for absolute positioning inside the parent card. */
  className?: string;
  /**
   * Layout variant:
   *   "card" (default) — absolute top-right inside a `group/card` parent.
   *   "inline" — a flex sibling button. No absolute positioning, no
   *   hover-reveal gating. Use for list rows where the kebab sits in a
   *   dedicated action zone alongside other controls.
   */
  variant?: "card" | "inline";
}

/**
 * Kebab trigger for card-level editor actions.
 *
 * Two layouts share one menu surface so callers don't duplicate `DropdownMenu`
 * + menu-item children for the two contexts in the resources module:
 *
 * - `variant="card"` (default) — absolute top-right inside a `group/card`
 *   parent (the Resources landing category grid). Hover-reveal: hidden until
 *   the card is hovered or focused.
 * - `variant="inline"` — inline flex sibling, always visible. Used by the
 *   category-page row list where the kebab sits in the row's action zone.
 */
export function CardActionsKebab({
  triggerLabel,
  children,
  className,
  variant = "card",
}: CardActionsKebabProps) {
  if (variant === "inline") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={triggerLabel}
            title="Actions"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{children}</DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={triggerLabel}
        onClick={(e) => {
          // Prevent the enclosing Link/card from navigating when the kebab
          // is clicked. Card wrappers commonly wrap content in <Link>.
          e.stopPropagation();
          e.preventDefault();
        }}
        className={cn(
          "absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-card/80 backdrop-blur-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
