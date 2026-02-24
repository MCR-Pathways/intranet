/**
 * Shared HR module constants, configuration, and utility functions.
 *
 * This file is the single source of truth for all HR-related display config,
 * labels, icons, and business logic calculations. It follows the same pattern
 * as src/lib/sign-in.ts and src/lib/learning.ts.
 */

import type { LeaveRequest, LeaveRequestWithEmployee } from "@/types/hr";
import {
  Calendar,
  Clock,
  Heart,
  Baby,
  Scale,
  BookOpen,
  Coffee,
  HeartPulse,
  Laptop,
  Monitor,
  Smartphone,
  Headphones,
  Package,
} from "lucide-react";

// =============================================
// LEAVE TYPES
// =============================================

/** All supported leave types and their display configuration. */
export const LEAVE_TYPE_CONFIG = {
  annual: {
    label: "Annual Leave",
    icon: Calendar,
    colour: "text-blue-600",
    bgColour: "bg-blue-50",
    badgeVariant: "default" as const,
  },
  sick: {
    label: "Sick Leave",
    icon: HeartPulse,
    colour: "text-amber-600",
    bgColour: "bg-amber-50",
    badgeVariant: "secondary" as const,
  },
  maternity: {
    label: "Maternity Leave",
    icon: Baby,
    colour: "text-pink-600",
    bgColour: "bg-pink-50",
    badgeVariant: "secondary" as const,
  },
  paternity: {
    label: "Paternity Leave",
    icon: Baby,
    colour: "text-indigo-600",
    bgColour: "bg-indigo-50",
    badgeVariant: "secondary" as const,
  },
  shared_parental: {
    label: "Shared Parental Leave",
    icon: Baby,
    colour: "text-purple-600",
    bgColour: "bg-purple-50",
    badgeVariant: "secondary" as const,
  },
  adoption: {
    label: "Adoption Leave",
    icon: Heart,
    colour: "text-rose-600",
    bgColour: "bg-rose-50",
    badgeVariant: "secondary" as const,
  },
  compassionate: {
    label: "Compassionate Leave",
    icon: Heart,
    colour: "text-amber-600",
    bgColour: "bg-amber-50",
    badgeVariant: "outline" as const,
  },
  jury_service: {
    label: "Jury Service",
    icon: Scale,
    colour: "text-slate-600",
    bgColour: "bg-slate-50",
    badgeVariant: "outline" as const,
  },
  toil: {
    label: "TOIL",
    icon: Clock,
    colour: "text-teal-600",
    bgColour: "bg-teal-50",
    badgeVariant: "outline" as const,
  },
  unpaid: {
    label: "Unpaid Leave",
    icon: Coffee,
    colour: "text-gray-600",
    bgColour: "bg-gray-50",
    badgeVariant: "outline" as const,
  },
  study: {
    label: "Study Leave",
    icon: BookOpen,
    colour: "text-emerald-600",
    bgColour: "bg-emerald-50",
    badgeVariant: "outline" as const,
  },
} as const;

export type LeaveType = keyof typeof LEAVE_TYPE_CONFIG;

/** Leave types that employees can self-request. */
export const REQUESTABLE_LEAVE_TYPES: LeaveType[] = [
  "annual",
  "compassionate",
  "toil",
  "unpaid",
  "study",
];

/** Leave types that only HR/managers can record. */
export const HR_ONLY_LEAVE_TYPES: LeaveType[] = [
  "sick",
  "maternity",
  "paternity",
  "shared_parental",
  "adoption",
  "jury_service",
];

// =============================================
// CONTRACT TYPES
// =============================================

export const CONTRACT_TYPE_CONFIG = {
  permanent: { label: "Permanent", colour: "text-green-700", bgColour: "bg-green-50" },
  fixed_term: { label: "Fixed Term", colour: "text-amber-700", bgColour: "bg-amber-50" },
  casual: { label: "Casual", colour: "text-gray-700", bgColour: "bg-gray-50" },
  secondment: { label: "Secondment", colour: "text-blue-700", bgColour: "bg-blue-50" },
} as const;

export type ContractType = keyof typeof CONTRACT_TYPE_CONFIG;

// =============================================
// DEPARTMENTS
// =============================================

export const DEPARTMENT_CONFIG = {
  executive: { label: "Executive" },
  people: { label: "People" },
  finance: { label: "Finance" },
  delivery: { label: "Delivery" },
  development: { label: "Development" },
  engagement: { label: "Engagement & Influencing" },
  systems: { label: "Systems, Evidence & Impact" },
  fundraising: { label: "Fundraising & Partnerships" },
  communications: { label: "Communications & Policy" },
  learning_development: { label: "Learning & Development" },
  hr: { label: "HR" },
} as const;

export type Department = keyof typeof DEPARTMENT_CONFIG;

// =============================================
// REGIONS
// =============================================

