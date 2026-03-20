import { describe, it, expect } from "vitest";
import { getLockedLessonIds, getLockedSectionIds, calculateSectionProgress } from "@/lib/learning";

describe("getLockedLessonIds (legacy)", () => {
  it("returns empty set when no lessons", () => {
    expect(getLockedLessonIds([], [])).toEqual(new Set());
  });

  it("returns empty set when no quizzes exist", () => {
    const lessons = [
      { id: "l1", lesson_type: "video" },
      { id: "l2", lesson_type: "text" },
      { id: "l3", lesson_type: "video" },
    ];
    expect(getLockedLessonIds(lessons, [])).toEqual(new Set());
  });

  it("handles null lesson_type gracefully", () => {
    const lessons = [
      { id: "l1", lesson_type: null },
      { id: "l2", lesson_type: "video" },
    ];
    const result = getLockedLessonIds(lessons, []);
    expect(result.has("l1")).toBe(false);
    expect(result.has("l2")).toBe(false);
  });
});

describe("getLockedSectionIds", () => {
  it("returns empty set when no sections", () => {
    expect(getLockedSectionIds([], new Set(), new Set())).toEqual(new Set());
  });

  it("returns empty set when no sections have quizzes", () => {
    const sections = [
      { id: "s1", sort_order: 0 },
      { id: "s2", sort_order: 1 },
    ];
    expect(getLockedSectionIds(sections, new Set(), new Set())).toEqual(new Set());
  });

  it("returns empty set when all quizzes are passed", () => {
    const sections = [
      { id: "s1", sort_order: 0 },
      { id: "s2", sort_order: 1 },
    ];
    const passed = new Set(["s1"]);
    const withQuizzes = new Set(["s1"]);
    expect(getLockedSectionIds(sections, passed, withQuizzes)).toEqual(new Set());
  });

  it("locks sections after an unpassed section quiz", () => {
    const sections = [
      { id: "s1", sort_order: 0 },
      { id: "s2", sort_order: 1 },
      { id: "s3", sort_order: 2 },
    ];
    const passed = new Set<string>();
    const withQuizzes = new Set(["s1"]);
    const result = getLockedSectionIds(sections, passed, withQuizzes);
    expect(result.has("s1")).toBe(false);
    expect(result.has("s2")).toBe(true);
    expect(result.has("s3")).toBe(true);
  });

  it("does not lock the section with the unpassed quiz itself", () => {
    const sections = [
      { id: "s1", sort_order: 0 },
      { id: "s2", sort_order: 1 },
    ];
    const passed = new Set<string>();
    const withQuizzes = new Set(["s1"]);
    const result = getLockedSectionIds(sections, passed, withQuizzes);
    expect(result.has("s1")).toBe(false);
    expect(result.has("s2")).toBe(true);
  });

  it("stops at first unpassed quiz section", () => {
    const sections = [
      { id: "s1", sort_order: 0 },
      { id: "s2", sort_order: 1 },
      { id: "s3", sort_order: 2 },
    ];
    const passed = new Set(["s1"]);
    const withQuizzes = new Set(["s1", "s2"]);
    const result = getLockedSectionIds(sections, passed, withQuizzes);
    expect(result.has("s1")).toBe(false);
    expect(result.has("s2")).toBe(false);
    expect(result.has("s3")).toBe(true);
  });
});

describe("calculateSectionProgress", () => {
  it("returns 0 when nothing is complete", () => {
    expect(calculateSectionProgress(0, 3, false, true)).toBe(0);
  });

  it("returns 100 when everything is complete", () => {
    expect(calculateSectionProgress(3, 3, true, true)).toBe(100);
  });

  it("calculates correctly without a quiz", () => {
    expect(calculateSectionProgress(2, 4, false, false)).toBe(50);
  });

  it("includes quiz in total items", () => {
    // 2 lessons + 1 quiz = 3 items, 1 lesson complete = 33%
    expect(calculateSectionProgress(1, 2, false, true)).toBe(33);
  });

  it("returns 0 when no lessons and no quiz", () => {
    expect(calculateSectionProgress(0, 0, false, false)).toBe(0);
  });
});
