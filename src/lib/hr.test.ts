import { describe, it, expect } from "vitest";
import {
  calculateWorkingDays,
  calculateFTEAdjustedDays,
  calculateProRataEntitlement,
  calculateBradfordFactor,
  getBradfordFactorSeverity,
  calculateTriggerPoint,
  getWellbeingPrompt,
  getLeaveYearForDate,
  formatFTE,
  formatLeaveDays,
  formatHRDate,
  formatHRDateLong,
  calculateLengthOfService,
  validateHRDocument,
  getHolidayCalendar,
  mapToLeaveRequestWithEmployee,
  HR_DOCUMENT_MAX_SIZE_BYTES,
} from "@/lib/hr";

// =============================================
// calculateWorkingDays
// =============================================

describe("calculateWorkingDays", () => {
  it("counts weekdays in a standard Mon-Fri week", () => {
    // Mon 6 Jan 2025 → Fri 10 Jan 2025 = 5 working days
    expect(calculateWorkingDays("2025-01-06", "2025-01-10")).toBe(5);
  });

  it("excludes weekends", () => {
    // Mon 6 Jan → Sun 12 Jan 2025 = 5 working days (Sat+Sun excluded)
    expect(calculateWorkingDays("2025-01-06", "2025-01-12")).toBe(5);
  });

  it("handles a two-week span", () => {
    // Mon 6 Jan → Fri 17 Jan 2025 = 10 working days
    expect(calculateWorkingDays("2025-01-06", "2025-01-17")).toBe(10);
  });

  it("returns 0 for weekend-only range", () => {
    // Sat 11 Jan → Sun 12 Jan 2025
    expect(calculateWorkingDays("2025-01-11", "2025-01-12")).toBe(0);
  });

  it("returns 1 for a single working day", () => {
    expect(calculateWorkingDays("2025-01-06", "2025-01-06")).toBe(1);
  });

  it("returns 0 for a single weekend day", () => {
    expect(calculateWorkingDays("2025-01-11", "2025-01-11")).toBe(0);
  });

  it("returns 0 when end date is before start date", () => {
    expect(calculateWorkingDays("2025-01-10", "2025-01-06")).toBe(0);
  });

  it("excludes public holidays", () => {
    // Mon 6 Jan → Fri 10 Jan, but Wed 8 Jan is a holiday = 4 working days
    expect(calculateWorkingDays("2025-01-06", "2025-01-10", ["2025-01-08"])).toBe(4);
  });

  it("excludes multiple public holidays", () => {
    // Mon 6 Jan → Fri 10 Jan, Mon + Fri are holidays = 3 working days
    expect(calculateWorkingDays("2025-01-06", "2025-01-10", ["2025-01-06", "2025-01-10"])).toBe(3);
  });

  it("ignores holidays on weekends", () => {
    // Holiday on Saturday should not affect count
    expect(calculateWorkingDays("2025-01-06", "2025-01-10", ["2025-01-11"])).toBe(5);
  });

  it("handles empty holidays array", () => {
    expect(calculateWorkingDays("2025-01-06", "2025-01-10", [])).toBe(5);
  });

  it("applies half-day deduction for start date", () => {
    // 5 working days - 0.5 for half-day start = 4.5
    expect(calculateWorkingDays("2025-01-06", "2025-01-10", [], true, false)).toBe(4.5);
  });

  it("applies half-day deduction for end date", () => {
    expect(calculateWorkingDays("2025-01-06", "2025-01-10", [], false, true)).toBe(4.5);
  });

  it("applies half-day deduction for both start and end", () => {
    // 5 - 0.5 - 0.5 = 4
    expect(calculateWorkingDays("2025-01-06", "2025-01-10", [], true, true)).toBe(4);
  });

  it("does not go below 0 with half-day on single day", () => {
    // 1 working day - 0.5 - 0.5 = 0 (Math.max(0, ...))
    expect(calculateWorkingDays("2025-01-06", "2025-01-06", [], true, true)).toBe(0);
  });

  it("does not deduct half-day when result is 0 days", () => {
    // Weekend: 0 days, half-day should still be 0
    expect(calculateWorkingDays("2025-01-11", "2025-01-11", [], true, false)).toBe(0);
  });

  it("handles month boundary", () => {
    // Thu 30 Jan → Mon 3 Feb 2025 = 3 working days (Thu, Fri, Mon)
    expect(calculateWorkingDays("2025-01-30", "2025-02-03")).toBe(3);
  });

  it("handles year boundary", () => {
    // Tue 30 Dec 2025 → Fri 2 Jan 2026 = 3 working days (Tue, Wed, Fri — Thu 1 Jan if not a holiday)
    // Actually: 30 Dec (Tue), 31 Dec (Wed), 1 Jan (Thu), 2 Jan (Fri) = 4 working days
    expect(calculateWorkingDays("2025-12-30", "2026-01-02")).toBe(4);
  });

  it("handles year boundary with New Year holiday", () => {
    expect(calculateWorkingDays("2025-12-30", "2026-01-02", ["2026-01-01"])).toBe(3);
  });
});

