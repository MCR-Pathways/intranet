"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type DropdownMenuItemProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuItem
>;

/**
 * Destructive-styled dropdown menu item. Locks in the full class string
 * needed to show the destructive colour across idle, hover, and keyboard
 * focus (data-[highlighted]) states.
 *
 * Use inside kebab menus for delete / remove / unlink / reject actions.
 * The red colour signals danger at the menu level; the AlertDialog confirm
 * that follows still uses the full destructive button variant.
 */
export const DestructiveMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuItem>,
  DropdownMenuItemProps
>(({ className, ...props }, ref) => {
  return (
    <DropdownMenuItem
      ref={ref}
      className={cn(
        "text-destructive focus:text-destructive focus:bg-destructive/10",
        "data-[highlighted]:text-destructive data-[highlighted]:bg-destructive/10",
        className
      )}
      {...props}
    />
  );
});
DestructiveMenuItem.displayName = "DestructiveMenuItem";