export const REGION_CONFIG = {
  west: { label: "West", description: "Glasgow & West Scotland" },
  east: { label: "East", description: "Edinburgh, Fife, Dundee, Perth & Kinross" },
  north: { label: "North", description: "Highland, Aberdeen, Shetland" },
  england: { label: "England", description: "Surrey, Hertfordshire, London, NE England" },
  central: { label: "Central", description: "Central support team" },
  national: { label: "National", description: "Organisation-wide role" },
} as const;

export type Region = keyof typeof REGION_CONFIG;

/**
 * Map a region to its public holiday calendar.
 * Scotland-based regions use the Scotland calendar; England uses England.
 */
export function getHolidayCalendar(region: Region | null): "scotland" | "england" {
  if (region === "england") return "england";
  return "scotland"; // Default to Scotland for all Scottish regions + central/national
}

// =============================================
// WORK PATTERNS
// =============================================

export const WORK_PATTERN_CONFIG = {
  standard: { label: "Standard (Mon–Fri)", daysPerWeek: 5 },
  part_time: { label: "Part-Time", daysPerWeek: null }, // Varies — use FTE
  compressed: { label: "Compressed Hours", daysPerWeek: 4 },
  term_time: { label: "Term-Time Only", daysPerWeek: 5 },
} as const;

export type WorkPattern = keyof typeof WORK_PATTERN_CONFIG;

// =============================================
// SICKNESS CATEGORIES
// =============================================

export const SICKNESS_CATEGORY_CONFIG = {
  cold_flu: { label: "Cold / Flu" },
  stomach: { label: "Stomach / Digestive" },
  headache_migraine: { label: "Headache / Migraine" },
  musculoskeletal: { label: "Musculoskeletal (Back, Joint, etc.)" },
  mental_health: { label: "Mental Health" },
  injury: { label: "Injury / Accident" },
  surgery: { label: "Surgery / Medical Procedure" },
  dental: { label: "Dental" },
  pregnancy_related: { label: "Pregnancy Related" },
  chronic_condition: { label: "Chronic Condition" },
  covid: { label: "COVID-19" },
  other: { label: "Other" },
} as const;

export type SicknessCategory = keyof typeof SICKNESS_CATEGORY_CONFIG;

// =============================================
// LEAVING REASONS
// =============================================

export const LEAVING_REASON_CONFIG = {
  resignation: { label: "Resignation" },
  redundancy: { label: "Redundancy" },
  end_of_contract: { label: "End of Contract" },
  retirement: { label: "Retirement" },
  dismissal: { label: "Dismissal" },
  mutual_agreement: { label: "Mutual Agreement" },
  other: { label: "Other" },
} as const;

export type LeavingReason = keyof typeof LEAVING_REASON_CONFIG;

// =============================================
// EMPLOYMENT HISTORY EVENT TYPES
// =============================================

export const EMPLOYMENT_EVENT_CONFIG = {
  hired: { label: "Hired", colour: "text-green-600" },
  promotion: { label: "Promotion", colour: "text-blue-600" },
  role_change: { label: "Role Change", colour: "text-indigo-600" },
  fte_change: { label: "FTE Change", colour: "text-teal-600" },
  department_change: { label: "Department Change", colour: "text-purple-600" },
  team_change: { label: "Team Change", colour: "text-cyan-600" },
  secondment_start: { label: "Secondment Started", colour: "text-amber-600" },
  secondment_end: { label: "Secondment Ended", colour: "text-amber-600" },
  contract_change: { label: "Contract Change", colour: "text-orange-600" },
  manager_change: { label: "Manager Change", colour: "text-slate-600" },
  region_change: { label: "Region Change", colour: "text-pink-600" },
  left: { label: "Left Organisation", colour: "text-red-600" },
} as const;

export type EmploymentEventType = keyof typeof EMPLOYMENT_EVENT_CONFIG;

// =============================================
// COMPLIANCE DOCUMENT STATUS
// =============================================

export const COMPLIANCE_STATUS_CONFIG = {
  valid: { label: "Valid", colour: "text-green-700", bgColour: "bg-green-50", dotColour: "bg-green-500" },
  expiring_soon: { label: "Expiring Soon", colour: "text-amber-700", bgColour: "bg-amber-50", dotColour: "bg-amber-500" },
  expired: { label: "Expired", colour: "text-red-700", bgColour: "bg-red-50", dotColour: "bg-red-500" },
  pending_renewal: { label: "Pending Renewal", colour: "text-blue-700", bgColour: "bg-blue-50", dotColour: "bg-blue-500" },
  not_applicable: { label: "N/A", colour: "text-gray-500", bgColour: "bg-gray-50", dotColour: "bg-gray-400" },
} as const;

export type ComplianceStatus = keyof typeof COMPLIANCE_STATUS_CONFIG;