// =============================================
// calculateFTEAdjustedDays
// =============================================

describe("calculateFTEAdjustedDays", () => {
  it("returns same value for full-time (1.0)", () => {
    expect(calculateFTEAdjustedDays(10, 1.0)).toBe(10);
  });

  it("scales proportionally for 0.5 FTE", () => {
    expect(calculateFTEAdjustedDays(10, 0.5)).toBe(5);
  });

  it("scales proportionally for 0.8 FTE", () => {
    expect(calculateFTEAdjustedDays(10, 0.8)).toBe(8);
  });

  it("rounds to 2 decimal places", () => {
    // 7 * 0.3 = 2.0999... → should round to 2.1
    expect(calculateFTEAdjustedDays(7, 0.3)).toBe(2.1);
  });

  it("returns 0 for 0 days", () => {
    expect(calculateFTEAdjustedDays(0, 0.8)).toBe(0);
  });

  it("returns 0 for 0 FTE", () => {
    expect(calculateFTEAdjustedDays(10, 0)).toBe(0);
  });
});

// =============================================
// calculateProRataEntitlement
// =============================================

describe("calculateProRataEntitlement", () => {
  it("returns full entitlement for full-year full-time employee", () => {
    const result = calculateProRataEntitlement(25, 1.0, "2026-01-01", "2026-12-31", "2026-01-01", "2026-12-31");
    expect(result).toBe(25);
  });

  it("halves entitlement for mid-year starter (July 1)", () => {
    // ~184 days out of 365 = ~50.4% → 25 * 1.0 * 50.4% ≈ 12.6 → rounded to 12.5
    const result = calculateProRataEntitlement(25, 1.0, "2026-07-01", "2026-12-31", "2026-01-01", "2026-12-31");
    expect(result).toBe(12.5);
  });

  it("scales by FTE for part-time employee", () => {
    const result = calculateProRataEntitlement(25, 0.5, "2026-01-01", "2026-12-31", "2026-01-01", "2026-12-31");
    expect(result).toBe(12.5);
  });

  it("combines pro-rata and FTE for mid-year part-time starter", () => {
    // Half year at 0.5 FTE: 25 * 0.5 * ~0.504 ≈ 6.3 → rounded to 6.5
    const result = calculateProRataEntitlement(25, 0.5, "2026-07-01", "2026-12-31", "2026-01-01", "2026-12-31");
    expect(result).toBeCloseTo(6.5, 0); // within 0.5 due to rounding
  });

  it("clamps employment start to leave year start", () => {
    // Employee started 2025, leave year 2026 — should use full year
    const result = calculateProRataEntitlement(25, 1.0, "2025-06-15", "2026-12-31", "2026-01-01", "2026-12-31");
    expect(result).toBe(25);
  });

  it("clamps employment end to leave year end", () => {
    // Employee ends 2027, leave year 2026 — should use full year
    const result = calculateProRataEntitlement(25, 1.0, "2026-01-01", "2027-06-15", "2026-01-01", "2026-12-31");
    expect(result).toBe(25);
  });

  it("returns 0 when employment ends before leave year starts", () => {
    const result = calculateProRataEntitlement(25, 1.0, "2025-01-01", "2025-06-30", "2026-01-01", "2026-12-31");
    expect(result).toBe(0);
  });

  it("rounds to nearest half-day", () => {
    // Contrived scenario: 25 * 1.0 * (100/365) ≈ 6.849 → rounds to 7.0
    const result = calculateProRataEntitlement(25, 1.0, "2026-09-23", "2026-12-31", "2026-01-01", "2026-12-31");
    expect(result % 0.5).toBe(0); // Must be a multiple of 0.5
  });
});

