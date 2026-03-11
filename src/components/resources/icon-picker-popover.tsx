"use client";

import { createElement, useState, useMemo, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RESOURCE_ICONS,
  ICON_CATEGORIES,
  ICON_COLOURS,
  resolveIcon,
  resolveIconColour,
  getIconName,
  type IconColour,
} from "@/lib/resource-icons";
import type { LucideIcon } from "lucide-react";

interface IconPickerPopoverProps {
  /** Currently selected icon name (Lucide displayName) */
  icon: string;
  /** Currently selected colour key */
  colour: string | null;
  onIconChange: (iconName: string) => void;
  onColourChange: (colourKey: string) => void;
}

export function IconPickerPopover({
  icon,
  colour,
  onIconChange,
  onColourChange,
}: IconPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedColour = resolveIconColour(colour);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return RESOURCE_ICONS;
    const q = search.toLowerCase();
    return RESOURCE_ICONS.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q)
    );
  }, [search]);

  // Group filtered icons by category
  const groupedIcons = useMemo(() => {
    const groups: Record<string, typeof RESOURCE_ICONS> = {};
    for (const cat of ICON_CATEGORIES) {
      const items = filteredIcons.filter((i) => i.category === cat);
      if (items.length > 0) groups[cat] = items;
    }
    return groups;
  }, [filteredIcons]);

  function handleSelect(selectedIcon: LucideIcon) {
    onIconChange(getIconName(selectedIcon));
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-xl transition-colors",
          selectedColour.bg,
          selectedColour.fg,
          "hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        onClick={() => setOpen(!open)}
      >
        {createElement(resolveIcon(icon), { className: "h-6 w-6" })}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-80 rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          // Stop clicks inside from propagating to Dialog's outside-click handler
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Search */}
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search icons..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          {/* Colour swatches */}
          <div className="flex items-center gap-1.5 border-b px-3 py-2">
            {ICON_COLOURS.map((c) => (
              <ColourSwatch
                key={c.key}
                colour={c}
                selected={selectedColour.key === c.key}
                onClick={() => onColourChange(c.key)}
              />
            ))}
          </div>

          {/* Icon grid */}
          <div className="max-h-64 overflow-y-auto p-2">
            {Object.keys(groupedIcons).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No icons found
              </p>
            ) : (
              Object.entries(groupedIcons).map(([category, icons]) => (
                <div key={category} className="mb-2">
                  <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {category}
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {icons.map((entry) => {
                      const name = getIconName(entry.icon);
                      const isSelected = name === icon;
                      return (
                        <Tooltip key={name}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                                isSelected
                                  ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                                  : "text-foreground/70 hover:bg-muted hover:text-foreground"
                              )}
                              onClick={() => handleSelect(entry.icon)}
                            >
                              <entry.icon className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {entry.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ColourSwatch({
  colour,
  selected,
  onClick,
}: {
  colour: IconColour;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-all",
            colour.bg,
            selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
          onClick={onClick}
        >
          {selected && (
            <div className={cn("h-2 w-2 rounded-full", colour.fg.replace("text-", "bg-"))} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {colour.label}
      </TooltipContent>
    </Tooltip>
  );
}
