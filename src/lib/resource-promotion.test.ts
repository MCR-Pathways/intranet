import { describe, it, expect } from "vitest";
import { promotionTargetSlug } from "./resource-promotion";

const article = (slug: string) => ({ slug });
const group = () => ({});

describe("promotionTargetSlug", () => {
  it("promotes a folder with exactly one article and no subfolders", () => {
    expect(promotionTargetSlug([article("annual-leave")], [])).toBe("annual-leave");
  });

  it("does not promote when a subfolder is present", () => {
    expect(promotionTargetSlug([article("annual-leave")], [group()])).toBeNull();
  });

  it("does not promote an empty folder", () => {
    expect(promotionTargetSlug([], [])).toBeNull();
  });

  it("does not promote a folder with two or more articles", () => {
    expect(promotionTargetSlug([article("a"), article("b")], [])).toBeNull();
  });
});
