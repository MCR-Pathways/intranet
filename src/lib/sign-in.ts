import { Home, Building2, Globe } from "lucide-react";
import type { WorkLocation } from "@/types/database.types";

/**
 * Location display configuration for badges and labels.
 * Used across timeline, history, team overview, member detail, and reports.
 */
export const LOCATION_CONFIG: Record<
  string,
  { label: string; icon: typeof Home; variant: "default" | "secondary" | "outline" }
> = {
  home: { label: "Home", icon: Home, variant: "secondary" },
  glasgow_office: { label: "Glasgow Office", icon: Building2, variant: "default" },
  stevenage_office: { label: "Stevenage Office", icon: Building2, variant: "default" },
  other: { label: "Other", icon: Globe, variant: "outline" },
};

/**
 * Location options for the sign-in form and nudge bubble.
 * Includes short names for compact display contexts.
 */
export const LOCATIONS: { id: WorkLocation; name: string; icon: typeof Home; description: string }[] = [
  { id: "home", name: "Home", icon: Home, description: "Working from home" },
  { id: "glasgow_office", name: "Glasgow Office", icon: Building2, description: "Glasgow HQ" },
  { id: "stevenage_office", name: "Stevenage Office", icon: Building2, description: "Stevenage office" },
  { id: "other", name: "Other", icon: Globe, description: "Another location" },
];

/**
 * Format an ISO timestamp to a short time string (e.g. "09:30").
 */
export function formatSignInTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a YYYY-MM-DD date string to a short display format (e.g. "Mon, 3 Feb").
 */
export function formatSignInDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Resolve the display label for a sign-in entry's location.
 * Returns the custom location text for "other" entries, or the config label.
 */
export function getLocationLabel(location: string, otherLocation: string | null): string {
  if (location === "other" && otherLocation) return otherLocation;
  return LOCATION_CONFIG[location]?.label ?? "Other";
}

/**
 * Get up to 2 uppercase initials from a name (e.g. "John Smith" → "JS").
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