// =============================================
// calculateBradfordFactor
// =============================================

describe("calculateBradfordFactor", () => {
  it("calculates S² × D", () => {
    expect(calculateBradfordFactor(3, 10)).toBe(90); // 3² × 10 = 90
  });

  it("returns 0 for zero spells", () => {
    expect(calculateBradfordFactor(0, 10)).toBe(0);
  });

  it("returns 0 for zero days", () => {
    expect(calculateBradfordFactor(5, 0)).toBe(0);
  });

  it("returns correct value for single spell", () => {
    expect(calculateBradfordFactor(1, 5)).toBe(5); // 1² × 5 = 5
  });

  it("shows many short absences score higher than one long absence", () => {
    const manyShort = calculateBradfordFactor(6, 6); // 6² × 6 = 216
    const oneLong = calculateBradfordFactor(1, 6);    // 1² × 6 = 6
    expect(manyShort).toBeGreaterThan(oneLong);
  });
});

// =============================================
// getBradfordFactorSeverity
// =============================================

describe("getBradfordFactorSeverity", () => {
  it("returns low for score 0", () => {
    expect(getBradfordFactorSeverity(0).level).toBe("low");
  });

  it("returns low for score 50 (upper boundary)", () => {
    expect(getBradfordFactorSeverity(50).level).toBe("low");
  });

  it("returns medium for score 51", () => {
    expect(getBradfordFactorSeverity(51).level).toBe("medium");
  });

  it("returns medium for score 124 (upper boundary)", () => {
    expect(getBradfordFactorSeverity(124).level).toBe("medium");
  });

  it("returns high for score 125", () => {
    expect(getBradfordFactorSeverity(125).level).toBe("high");
  });

  it("returns high for score 399 (upper boundary)", () => {
    expect(getBradfordFactorSeverity(399).level).toBe("high");
  });

  it("returns critical for score 400", () => {
    expect(getBradfordFactorSeverity(400).level).toBe("critical");
  });

  it("returns critical for very high score", () => {
    expect(getBradfordFactorSeverity(1000).level).toBe("critical");
  });
});

// =============================================
// calculateTriggerPoint
// =============================================

