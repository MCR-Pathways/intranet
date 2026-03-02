import { describe, it, expect } from "vitest";
import { getLockedLessonIds } from "@/lib/learning";

describe("getLockedLessonIds", () => {
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

  it("returns empty set when all quizzes are completed", () => {
    const lessons = [
      { id: "l1", lesson_type: "video" },
      { id: "q1", lesson_type: "quiz" },
      { id: "l2", lesson_type: "video" },
    ];
    expect(getLockedLessonIds(lessons, ["q1"])).toEqual(new Set());
  });

  it("locks lessons after an uncompleted quiz", () => {
    const lessons = [
      { id: "l1", lesson_type: "video" },
      { id: "q1", lesson_type: "quiz" },
      { id: "l2", lesson_type: "video" },
      { id: "l3", lesson_type: "text" },
    ];
    const result = getLockedLessonIds(lessons, []);
    expect(result).toEqual(new Set(["l2", "l3"]));
  });

  it("does not lock the quiz itself", () => {
    const lessons = [
      { id: "l1", lesson_type: "video" },
      { id: "q1", lesson_type: "quiz" },
      { id: "l2", lesson_type: "video" },
    ];
    const result = getLockedLessonIds(lessons, []);
    expect(result.has("q1")).toBe(false);
    expect(result.has("l2")).toBe(true);
  });

  it("does not lock lessons before the uncompleted quiz", () => {
    const lessons = [
      { id: "l1", lesson_type: "video" },
      { id: "l2", lesson_type: "text" },
      { id: "q1", lesson_type: "quiz" },
      { id: "l3", lesson_type: "video" },
    ];
    const result = getLockedLessonIds(lessons, []);
    expect(result.has("l1")).toBe(false);
    expect(result.has("l2")).toBe(false);
    expect(result.has("l3")).toBe(true);
  });

  it("handles multiple quizzes — stops at first uncompleted", () => {
    const lessons = [
      { id: "l1", lesson_type: "video" },
      { id: "q1", lesson_type: "quiz" },
      { id: "l2", lesson_type: "video" },
      { id: "q2", lesson_type: "quiz" },
      { id: "l3", lesson_type: "video" },
    ];
    // q1 completed, q2 not completed
    const result = getLockedLessonIds(lessons, ["q1"]);
    // l2 is after q1 (completed) so not locked
    // q2 is the blocker, so l3 is locked
    expect(result.has("l2")).toBe(false);
    expect(result.has("q2")).toBe(false);
    expect(result.has("l3")).toBe(true);
  });

  it("handles null lesson_type gracefully", () => {
    const lessons = [
      { id: "l1", lesson_type: null },
      { id: "q1", lesson_type: "quiz" },
      { id: "l2", lesson_type: null },
    ];
    const result = getLockedLessonIds(lessons, []);
    expect(result.has("l1")).toBe(false);
    expect(result.has("l2")).toBe(true);
  });
});
