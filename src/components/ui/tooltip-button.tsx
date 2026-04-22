"use client";

import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface TooltipButtonProps extends ButtonProps {
  /**
   * Short explanation shown when the button is `disabled`. Screen readers
   * receive this via `aria-describedby` on the wrapping span; sighted users
   * see it as a hover tooltip. Required when `disabled`.
   *
   * Leaving `reason` unset on a disabled button emits a dev-only
   * `console.warn` because silent-disabled is a UX failure per the
   * documented button rules.
   */
  reason?: string;
}

/**
 * Button wrapper that shows a tooltip explaining why the button is disabled.
 *
 * Native `title` and bare Radix Tooltip don't fire on disabled buttons
 * because the browser applies `pointer-events: none` to disabled elements.
 * This wrapper puts a focusable `<span>` around the disabled Button, wires
 * a Radix Tooltip to the span, and points `aria-describedby` at the tooltip
 * content so screen readers announce the reason alongside the disabled
 * state.
 *
 * When the button is enabled, `TooltipButton` renders a plain Button and
 * skips the wrapper entirely. Zero runtime cost for the common path.
 *
 * Relies on a single root-level `TooltipProvider` (present in
 * `src/app/(protected)/layout.tsx`) — per the project rule documented in
 * `src/lib/CLAUDE.md`. Do not wrap instances in their own `TooltipProvider`.
 */
export const TooltipButton = React.forwardRef<
  HTMLButtonElement,
  TooltipButtonProps
>(({ disabled, reason, children, ...props }, ref) => {
  if (!disabled) {
    return (
      <Button ref={ref} {...props}>
        {children}
      </Button>
    );
  }

  if (!reason) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "TooltipButton: disabled without `reason`. Silent-disabled buttons are a UX failure; pass a short reason string."
      );
    }
    return (
      <Button ref={ref} disabled {...props}>
        {children}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/*
         * The span catches pointer events the disabled button can't.
         * `cursor-not-allowed` gives sighted users the visual cue that
         * the button is unavailable. The user's `className` is forwarded
         * so layout classes like `w-full` apply to the outer box (the
         * span claims the width), not just the inner button which would
         * otherwise fill an inline-flex parent.
         */}
        <span
          tabIndex={0}
          className={cn(
            "inline-flex cursor-not-allowed",
            props.className
          )}
          aria-disabled="true"
        >
          <Button
            ref={ref}
            disabled
            aria-disabled="true"
            // Pointer events on the inner button stay off; tabIndex on
            // the span takes the focus so keyboard users get the tooltip.
            tabIndex={-1}
            {...props}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{reason}</TooltipContent>
    </Tooltip>
  );
});
TooltipButton.displayName = "TooltipButton";