describe("calculateTriggerPoint", () => {
  const makeRecord = (startDate: string, endDate: string, totalDays: number, absenceType = "sick_self_certified") => ({
    start_date: startDate,
    end_date: endDate,
    total_days: totalDays,
    absence_type: absenceType,
  });

  it("returns not reached for no absences", () => {
    const result = calculateTriggerPoint([], "2026-03-01");
    expect(result.reached).toBe(false);
    expect(result.spells).toBe(0);
    expect(result.days).toBe(0);
    expect(result.reason).toBeNull();
  });

  it("returns not reached for few absences below thresholds", () => {
    const records = [
      makeRecord("2025-10-01", "2025-10-02", 2),
      makeRecord("2026-01-15", "2026-01-16", 2),
    ];
    const result = calculateTriggerPoint(records, "2026-03-01");
    expect(result.reached).toBe(false);
    expect(result.spells).toBe(2);
    expect(result.days).toBe(4);
  });

  it("triggers on 4 separate spells", () => {
    const records = [
      makeRecord("2025-06-01", "2025-06-02", 2),
      makeRecord("2025-09-01", "2025-09-02", 2),
      makeRecord("2025-11-01", "2025-11-02", 2),
      makeRecord("2026-01-15", "2026-01-16", 2),
    ];
    const result = calculateTriggerPoint(records, "2026-03-01");
    expect(result.reached).toBe(true);
    expect(result.spells).toBe(4);
    expect(result.reason).toContain("4 separate absences");
  });

  it("triggers on 8+ working days", () => {
    const records = [
      makeRecord("2025-10-01", "2025-10-04", 4),
      makeRecord("2026-01-15", "2026-01-18", 4),
    ];
    const result = calculateTriggerPoint(records, "2026-03-01");
    expect(result.reached).toBe(true);
    expect(result.days).toBe(8);
    expect(result.reason).toContain("8 working days");
  });

  it("excludes records outside 12-month window", () => {
    const records = [
      makeRecord("2024-01-01", "2024-01-05", 5), // Old — should be excluded
      makeRecord("2026-01-15", "2026-01-16", 2),
    ];
    const result = calculateTriggerPoint(records, "2026-03-01");
    expect(result.reached).toBe(false);
    expect(result.spells).toBe(1);
    expect(result.days).toBe(2);
  });

  it("only counts sick absence types", () => {
    const records = [
      makeRecord("2025-10-01", "2025-10-05", 5, "unauthorised"),
      makeRecord("2025-11-01", "2025-11-05", 5, "other"),
      makeRecord("2025-12-01", "2025-12-05", 5, "sick_self_certified"),
      makeRecord("2026-01-10", "2026-01-14", 5, "sick_fit_note"),
    ];
    const result = calculateTriggerPoint(records, "2026-03-01");
    expect(result.spells).toBe(2); // Only the two sick ones
    expect(result.days).toBe(10);
  });

  it("counts sick_fit_note type", () => {
    const records = [
      makeRecord("2025-10-01", "2025-10-10", 8, "sick_fit_note"),
    ];
    const result = calculateTriggerPoint(records, "2026-03-01");
    expect(result.reached).toBe(true);
    expect(result.days).toBe(8);
  });

  it("prioritises spells trigger over days trigger", () => {
    // 4 spells with 4 total days — triggers on spells, not days
    const records = [
      makeRecord("2025-06-01", "2025-06-01", 1),
      makeRecord("2025-09-01", "2025-09-01", 1),
      makeRecord("2025-11-01", "2025-11-01", 1),
      makeRecord("2026-01-15", "2026-01-15", 1),
    ];
    const result = calculateTriggerPoint(records, "2026-03-01");
    expect(result.reached).toBe(true);
    expect(result.reason).toContain("separate absences");
  });
});

// =============================================
// getWellbeingPrompt
// =============================================

describe("getWellbeingPrompt", () => {
  it("returns null for 0 spells and 0 days", () => {
    expect(getWellbeingPrompt(0, 0)).toBeNull();
  });

  it("returns null for 1 spell and 1 day", () => {
    expect(getWellbeingPrompt(1, 1)).toBeNull();
  });

  it("returns null for 1 spell and 3 days", () => {
    expect(getWellbeingPrompt(1, 3)).toBeNull();
  });

  it("returns low severity for 1 spell and 4 days", () => {
    const result = getWellbeingPrompt(1, 4);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("low");
    expect(result!.prompt).toContain("4 days absent");
  });

  it("returns medium severity for 2 spells", () => {
    const result = getWellbeingPrompt(2, 4);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("medium");
    expect(result!.prompt).toContain("wellbeing check-in");
  });

  it("returns medium severity for 5+ days", () => {
    const result = getWellbeingPrompt(1, 5);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("medium");
  });

  it("returns high severity at trigger thresholds (4+ spells)", () => {
    const result = getWellbeingPrompt(4, 6);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("high");
    expect(result!.prompt).toContain("formal attendance review");
  });

  it("returns high severity at trigger thresholds (8+ days)", () => {
    const result = getWellbeingPrompt(2, 8);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("high");
  });

  it("handles singular/plural correctly for 1 absence", () => {
    const result = getWellbeingPrompt(1, 5);
    expect(result!.prompt).toContain("1 absence ");
    expect(result!.prompt).not.toContain("1 absences");
  });

  it("handles plural correctly for multiple absences", () => {
    const result = getWellbeingPrompt(3, 6);
    expect(result!.prompt).toContain("3 absences");
  });
});

