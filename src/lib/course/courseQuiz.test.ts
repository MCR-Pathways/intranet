import { describe, it, expect } from "vitest";
import { scoreSingle, scoreMulti, scoreOrdering } from "@/lib/course/courseQuiz";

describe("scoreSingle", () => {
  it("returns true when the chosen option matches", () => {
    expect(scoreSingle("a", "a")).toBe(true);
  });

  it("returns false when the chosen option differs", () => {
    expect(scoreSingle("b", "a")).toBe(false);
  });

  it("returns false when nothing is chosen", () => {
    expect(scoreSingle(null, "a")).toBe(false);
  });
});

describe("scoreMulti", () => {
  it("returns true when the chosen set equals the correct set regardless of order", () => {
    expect(scoreMulti(["b", "a"], ["a", "b"])).toBe(true);
  });

  it("returns false when an answer is missing", () => {
    expect(scoreMulti(["a"], ["a", "b"])).toBe(false);
  });

  it("returns false when an extra answer is chosen", () => {
    expect(scoreMulti(["a", "b", "c"], ["a", "b"])).toBe(false);
  });

  it("returns false when a chosen value is wrong despite matching length", () => {
    expect(scoreMulti(["a", "c"], ["a", "b"])).toBe(false);
  });

  it("returns false when the chosen set contains duplicates that mask a missing answer", () => {
    expect(scoreMulti(["a", "a"], ["a", "b"])).toBe(false);
  });

  it("returns true for two empty sets", () => {
    expect(scoreMulti([], [])).toBe(true);
  });
});

describe("scoreOrdering", () => {
  it("returns true when the sequence matches exactly", () => {
    expect(scoreOrdering(["1", "2", "3"], ["1", "2", "3"])).toBe(true);
  });

  it("returns false when the same items are in the wrong order", () => {
    expect(scoreOrdering(["1", "3", "2"], ["1", "2", "3"])).toBe(false);
  });

  it("returns false when the lengths differ", () => {
    expect(scoreOrdering(["1", "2"], ["1", "2", "3"])).toBe(false);
  });

  it("returns true for two empty sequences", () => {
    expect(scoreOrdering([], [])).toBe(true);
  });
});
