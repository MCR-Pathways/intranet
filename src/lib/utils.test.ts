import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cn, timeAgo, formatFileSize, formatDuration } from "@/lib/utils";

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles undefined and null inputs", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for dates less than 60 seconds ago', () => {
    const date = new Date("2025-06-15T11:59:30Z").toISOString();
    expect(timeAgo(date)).toBe("just now");
  });

  it('returns "Xm ago" for dates minutes ago', () => {
    const date = new Date("2025-06-15T11:55:00Z").toISOString();
    expect(timeAgo(date)).toBe("5m ago");
  });

  it('returns "Xh ago" for dates hours ago', () => {
    const date = new Date("2025-06-15T09:00:00Z").toISOString();
    expect(timeAgo(date)).toBe("3h ago");
  });

  it('returns "Xd ago" for dates days ago', () => {
    const date = new Date("2025-06-13T12:00:00Z").toISOString();
    expect(timeAgo(date)).toBe("2d ago");
  });

  it('returns "Xw ago" for dates weeks ago', () => {
    const date = new Date("2025-06-01T12:00:00Z").toISOString();
    expect(timeAgo(date)).toBe("2w ago");
  });

  it("returns a formatted date for dates older than 4 weeks", () => {
    const date = new Date("2025-04-10T12:00:00Z").toISOString();
    const result = timeAgo(date);
    // Should contain day and month at minimum
    expect(result).toMatch(/10/);
    expect(result).toMatch(/Apr/);
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(5242880)).toBe("5.0 MB");
  });

  it("formats values just under 1 KB", () => {
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats values just at 1 KB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });
});

describe("formatDuration", () => {
  describe("short style (default)", () => {
    it('returns "Self-paced" for null', () => {
      expect(formatDuration(null)).toBe("Self-paced");
    });

    it('returns "Self-paced" for 0', () => {
      expect(formatDuration(0)).toBe("Self-paced");
    });

    it("formats minutes under 60", () => {
      expect(formatDuration(45)).toBe("45 min");
    });

    it("formats exact hours", () => {
      expect(formatDuration(120)).toBe("2h");
    });

    it("formats hours and minutes", () => {
      expect(formatDuration(150)).toBe("2h 30m");
    });
  });

  describe("long style", () => {
    it('returns "Self-paced" for null', () => {
      expect(formatDuration(null, "long")).toBe("Self-paced");
    });

    it("formats minutes under 60", () => {
      expect(formatDuration(45, "long")).toBe("45 minutes");
    });

    it("formats 1 hour (singular)", () => {
      expect(formatDuration(60, "long")).toBe("1 hour");
    });

    it("formats multiple hours (plural)", () => {
      expect(formatDuration(120, "long")).toBe("2 hours");
    });

    it("formats hours and minutes", () => {
      expect(formatDuration(150, "long")).toBe("2 hours 30 minutes");
    });

    it("formats 1 hour with minutes", () => {
      expect(formatDuration(75, "long")).toBe("1 hour 15 minutes");
    });
  });
});
