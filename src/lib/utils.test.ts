import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cn, timeAgo, formatDate, formatShortDate, formatFileSize, formatDuration, getInitials, getAvatarColour, filterAvatarUrl } from "@/lib/utils";

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

describe("formatDate", () => {
  it('formats a date as "3 Feb 2026" style', () => {
    const date = new Date("2026-02-03T00:00:00");
    expect(formatDate(date)).toBe("3 Feb 2026");
  });

  it("handles dates in different months", () => {
    const date = new Date("2025-12-25T00:00:00");
    expect(formatDate(date)).toBe("25 Dec 2025");
  });
});

describe("formatShortDate", () => {
  it('formats a date as "3 Feb" style (no year)', () => {
    const date = new Date("2026-02-03T00:00:00");
    expect(formatShortDate(date)).toBe("3 Feb");
  });

  it("handles single-digit days", () => {
    const date = new Date("2026-01-05T00:00:00");
    expect(formatShortDate(date)).toBe("5 Jan");
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

describe("getInitials", () => {
  it("extracts initials from two-word name", () => {
    expect(getInitials("John Smith")).toBe("JS");
  });

  it("extracts initials from single-word name", () => {
    expect(getInitials("Madonna")).toBe("M");
  });

  it("limits to 2 characters", () => {
    expect(getInitials("John Paul Smith")).toBe("JP");
  });

  it('returns "?" for empty string', () => {
    expect(getInitials("")).toBe("?");
  });

  it('returns "?" for whitespace-only string', () => {
    expect(getInitials("   ")).toBe("?");
  });
});

describe("formatDuration", () => {
  describe("short style (default)", () => {
    it('returns "Self-paced" for null', () => {
      expect(formatDuration(null)).toBe("Self-paced");
    });

    it('returns "0 min" for 0 (only null means self-paced)', () => {
      expect(formatDuration(0)).toBe("0 min");
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

describe("getAvatarColour", () => {
  it("returns a valid colour object with bg and fg", () => {
    const result = getAvatarColour("Alice Smith");
    expect(result).toHaveProperty("bg");
    expect(result).toHaveProperty("fg");
    expect(typeof result.bg).toBe("string");
    expect(typeof result.fg).toBe("string");
  });

  it("is deterministic — same name always returns same colour", () => {
    const first = getAvatarColour("John Doe");
    const second = getAvatarColour("John Doe");
    expect(first).toEqual(second);
  });

  it("returns Navy (default) for empty input", () => {
    const result = getAvatarColour("");
    expect(result.bg).toBe("bg-primary");
    expect(result.fg).toBe("text-primary-foreground");
  });

  it("returns Navy (default) for whitespace-only input", () => {
    const result = getAvatarColour("   ");
    expect(result.bg).toBe("bg-primary");
    expect(result.fg).toBe("text-primary-foreground");
  });

  it("distributes across all 3 colours", () => {
    // Test a range of names to verify all 3 colours appear
    const names = [
      "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank",
      "Grace", "Hank", "Ivy", "Jack", "Kate", "Leo",
    ];
    const uniqueColours = new Set(names.map((n) => getAvatarColour(n).bg));
    expect(uniqueColours.size).toBe(3);
  });

  it("different names can produce different colours", () => {
    // With 12 names, statistically impossible for all to hash to the same bucket
    const names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank"];
    const colours = names.map((n) => getAvatarColour(n).bg);
    const unique = new Set(colours);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe("filterAvatarUrl", () => {
  it("returns undefined for null", () => {
    expect(filterAvatarUrl(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(filterAvatarUrl(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(filterAvatarUrl("")).toBeUndefined();
  });

  it("filters Google default avatar URLs", () => {
    expect(
      filterAvatarUrl(
        "https://lh3.googleusercontent.com/a/ACg8ocLHbOUXzpAUaqmpX9IHa0bVRvojKC60pwa-8eWVWXnu52ffNQ=s96-c"
      )
    ).toBeUndefined();
  });

  it("filters any googleusercontent.com URL", () => {
    expect(
      filterAvatarUrl("https://lh3.googleusercontent.com/a/default-user=s96-c")
    ).toBeUndefined();
  });

  it("passes through non-Google URLs", () => {
    const url = "https://example.com/avatar.jpg";
    expect(filterAvatarUrl(url)).toBe(url);
  });

  it("passes through relative URLs (future upload feature)", () => {
    const url = "/uploads/avatars/abc123.jpg";
    expect(filterAvatarUrl(url)).toBe(url);
  });
});
