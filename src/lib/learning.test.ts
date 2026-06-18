import { describe, it, expect } from "vitest";
import { getLockedLessonIds, getDueStatus } from "@/lib/learning";

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

describe("getDueStatus", () => {
  const now = Date.parse("2026-06-18T12:00:00Z");
  const hoursFromNow = (h: number) => new Date(now + h * 60 * 60 * 1000);

  it("classifies a course overdue by under a day as overdue, not due_soon", () => {
    // Regression: Math.ceil of a small negative is -0, and -0 < 0 is false, so
    // the old `daysUntilDue < 0` check let a just-overdue course slip into due_soon.
    expect(getDueStatus(hoursFromNow(-1), now).status).toBe("overdue");
    expect(getDueStatus(hoursFromNow(-23), now).status).toBe("overdue");
  });

  it("classifies a course overdue by more than a day as overdue", () => {
    expect(getDueStatus(hoursFromNow(-25), now).status).toBe("overdue");
    expect(getDueStatus(hoursFromNow(-240), now).status).toBe("overdue");
  });

  it("classifies a course due within 7 days as due_soon", () => {
    expect(getDueStatus(hoursFromNow(24), now).status).toBe("due_soon");
    expect(getDueStatus(hoursFromNow(7 * 24), now).status).toBe("due_soon");
  });

  it("treats the due moment itself as due_soon, not overdue", () => {
    expect(getDueStatus(hoursFromNow(0), now).status).toBe("due_soon");
  });

  it("returns null status when more than 7 days out", () => {
    expect(getDueStatus(hoursFromNow(8 * 24), now).status).toBeNull();
    expect(getDueStatus(hoursFromNow(30 * 24), now).status).toBeNull();
  });

  it("reports daysUntilDue as a ceil'd whole-day count for display", () => {
    expect(getDueStatus(hoursFromNow(72), now).daysUntilDue).toBe(3);
    expect(getDueStatus(hoursFromNow(49), now).daysUntilDue).toBe(3);
  });
});