// =============================================
// getLeaveYearForDate
// =============================================

describe("getLeaveYearForDate", () => {
  it("returns correct year boundaries for a mid-year date", () => {
    const result = getLeaveYearForDate(new Date("2026-06-15"));
    expect(result).toEqual({ start: "2026-01-01", end: "2026-12-31", year: 2026 });
  });

  it("returns correct boundaries for Jan 1", () => {
    const result = getLeaveYearForDate(new Date("2026-01-01"));
    expect(result).toEqual({ start: "2026-01-01", end: "2026-12-31", year: 2026 });
  });

  it("returns correct boundaries for Dec 31", () => {
    const result = getLeaveYearForDate(new Date("2026-12-31"));
    expect(result).toEqual({ start: "2026-01-01", end: "2026-12-31", year: 2026 });
  });
});

// =============================================
// formatFTE
// =============================================

describe("formatFTE", () => {
  it("returns 'Full-Time' for 1.0", () => {
    expect(formatFTE(1.0)).toBe("Full-Time");
  });

  it("returns 'Full-Time' for integer 1", () => {
    expect(formatFTE(1)).toBe("Full-Time");
  });

  it("returns FTE string for part-time", () => {
    expect(formatFTE(0.8)).toBe("0.8 FTE");
  });

  it("returns FTE string for 0.5", () => {
    expect(formatFTE(0.5)).toBe("0.5 FTE");
  });

  it("returns em-dash for null", () => {
    expect(formatFTE(null)).toBe("—");
  });
});

// =============================================
// formatLeaveDays
// =============================================

describe("formatLeaveDays", () => {
  it("returns singular for 1 day", () => {
    expect(formatLeaveDays(1)).toBe("1 day");
  });

  it("returns plural for 0 days", () => {
    expect(formatLeaveDays(0)).toBe("0 days");
  });

  it("returns plural for multiple days", () => {
    expect(formatLeaveDays(25)).toBe("25 days");
  });

  it("handles half-days", () => {
    expect(formatLeaveDays(12.5)).toBe("12.5 days");
  });
});

// =============================================
// formatHRDate
// =============================================

describe("formatHRDate", () => {
  it("formats a date string to UK format", () => {
    const result = formatHRDate("2026-02-03");
    expect(result).toBe("3 Feb 2026");
  });

  it("returns em-dash for null", () => {
    expect(formatHRDate(null)).toBe("—");
  });

  it("returns em-dash for empty string", () => {
    expect(formatHRDate("")).toBe("—");
  });
});

// =============================================
// formatHRDateLong
// =============================================

describe("formatHRDateLong", () => {
  it("formats a date with day of week", () => {
    const result = formatHRDateLong("2026-02-03");
    // 3 Feb 2026 is a Tuesday
    expect(result).toBe("Tue, 3 Feb 2026");
  });

  it("returns em-dash for null", () => {
    expect(formatHRDateLong(null)).toBe("—");
  });
});

// =============================================
// calculateLengthOfService
// =============================================

describe("calculateLengthOfService", () => {
  it("returns years and months", () => {
    expect(calculateLengthOfService("2024-01-01", "2026-03-01")).toBe("2 years, 2 months");
  });

  it("returns year singular", () => {
    expect(calculateLengthOfService("2025-01-01", "2026-01-01")).toBe("1 year");
  });

  it("returns months only for less than a year", () => {
    expect(calculateLengthOfService("2026-01-01", "2026-04-01")).toBe("3 months");
  });

  it("returns month singular", () => {
    expect(calculateLengthOfService("2026-01-01", "2026-02-01")).toBe("1 month");
  });

  it("returns 'Less than a month' for very short service", () => {
    expect(calculateLengthOfService("2026-03-01", "2026-03-15")).toBe("Less than a month");
  });

  it("handles year rollover in month calculation", () => {
    // Nov 2025 to Feb 2026 = 3 months
    expect(calculateLengthOfService("2025-11-01", "2026-02-01")).toBe("3 months");
  });
});

// =============================================
// validateHRDocument
// =============================================