// =============================================
// ASSET TYPES (default icons)
// =============================================

export const DEFAULT_ASSET_ICONS: Record<string, typeof Laptop> = {
  Laptop: Laptop,
  Monitor: Monitor,
  Phone: Smartphone,
  Headset: Headphones,
  Default: Package,
};

// =============================================
// GENDER OPTIONS
// =============================================

export const GENDER_CONFIG = {
  male: { label: "Male" },
  female: { label: "Female" },
  non_binary: { label: "Non-Binary" },
  prefer_not_to_say: { label: "Prefer Not to Say" },
  other: { label: "Other" },
} as const;

export type Gender = keyof typeof GENDER_CONFIG;

// =============================================
// COUNTRY OPTIONS
// =============================================

/** Common countries for the address country field. */
export const COUNTRY_OPTIONS = [
  "United Kingdom",
  "Ireland",
  "United States",
  "Canada",
  "Australia",
  "New Zealand",
  "India",
  "Pakistan",
  "Nigeria",
  "South Africa",
  "France",
  "Germany",
  "Spain",
  "Italy",
  "Poland",
  "Romania",
  "Other",
] as const;

// =============================================
// LEAVE CALCULATION UTILITIES
// =============================================

/**
 * Calculate the number of working days between two dates (inclusive),
 * excluding weekends and public holidays for the given region.
 *
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param publicHolidays - Array of holiday date strings (YYYY-MM-DD)
 * @param startHalfDay - If true, only count half a day for the start date
 * @param endHalfDay - If true, only count half a day for the end date
 * @returns Number of working days (can be fractional for half-days)
 */
export function calculateWorkingDays(
  startDate: string,
  endDate: string,
  publicHolidays: string[] = [],
  startHalfDay = false,
  endHalfDay = false,
): number {
  const holidaySet = new Set(publicHolidays);
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.getFullYear() + "-" + String(current.getMonth() + 1).padStart(2, "0") + "-" + String(current.getDate()).padStart(2, "0");

    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      workingDays += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  // Apply half-day adjustments
  if (startHalfDay && workingDays > 0) workingDays -= 0.5;
  if (endHalfDay && workingDays > 0) workingDays -= 0.5;

  return Math.max(0, workingDays);
}

/**
 * Calculate FTE-adjusted leave days.
 * For part-time employees, the working days are adjusted by their FTE.
 */
export function calculateFTEAdjustedDays(workingDays: number, fte: number): number {
  return Math.round(workingDays * fte * 100) / 100; // Round to 2dp
}

/**
 * Calculate pro-rated annual leave entitlement for a mid-year starter or leaver.
 *
 * @param baseEntitlement - Full-year entitlement in days
 * @param fte - Employee's FTE (0.0–1.0)
 * @param startDate - When employment/leave year starts (whichever is later)
 * @param endDate - When employment/leave year ends (whichever is earlier)
 * @param leaveYearStart - Start of the leave year (e.g. "2026-01-01")
 * @param leaveYearEnd - End of the leave year (e.g. "2026-12-31")
 * @returns Pro-rated entitlement, rounded to nearest half-day
 */
export function calculateProRataEntitlement(
  baseEntitlement: number,
  fte: number,
  startDate: string,
  endDate: string,
  leaveYearStart: string,
  leaveYearEnd: string,
): number {
  const yearStart = new Date(leaveYearStart + "T00:00:00");
  const yearEnd = new Date(leaveYearEnd + "T00:00:00");
  const empStart = new Date(startDate + "T00:00:00");
  const empEnd = new Date(endDate + "T00:00:00");

  // Effective period within the leave year
  const effectiveStart = empStart > yearStart ? empStart : yearStart;
  const effectiveEnd = empEnd < yearEnd ? empEnd : yearEnd;

  // Total days in leave year and effective period
  const totalDaysInYear = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
  const effectiveDays = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24) + 1;

  if (effectiveDays <= 0) return 0;

  const proRata = (baseEntitlement * fte * effectiveDays) / totalDaysInYear;

  // Round to nearest half-day
  return Math.round(proRata * 2) / 2;
}

// =============================================
// BRADFORD FACTOR CALCULATION
// =============================================

/**
 * Calculate the Bradford Factor for an employee.
 * Formula: B = S² × D
 * Where S = number of separate absence spells, D = total days absent.
 *
 * @param absenceSpells - Number of separate absence spells in the period
 * @param totalDaysAbsent - Total days absent across all spells
 * @returns Bradford Factor score
 */
export function calculateBradfordFactor(absenceSpells: number, totalDaysAbsent: number): number {
  return absenceSpells * absenceSpells * totalDaysAbsent;
}

/**
 * Get the severity level for a Bradford Factor score.
 * Thresholds follow common UK HR practice.
 */
