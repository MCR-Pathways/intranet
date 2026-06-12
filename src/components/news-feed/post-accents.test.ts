import { describe, it, expect } from "vitest";
import { postSpineClass } from "./post-accents";

const ORANGE = "border-l-4 border-l-mcr-orange";
const BLUE = "border-l-4 border-l-mcr-light-blue";

describe("postSpineClass (design-system §8.3 collision rules)", () => {
  it("a plain post has no spine", () => {
    expect(postSpineClass({ isPinned: false, isKudos: false, isPoll: false })).toBeNull();
  });

  it("an unpinned poll takes the sky-blue spine", () => {
    expect(postSpineClass({ isPinned: false, isKudos: false, isPoll: true })).toBe(BLUE);
  });

  it("a pinned ordinary post takes the orange spine", () => {
    expect(postSpineClass({ isPinned: true, isKudos: false, isPoll: false })).toBe(ORANGE);
  });

  it("pin wins: a pinned poll takes orange, not sky-blue", () => {
    expect(postSpineClass({ isPinned: true, isKudos: false, isPoll: true })).toBe(ORANGE);
  });

  it("kudos keeps its top strip and takes no spine, even when pinned", () => {
    expect(postSpineClass({ isPinned: true, isKudos: true, isPoll: false })).toBeNull();
  });

  it("an unpinned kudos has no spine", () => {
    expect(postSpineClass({ isPinned: false, isKudos: true, isPoll: false })).toBeNull();
  });

  it("never gives a spine to a kudos, even if it also carries a poll", () => {
    // Kudos and poll are different post types and shouldn't co-occur, but the
    // rule (kudos takes no spine) must hold regardless of the other flags.
    expect(postSpineClass({ isPinned: false, isKudos: true, isPoll: true })).toBeNull();
    expect(postSpineClass({ isPinned: true, isKudos: true, isPoll: true })).toBeNull();
  });
});
