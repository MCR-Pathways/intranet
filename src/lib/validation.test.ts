import { describe, it, expect } from "vitest";
import { isValidHexColour, isValidUUID } from "./validation";

describe("isValidHexColour", () => {
  it("accepts valid 6-digit hex", () => {
    expect(isValidHexColour("#DC2626")).toBe(true);
    expect(isValidHexColour("#000000")).toBe(true);
    expect(isValidHexColour("#FFFFFF")).toBe(true);
    expect(isValidHexColour("#FEF08A")).toBe(true);
  });

  it("accepts valid 3-digit hex", () => {
    expect(isValidHexColour("#FFF")).toBe(true);
    expect(isValidHexColour("#000")).toBe(true);
    expect(isValidHexColour("#ABC")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isValidHexColour("#dc2626")).toBe(true);
    expect(isValidHexColour("#Dc2626")).toBe(true);
    expect(isValidHexColour("#fff")).toBe(true);
  });

  it("rejects missing hash", () => {
    expect(isValidHexColour("DC2626")).toBe(false);
    expect(isValidHexColour("FFF")).toBe(false);
  });

  it("rejects named CSS colours", () => {
    expect(isValidHexColour("red")).toBe(false);
    expect(isValidHexColour("transparent")).toBe(false);
  });

  it("rejects rgb/rgba functions", () => {
    expect(isValidHexColour("rgb(255,0,0)")).toBe(false);
    expect(isValidHexColour("rgba(255,0,0,0.5)")).toBe(false);
  });

  it("rejects CSS injection attempts", () => {
    expect(
      isValidHexColour("red; background-image: url(https://evil.com)")
    ).toBe(false);
    expect(isValidHexColour("#DC2626; content: ''")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidHexColour("")).toBe(false);
  });

  it("rejects invalid-length hex", () => {
    expect(isValidHexColour("#FFFF")).toBe(false); // 4 digits
    expect(isValidHexColour("#DC262600")).toBe(false); // 8 digits (alpha)
    expect(isValidHexColour("#FF")).toBe(false); // 2 digits
  });
});

describe("isValidUUID", () => {
  it("accepts valid UUID v4", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
    expect(isValidUUID("user-123")).toBe(false);
    expect(isValidUUID("")).toBe(false);
  });

  it("rejects truncated UUIDs", () => {
    expect(isValidUUID("550e8400-e29b")).toBe(false);
  });

  it("rejects path traversal segments", () => {
    expect(isValidUUID("../admin")).toBe(false);
    expect(isValidUUID("..")).toBe(false);
  });
});
