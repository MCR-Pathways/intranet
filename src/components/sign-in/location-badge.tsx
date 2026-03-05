"use client";

import { cn } from "@/lib/utils";
import { LOCATION_CONFIG, NOT_SET_CONFIG, getLocationLabel } from "@/lib/sign-in";

// =============================================
// LOCATION BADGE — V2 (colour-coded pill)
// =============================================

interface LocationBadgeProps {
  location: string;
  otherLocation?: string | null;
  /** Additional className for the badge */
  className?: string;
}

/**
 * Renders a colour-coded pill with icon + location label.
 * Uses the V2 LOCATION_CONFIG with bgClass/textClass colours.
 */
export function LocationBadge({
  location,
  otherLocation,
  className,
}: LocationBadgeProps) {
  const config = LOCATION_CONFIG[location] ?? NOT_SET_CONFIG;
  const Icon = config.icon;
  const label = getLocationLabel(location, otherLocation ?? null);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
        config.bgClass,
        config.textClass,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
