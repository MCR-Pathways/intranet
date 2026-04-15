"use client";

import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
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
}

/**
 * Kebab trigger for card-level editor actions. Expects the parent card to
 * have a named Tailwind group (`group/card`) so sibling cards' hover state
 * doesn't trigger this one. Always keyboard-reachable via tab + focus-within.
 *
 * Wrap each card like: `<div class="group/card relative">...</div>` and put
 * this kebab inside (it will position absolutely top-right).
 */
export function CardActionsKebab({
  triggerLabel,
  children,
  className,
}: CardActionsKebabProps) {
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
          "opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 data-[state=open]:opacity-100 transition-opacity",
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
