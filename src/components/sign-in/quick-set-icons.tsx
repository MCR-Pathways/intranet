"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { LOCATIONS, LOCATION_CONFIG } from "@/lib/sign-in";
import type { WorkLocation } from "@/types/database.types";
import { setWorkingLocation, clearWorkingLocation } from "@/app/(protected)/sign-in/actions";
import { toast } from "sonner";

interface QuickSetIconsProps {
  date: string;
  currentLocation: string | null;
  /** When true, the date is on leave — location icons are disabled. */
  isOnLeave?: boolean;
  /** When true, the date is in the past. */
  isPast?: boolean;
  onLocationSet?: () => void;
}

export function QuickSetIcons({
  date,
  currentLocation,
  isOnLeave = false,
  isPast = false,
  onLocationSet,
}: QuickSetIconsProps) {
  const [isPending, startTransition] = useTransition();

  const handleSelect = (locationId: WorkLocation) => {
    if (isOnLeave || isPending) return;

    // If clicking the already-selected location, clear it
    if (locationId === currentLocation) {
      startTransition(async () => {
        const result = await clearWorkingLocation(date, "full_day");
        if (result.success) {
          toast.success("Location cleared");
          onLocationSet?.();
        } else {
          toast.error(result.error ?? "Failed to clear location");
        }
      });
      return;
    }

    startTransition(async () => {
      const result = await setWorkingLocation(date, "full_day", locationId);
      if (result.success) {
        const config = LOCATION_CONFIG[locationId];
        const dayName = new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" });
        toast.success(`${config?.label ?? locationId} set for ${dayName}`);
        onLocationSet?.();
      } else {
        toast.error(result.error ?? "Failed to set location");
      }
    });
  };

  const disabled = isOnLeave || isPast || isPending;

  return (
    <div className="grid grid-cols-4 gap-2">
      {LOCATIONS.map((loc) => {
        const config = LOCATION_CONFIG[loc.id];
        const isSelected = currentLocation === loc.id;
        const Icon = loc.icon;

        return (
          <button
            key={loc.id}
            type="button"
            onClick={() => handleSelect(loc.id)}
            disabled={disabled}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg p-3 text-xs font-medium transition-all",
              isSelected
                ? `${config?.bgClass} ${config?.textClass} ring-2 ring-primary`
                : "bg-muted/50 text-muted-foreground hover:bg-muted",
              disabled && "opacity-50 cursor-not-allowed",
              isPending && "animate-pulse"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate w-full text-center">{config?.shortLabel ?? loc.name}</span>
          </button>
        );
      })}
    </div>
  );
}
