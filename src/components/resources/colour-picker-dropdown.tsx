"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { EditorColour } from "@/lib/editor-colours";
import type { LucideIcon } from "lucide-react";

interface ColourPickerDropdownProps {
  /** Palette entries — first entry should be the "remove" option (value: null) */
  colours: EditorColour[];
  /** Currently active CSS colour value, or undefined if no colour set */
  activeColour: string | undefined;
  /** Called when user selects a colour. null = remove colour. */
  onSelect: (value: string | null) => void;
  /** Lucide icon component for the trigger button */
  icon: LucideIcon;
  /** Accessible label for the button */
  label: string;
  /** Full tooltip text (pre-built with shortcut) */
  tooltip: string;
  /** Whether the button is currently active (colour applied) */
  isActive: boolean;
}

/**
 * Shared colour picker dropdown used for both text colour and highlight colour.
 * Renders a trigger button with tooltip + a grid of colour swatches.
 */
export function ColourPickerDropdown({
  colours,
  activeColour,
  onSelect,
  icon: Icon,
  label,
  tooltip,
  isActive,
}: ColourPickerDropdownProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                isActive && "bg-accent text-accent-foreground"
              )}
              aria-label={label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1">
          {colours.map((colour) => {
            const isSelected = colour.value === null
              ? !activeColour
              : activeColour === colour.value;

            return (
              <Tooltip key={colour.label}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md transition-all",
                      "hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                    )}
                    onClick={() => onSelect(colour.value)}
                  >
                    {colour.value ? (
                      <span
                        className="h-5 w-5 rounded-full border border-border"
                        style={{ backgroundColor: colour.value }}
                      >
                        {isSelected && (
                          <Check className="h-3 w-3 text-white drop-shadow-sm m-auto mt-1" />
                        )}
                      </span>
                    ) : (
                      // "Default" / "None" — no-colour swatch
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-xs text-muted-foreground">
                        {isSelected ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <span className="h-3 w-0.5 rotate-45 bg-destructive rounded-full" />
                        )}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {colour.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
