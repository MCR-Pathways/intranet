import { describe, it, expect } from "vitest";
import {
  formatSignInTime,
  formatSignInDate,
  getLocationLabel,
} from "@/lib/sign-in";

// =============================================
// formatSignInTime
// =============================================

describe("formatSignInTime", () => {
  it("formats a morning ISO timestamp to HH:MM", () => {
    // Use a full ISO string
    const result = formatSignInTime("2026-03-02T09:30:00.000Z");
    // The exact output depends on locale/timezone, but should contain digits and colon
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("formats an afternoon timestamp", () => {
    const result = formatSignInTime("2026-03-02T14:15:00.000Z");
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

// =============================================
// formatSignInDate
// =============================================

describe("formatSignInDate", () => {
  it("formats a date string to short UK format", () => {
    // 2026-03-02 is a Monday
    const result = formatSignInDate("2026-03-02");
    // jsdom en-GB locale may omit comma: "Mon 2 Mar" or "Mon, 2 Mar"
    expect(result).toMatch(/^Mon,?\s+2 Mar$/);
  });

  it("formats a different date", () => {
    // 2026-02-15 is a Sunday
    const result = formatSignInDate("2026-02-15");
    expect(result).toMatch(/^Sun,?\s+15 Feb$/);
  });

  it("formats single-digit day correctly", () => {
    // 2026-01-05 is a Monday
    const result = formatSignInDate("2026-01-05");
    expect(result).toMatch(/^Mon,?\s+5 Jan$/);
  });
});

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
});
