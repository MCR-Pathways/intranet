import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the URL only if it uses http: or https: protocol.
 * Returns undefined for javascript:, data:, or any other protocol.
 * Prevents Stored XSS via malicious href attributes.
 */
export function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validates that a URL uses http: or https: protocol.
 * Returns an error message string if invalid, or null if valid.
 * Use in server actions for input validation.
 */
export function validateUrl(url: string, fieldName: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return `${fieldName} must use https:// or http://`;
    }
  } catch {
    return `Invalid ${fieldName}`;
  }
  return null;
}

/**
 * Formats a date string into a relative time description.
 * e.g. "just now", "5m ago", "3h ago", "2d ago", "1w ago", or a full date.
 */
export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return formatDate(date);
}

/**
 * Formats a Date into "3 Feb 2026" style (day, short month, year).
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Formats a Date into a short "day month" string (e.g. "5 Feb").
 */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Formats a byte count into a human-readable file size string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * Extract initials from a name (up to 2 characters).
 * Returns "?" for empty/blank input.
 */
export function getInitials(name: string): string {
  if (!name?.trim()) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Formats a duration in minutes into a human-readable string.
 * "short" → "45 min", "2h 30m"  (for list views)
 * "long"  → "2 hours 30 minutes" (for detail views)
 */
export function formatDuration(
  minutes: number | null,
  style: "short" | "long" = "short"
): string {
  if (minutes == null) return "Self-paced";
  if (style === "long") {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    const hourStr = `${hours} hour${hours > 1 ? "s" : ""}`;
    return rem > 0 ? `${hourStr} ${rem} minutes` : hourStr;
  }
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

// ─── Avatar colours ─────────────────────────────────────────────────────────

/** 3 MCR brand colours that pass WCAG AA (4.5:1) with white text. */
const AVATAR_COLOURS = [
  { bg: "bg-primary", fg: "text-primary-foreground" },  // Navy #213350 (12.70:1)
  { bg: "bg-mcr-teal", fg: "text-white" },              // Teal #2A6075 (6.93:1)
  { bg: "bg-mcr-wine", fg: "text-white" },              // Wine #751B48 (10.46:1)
] as const;

/**
 * Deterministic avatar colour based on user name.
 * Same name always returns the same colour. Uses djb2-style hash.
 */
export function getAvatarColour(name: string): { bg: string; fg: string } {
  if (!name?.trim()) return AVATAR_COLOURS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
}
