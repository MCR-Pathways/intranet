import { Home, Building2, MapPin, CalendarOff, CircleDashed } from "lucide-react";
import type { WorkLocation, TimeSlot, LocationSource } from "@/types/database.types";

// =============================================
// SHARED CONSTANTS
// =============================================

/** Office locations for headcount and attendance queries. */
export const OFFICE_LOCATIONS = ["glasgow_office", "stevenage_office"] as const;

/** Minimum number of staff expected in the office per day. */
export const OFFICE_HEADCOUNT_TARGET = 4;

// =============================================
// SHARED TYPES
// =============================================

/** A working location entry for display purposes. */
export interface WorkingLocationEntry {
  id: string;
  user_id: string;
  date: string;
  time_slot: TimeSlot;
  location: WorkLocation;
  other_location: string | null;
  source: LocationSource;
  confirmed: boolean;
  confirmed_at: string | null;
  leave_request_id: string | null;
}

/** A weekly pattern entry. */
export interface WeeklyPatternEntry {
  id: string;
  user_id: string;
  day_of_week: number;
  time_slot: TimeSlot;
  location: WorkLocation;
  other_location: string | null;
}

/** Composite day schedule — combines full_day or morning+afternoon entries. */
export interface DaySchedule {
  date: string;
  fullDay: WorkingLocationEntry | null;
  morning: WorkingLocationEntry | null;
  afternoon: WorkingLocationEntry | null;
}

/** Team member with their schedule entries. */
export interface TeamMemberSchedule {
  id: string;
  full_name: string;
  preferred_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  entries: WorkingLocationEntry[];
}

// =============================================
// LOCATION CONFIG (V2 — colour-blind accessible)
// =============================================

/**
 * Location display configuration for badges, cells, and charts.
 * Colours use {colour}-100/{colour}-800 shade level to distinguish
 * from leave type colours which use {colour}-50/{colour}-600.
 */
export const LOCATION_CONFIG: Record<
  string,
  {
    label: string;
    shortLabel: string;
    icon: typeof Home;
    bgClass: string;
    textClass: string;
    hex: string;
  }
> = {
  home: {
    label: "Home",
    shortLabel: "Home",
    icon: Home,
    bgClass: "bg-emerald-100",
    textClass: "text-emerald-800",
    hex: "#065f46",
  },
  glasgow_office: {
    label: "Glasgow Office",
    shortLabel: "Glasgow",
    icon: Building2,
    bgClass: "bg-blue-100",
    textClass: "text-blue-800",
    hex: "#1e40af",
  },
  stevenage_office: {
    label: "Stevenage Office",
    shortLabel: "Stevenage",
    icon: Building2,
    bgClass: "bg-blue-100",
    textClass: "text-blue-800",
    hex: "#1e40af",
  },
  other: {
    label: "Other",
    shortLabel: "Other",
    icon: MapPin,
    bgClass: "bg-violet-100",
    textClass: "text-violet-800",
    hex: "#5b21b6",
  },
  on_leave: {
    label: "On Leave",
    shortLabel: "Leave",
    icon: CalendarOff,
    bgClass: "bg-rose-100",
    textClass: "text-rose-800",
    hex: "#9f1239",
  },
};

/** Config for "not set" state (used in DayCell). */
export const NOT_SET_CONFIG = {
  label: "Not set",
  shortLabel: "—",
  icon: CircleDashed,
  bgClass: "bg-gray-50",
  textClass: "text-gray-400",
  hex: "#9ca3af",
};

/**
 * Location options for the location picker dialog.
 * Excludes 'on_leave' (auto-created from leave requests, not manually set).
 */
export const LOCATIONS: { id: WorkLocation; name: string; icon: typeof Home; description: string }[] = [
  { id: "home", name: "Home", icon: Home, description: "Working from home" },
  { id: "glasgow_office", name: "Glasgow Office", icon: Building2, description: "Glasgow HQ" },
  { id: "stevenage_office", name: "Stevenage Office", icon: Building2, description: "Stevenage office" },
  { id: "other", name: "Other", icon: MapPin, description: "Another location" },
];

// =============================================
// DATE HELPERS
// =============================================

/**
 * Get today's date in YYYY-MM-DD format using the UK timezone.
 * Critical: all date comparisons must use UK timezone, not UTC.
 */
export function getUKToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

/**
 * Get the Monday–Friday dates for a given week offset from the current week.
 * offset=0 → this week, offset=1 → next week, offset=-1 → last week.
 */
export function getWeekDates(offset: number = 0): string[] {
  const today = new Date(getUKToday() + "T12:00:00");
  const dayOfWeek = today.getDay();
  // Monday = day 1, so subtract (dayOfWeek - 1) to get Monday. Sunday (0) → subtract 6.
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + offset * 7);

  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

/**
 * Build a DaySchedule from a list of entries for a single date.
 */
export function buildDaySchedule(date: string, entries: WorkingLocationEntry[]): DaySchedule {
  const dayEntries = entries.filter((e) => e.date === date);
  return {
    date,
    fullDay: dayEntries.find((e) => e.time_slot === "full_day") ?? null,
    morning: dayEntries.find((e) => e.time_slot === "morning") ?? null,
    afternoon: dayEntries.find((e) => e.time_slot === "afternoon") ?? null,
  };
}

/**
 * Format a YYYY-MM-DD date string to a short display format (e.g. "Mon, 3 Mar").
 */
export function formatScheduleDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Format a YYYY-MM-DD date string to just the day name (e.g. "Mon").
 */
export function formatDayName(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-GB", { weekday: "short" });
}

/**
 * Format a YYYY-MM-DD date string to day + month (e.g. "3 Mar").
 */
export function formatDayMonth(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Resolve the display label for a location.
 * Returns the custom location text for "other" entries, or the config label.
 */
export function getLocationLabel(location: string, otherLocation: string | null): string {
  if (location === "other" && otherLocation) return otherLocation;
  return LOCATION_CONFIG[location]?.label ?? "Other";
}

/**
 * Check if a date is today (UK timezone).
 */
export function isToday(dateString: string): boolean {
  return dateString === getUKToday();
}

/**
 * Check if a date is in the past (UK timezone).
 */
export function isPastDate(dateString: string): boolean {
  return dateString < getUKToday();
}