export function getBradfordFactorSeverity(score: number): {
  level: "low" | "medium" | "high" | "critical";
  label: string;
  colour: string;
  bgColour: string;
} {
  if (score <= 50) {
    return { level: "low", label: "Low", colour: "text-green-700", bgColour: "bg-green-50" };
  }
  if (score <= 124) {
    return { level: "medium", label: "Medium", colour: "text-amber-700", bgColour: "bg-amber-50" };
  }
  if (score <= 399) {
    return { level: "high", label: "High", colour: "text-orange-700", bgColour: "bg-orange-50" };
  }
  return { level: "critical", label: "Critical", colour: "text-red-700", bgColour: "bg-red-50" };
}

// =============================================
// FORMATTING UTILITIES
// =============================================

/**
 * Format FTE as a display string.
 * 1.0 → "Full-Time", 0.8 → "0.8 FTE", 0.6 → "0.6 FTE"
 */
export function formatFTE(fte: number | null): string {
  if (fte === null || fte === undefined) return "—";
  if (fte === 1.0 || fte === 1) return "Full-Time";
  return `${fte} FTE`;
}

/**
 * Format a leave balance for display.
 * 25 → "25 days", 12.5 → "12.5 days", 0 → "0 days"
 */
export function formatLeaveDays(days: number): string {
  if (days === 1) return "1 day";
  return `${days} days`;
}

/**
 * Format a date string (YYYY-MM-DD) to a UK display format.
 * Returns "3 Feb 2026" style.
 */
export function formatHRDate(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a date with day of week. Returns "Mon, 3 Feb 2026" style.
 */
export function formatHRDateLong(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Calculate length of service from start date to today (or a given date).
 * Returns a human-readable string like "2 years, 3 months".
 */
export function calculateLengthOfService(
  startDate: string,
  endDate?: string,
): string {
  const start = new Date(startDate + "T00:00:00");
  const end = endDate ? new Date(endDate + "T00:00:00") : new Date();

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "month" : "months"}`);

  return parts.length > 0 ? parts.join(", ") : "Less than a month";
}

// =============================================
// LEAVE YEAR CONSTANTS
// =============================================

/** MCR Pathways leave year runs January to December. */
export const LEAVE_YEAR_START_MONTH = 0;  // January (0-indexed)
export const LEAVE_YEAR_START_DAY = 1;

/**
 * Get the leave year boundaries for a given date.
 * MCR uses calendar year (Jan 1 – Dec 31).
 */
export function getLeaveYearForDate(date: Date = new Date()): {
  start: string;
  end: string;
  year: number;
} {
  const year = date.getFullYear();
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    year,
  };
}

// =============================================
// VALIDATION CONSTANTS
// =============================================

/** Maximum file size for HR document uploads (10MB). */
export const HR_DOCUMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** Allowed MIME types for HR document uploads. */
export const HR_DOCUMENT_ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

/**
 * Validate an HR document file for upload.
 * Returns null if valid, or an error message string.
 */
export function validateHRDocument(file: { size: number; type: string }): string | null {
  if (file.size > HR_DOCUMENT_MAX_SIZE_BYTES) {
    return `File too large. Maximum size is ${HR_DOCUMENT_MAX_SIZE_BYTES / (1024 * 1024)}MB.`;
  }
  if (!HR_DOCUMENT_ALLOWED_TYPES.includes(file.type)) {
    return "Unsupported file type. Please upload a PDF, JPEG, PNG, or DOCX file.";
  }
  return null;
}

// =============================================
// LEAVE REQUEST QUERY HELPERS
// =============================================

/** Explicit column list for leave_requests queries. */
export const LEAVE_REQUEST_SELECT =
  "id, profile_id, leave_type, start_date, end_date, start_half_day, end_half_day, total_days, reason, status, decided_by, decided_at, decision_notes, rejection_reason, created_at";

/** Select string for leave_requests joined with the requester's profile. */
export const LEAVE_REQUEST_WITH_EMPLOYEE_SELECT =
  `${LEAVE_REQUEST_SELECT}, profiles!leave_requests_profile_id_fkey(full_name, avatar_url, job_title)`;

/** Map raw Supabase leave request + profile join data to LeaveRequestWithEmployee. */
export function mapToLeaveRequestWithEmployee(
  data: Record<string, unknown>[],
): LeaveRequestWithEmployee[] {
  return data.map((r) => {
    const p = r.profiles as {
      full_name: string;
      avatar_url: string | null;
      job_title: string | null;
    } | null;
    return {
      ...r,
      leave_type: r.leave_type as LeaveType,
      status: r.status as LeaveRequest["status"],
      employee_name: (p?.full_name as string) ?? "Unknown",
      employee_avatar: (p?.avatar_url as string | null) ?? null,
      employee_job_title: (p?.job_title as string | null) ?? null,
    } as LeaveRequestWithEmployee;
  });
}
