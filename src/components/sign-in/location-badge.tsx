"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LOCATION_CONFIG, getLocationLabel, formatSignInTime, formatSignInDate } from "@/lib/sign-in";
import type { SignInEntry } from "@/lib/sign-in";

// =============================================
// LOCATION BADGE — shared across sign-in views
// =============================================

interface LocationBadgeProps {
  entry: Pick<SignInEntry, "location" | "other_location" | "signed_in_at" | "sign_in_date">;
  /** Show the time (HH:MM) inside the badge. Default: false */
  showTime?: boolean;
  /** Show the date (Mon, 3 Feb) inside the badge. Default: false */
  showDate?: boolean;
  /** Additional className for the badge */
  className?: string;
}

/**
 * Renders a coloured Badge with icon + location label.
 * Optionally includes time and/or date for compact history views.
 *
 * Replaces 5 identical inline rendering patterns across:
 * - today-timeline, monthly-history, member-detail, reports-panel, team-overview
 */
export function LocationBadge({
  entry,
  showTime = false,
  showDate = false,
  className,
}: LocationBadgeProps) {
  const config = LOCATION_CONFIG[entry.location] ?? LOCATION_CONFIG.other;
  const Icon = config.icon;
  const label = getLocationLabel(entry.location, entry.other_location);

  return (
    <Badge variant={config.variant} className={cn("gap-1", className)}>
      <Icon className="h-3 w-3" />
      {showDate && (
        <span>{formatSignInDate(entry.sign_in_date)}</span>
      )}
      {showTime && (
        <span className="font-mono text-xs">
          {formatSignInTime(entry.signed_in_at)}
        </span>
      )}
      {label}
    </Badge>
  );
}
