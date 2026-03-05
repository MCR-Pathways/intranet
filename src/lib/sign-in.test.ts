import { describe, it, expect } from "vitest";
import {
  getLocationLabel,
  formatScheduleDate,
  formatDayName,
  formatDayMonth,
  getWeekDates,
  buildDaySchedule,
  isToday,
  isPastDate,
  LOCATION_CONFIG,
  NOT_SET_CONFIG,
  LOCATIONS,
} from "@/lib/sign-in";
import type { WorkingLocationEntry } from "@/lib/sign-in";

// =============================================
// getLocationLabel
// =============================================

describe("getLocationLabel", () => {
  it("returns 'Home' for home location", () => {
    expect(getLocationLabel("home", null)).toBe("Home");
  });

  it("returns 'Glasgow Office' for glasgow_office", () => {
    expect(getLocationLabel("glasgow_office", null)).toBe("Glasgow Office");
  });

  it("returns 'Stevenage Office' for stevenage_office", () => {
    expect(getLocationLabel("stevenage_office", null)).toBe("Stevenage Office");
  });

  it("returns custom text for 'other' with otherLocation", () => {
    expect(getLocationLabel("other", "Client site in Edinburgh")).toBe("Client site in Edinburgh");
  });

  it("returns 'Other' for 'other' without otherLocation", () => {
    expect(getLocationLabel("other", null)).toBe("Other");
  });

  it("returns 'Other' for unknown location", () => {
    expect(getLocationLabel("unknown_place", null)).toBe("Other");
  });

  it("returns 'On Leave' for on_leave location", () => {
    expect(getLocationLabel("on_leave", null)).toBe("On Leave");
  });
});

// =============================================
// formatScheduleDate
// =============================================

describe("formatScheduleDate", () => {
  it("formats a date string to short UK format", () => {
    // 2026-03-02 is a Monday
    const result = formatScheduleDate("2026-03-02");
    // jsdom en-GB locale may omit comma: "Mon 2 Mar" or "Mon, 2 Mar"
    expect(result).toMatch(/^Mon,?\s+2 Mar$/);
  });

  it("formats a different date", () => {
    const result = formatScheduleDate("2026-02-15");
    expect(result).toMatch(/^Sun,?\s+15 Feb$/);
  });
});

// =============================================
// formatDayName
// =============================================

describe("formatDayName", () => {
  it("returns short day name", () => {
    expect(formatDayName("2026-03-02")).toBe("Mon");
  });

  it("returns Fri for Friday", () => {
    expect(formatDayName("2026-03-06")).toBe("Fri");
  });
});

// =============================================
// formatDayMonth
// =============================================

describe("formatDayMonth", () => {
  it("returns day and month", () => {
    const result = formatDayMonth("2026-03-02");
    expect(result).toMatch(/2 Mar/);
  });
});

// =============================================
// getWeekDates
// =============================================

describe("getWeekDates", () => {
  it("returns 5 dates (Mon-Fri)", () => {
    const dates = getWeekDates(0);
    expect(dates).toHaveLength(5);
  });

  it("returns dates in ascending order", () => {
    const dates = getWeekDates(0);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });

  it("first date is a Monday", () => {
    const dates = getWeekDates(0);
    const monday = new Date(dates[0] + "T12:00:00");
    expect(monday.getDay()).toBe(1); // Monday
  });

  it("last date is a Friday", () => {
    const dates = getWeekDates(0);
    const friday = new Date(dates[4] + "T12:00:00");
    expect(friday.getDay()).toBe(5); // Friday
  });
});

// =============================================
// buildDaySchedule
// =============================================

describe("buildDaySchedule", () => {
  const makeEntry = (overrides: Partial<WorkingLocationEntry> = {}): WorkingLocationEntry => ({
    id: "1",
    user_id: "user-1",
    date: "2026-03-02",
    time_slot: "full_day",
    location: "home",
    other_location: null,
    source: "manual",
    confirmed: false,
    confirmed_at: null,
    leave_request_id: null,
    ...overrides,
  });

  it("builds schedule with full_day entry", () => {
    const entries = [makeEntry({ time_slot: "full_day", location: "home" })];
    const schedule = buildDaySchedule("2026-03-02", entries);

    expect(schedule.date).toBe("2026-03-02");
    expect(schedule.fullDay?.location).toBe("home");
    expect(schedule.morning).toBeNull();
    expect(schedule.afternoon).toBeNull();
  });

  it("builds schedule with split-day entries", () => {
    const entries = [
      makeEntry({ id: "1", time_slot: "morning", location: "home" }),
      makeEntry({ id: "2", time_slot: "afternoon", location: "glasgow_office" }),
    ];
    const schedule = buildDaySchedule("2026-03-02", entries);

    expect(schedule.fullDay).toBeNull();
    expect(schedule.morning?.location).toBe("home");
    expect(schedule.afternoon?.location).toBe("glasgow_office");
  });

  it("returns empty schedule for date with no entries", () => {
    const schedule = buildDaySchedule("2026-03-02", []);
    expect(schedule.fullDay).toBeNull();
    expect(schedule.morning).toBeNull();
    expect(schedule.afternoon).toBeNull();
  });

  it("filters entries to the correct date", () => {
    const entries = [
      makeEntry({ date: "2026-03-02", location: "home" }),
      makeEntry({ id: "2", date: "2026-03-03", location: "glasgow_office" }),
    ];
    const schedule = buildDaySchedule("2026-03-02", entries);
    expect(schedule.fullDay?.location).toBe("home");
  });
});

// =============================================
// Config validation
// =============================================

describe("LOCATION_CONFIG", () => {
  it("has config for all standard locations", () => {
    expect(LOCATION_CONFIG.home).toBeDefined();
    expect(LOCATION_CONFIG.glasgow_office).toBeDefined();
    expect(LOCATION_CONFIG.stevenage_office).toBeDefined();
    expect(LOCATION_CONFIG.other).toBeDefined();
    expect(LOCATION_CONFIG.on_leave).toBeDefined();
  });

  it("each config has required fields", () => {
    for (const [, config] of Object.entries(LOCATION_CONFIG)) {
      expect(config.label).toBeTruthy();
      expect(config.shortLabel).toBeTruthy();
      expect(config.icon).toBeDefined();
      expect(config.bgClass).toBeTruthy();
      expect(config.textClass).toBeTruthy();
      expect(config.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("NOT_SET_CONFIG", () => {
  it("has required fields", () => {
    expect(NOT_SET_CONFIG.label).toBe("Not set");
    expect(NOT_SET_CONFIG.icon).toBeDefined();
    expect(NOT_SET_CONFIG.bgClass).toBeTruthy();
  });
});

describe("LOCATIONS", () => {
  it("has 4 selectable locations (excludes on_leave)", () => {
    expect(LOCATIONS).toHaveLength(4);
    expect(LOCATIONS.map((l) => l.id)).not.toContain("on_leave");
  });
});

// =============================================
// Date comparison helpers
// =============================================

describe("isToday / isPastDate", () => {
  it("isToday returns a boolean", () => {
    expect(typeof isToday("2026-03-05")).toBe("boolean");
  });

  it("isPastDate returns true for old dates", () => {
    expect(isPastDate("2020-01-01")).toBe(true);
  });

  it("isPastDate returns false for far future dates", () => {
    expect(isPastDate("2099-12-31")).toBe(false);
  });
});
