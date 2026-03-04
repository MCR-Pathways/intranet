import { Home, Building2, Globe } from "lucide-react";
import type { WorkLocation } from "@/types/database.types";

// =============================================
// SHARED TYPES
// =============================================

/**
 * A single sign-in entry for the current user (no user_id needed).
 * Used in today-timeline, monthly-history, sign-in-page-content.
 */
export interface SignInEntry {
  id: string;
  sign_in_date: string;
  location: string;
  other_location: string | null;
  signed_in_at: string;
  created_at?: string;
}

/**
 * A sign-in entry that includes user_id — used in team/reports context
 * where entries from multiple users are displayed together.
 */
export interface TeamSignInEntry extends SignInEntry {
  user_id: string;
}

// =============================================
// LOCATION CONFIG
// =============================================

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