describe("validateHRDocument", () => {
  it("returns null for a valid PDF under size limit", () => {
    expect(validateHRDocument({ size: 1024, type: "application/pdf" })).toBeNull();
  });

  it("returns null for a valid JPEG", () => {
    expect(validateHRDocument({ size: 1024, type: "image/jpeg" })).toBeNull();
  });

  it("returns null for a valid PNG", () => {
    expect(validateHRDocument({ size: 1024, type: "image/png" })).toBeNull();
  });

  it("returns null for a valid DOCX", () => {
    expect(validateHRDocument({
      size: 1024,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })).toBeNull();
  });

  it("returns error for file exceeding size limit", () => {
    const result = validateHRDocument({ size: HR_DOCUMENT_MAX_SIZE_BYTES + 1, type: "application/pdf" });
    expect(result).toContain("too large");
    expect(result).toContain("10MB");
  });

  it("returns error for unsupported file type", () => {
    const result = validateHRDocument({ size: 1024, type: "text/plain" });
    expect(result).toContain("Unsupported file type");
  });

  it("returns error for executable file", () => {
    const result = validateHRDocument({ size: 1024, type: "application/x-executable" });
    expect(result).toContain("Unsupported file type");
  });
});

// =============================================
// getHolidayCalendar
// =============================================

describe("getHolidayCalendar", () => {
  it("returns 'england' for england region", () => {
    expect(getHolidayCalendar("england")).toBe("england");
  });

  it("returns 'scotland' for west region", () => {
    expect(getHolidayCalendar("west")).toBe("scotland");
  });

  it("returns 'scotland' for east region", () => {
    expect(getHolidayCalendar("east")).toBe("scotland");
  });

  it("returns 'scotland' for north region", () => {
    expect(getHolidayCalendar("north")).toBe("scotland");
  });

  it("returns 'scotland' for central region", () => {
    expect(getHolidayCalendar("central")).toBe("scotland");
  });

  it("returns 'scotland' for national region", () => {
    expect(getHolidayCalendar("national")).toBe("scotland");
  });

  it("returns 'scotland' for null region", () => {
    expect(getHolidayCalendar(null)).toBe("scotland");
  });
});

// =============================================
// mapToLeaveRequestWithEmployee
// =============================================

describe("mapToLeaveRequestWithEmployee", () => {
  it("maps profile join data correctly", () => {
    const data = [
      {
        id: "req-1",
        profile_id: "user-1",
        leave_type: "annual",
        status: "pending",
        start_date: "2026-03-01",
        end_date: "2026-03-05",
        profiles: {
          full_name: "Alice Smith",
          avatar_url: "https://example.com/alice.jpg",
          job_title: "Coordinator",
        },
      },
    ];

    const result = mapToLeaveRequestWithEmployee(data);
    expect(result).toHaveLength(1);
    expect(result[0].employee_name).toBe("Alice Smith");
    expect(result[0].employee_avatar).toBe("https://example.com/alice.jpg");
    expect(result[0].employee_job_title).toBe("Coordinator");
  });

  it("falls back to 'Unknown' when profile is null", () => {
    const data = [
      {
        id: "req-2",
        profile_id: "user-2",
        leave_type: "sick",
        status: "approved",
        profiles: null,
      },
    ];

    const result = mapToLeaveRequestWithEmployee(data);
    expect(result[0].employee_name).toBe("Unknown");
    expect(result[0].employee_avatar).toBeNull();
    expect(result[0].employee_job_title).toBeNull();
  });

  it("handles empty array", () => {
    expect(mapToLeaveRequestWithEmployee([])).toEqual([]);
  });

  it("preserves leave_type and status as typed values", () => {
    const data = [
      {
        id: "req-3",
        profile_id: "user-3",
        leave_type: "compassionate",
        status: "rejected",
        profiles: { full_name: "Bob", avatar_url: null, job_title: null },
      },
    ];

    const result = mapToLeaveRequestWithEmployee(data);
    expect(result[0].leave_type).toBe("compassionate");
    expect(result[0].status).toBe("rejected");
  });
});
