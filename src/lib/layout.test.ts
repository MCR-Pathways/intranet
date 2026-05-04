import { describe, it, expect } from "vitest";
import { CENTRE_COLUMN_WIDTHS, getCentreColumnCSS } from "./layout";

describe("getCentreColumnCSS", () => {
  const intranetWidth = `${CENTRE_COLUMN_WIDTHS.intranet}px`;

  it("returns the intranet width for /intranet", () => {
    expect(getCentreColumnCSS("/intranet")).toBe(intranetWidth);
  });

  it("returns the intranet width for /intranet/post/[id]", () => {
    expect(getCentreColumnCSS("/intranet/post/abc-123")).toBe(intranetWidth);
  });

  it("returns the intranet width for nested post paths", () => {
    expect(getCentreColumnCSS("/intranet/post/abc-123/comments")).toBe(intranetWidth);
  });

  it("returns null for /hr", () => {
    expect(getCentreColumnCSS("/hr")).toBeNull();
  });

  it("returns null for /hr/leave", () => {
    expect(getCentreColumnCSS("/hr/leave")).toBeNull();
  });

  it("returns null for /learning", () => {
    expect(getCentreColumnCSS("/learning")).toBeNull();
  });

  it("returns null for /sign-in", () => {
    expect(getCentreColumnCSS("/sign-in")).toBeNull();
  });

  it("returns null for /resources", () => {
    expect(getCentreColumnCSS("/resources")).toBeNull();
  });

  it("returns null for /intranet/induction (sub-route stays full width)", () => {
    expect(getCentreColumnCSS("/intranet/induction")).toBeNull();
  });

  it("returns null for /intranet/policies", () => {
    expect(getCentreColumnCSS("/intranet/policies")).toBeNull();
  });

  it("returns null for /intranet/guides", () => {
    expect(getCentreColumnCSS("/intranet/guides")).toBeNull();
  });

  it("returns null for /intranet/surveys", () => {
    expect(getCentreColumnCSS("/intranet/surveys")).toBeNull();
  });

  it("returns null for /intranet/weekly-roundup", () => {
    expect(getCentreColumnCSS("/intranet/weekly-roundup")).toBeNull();
  });

  it("does not match prefix lookalikes like /intranet-foo", () => {
    expect(getCentreColumnCSS("/intranet-foo")).toBeNull();
  });

  it("does not match /intranet-other", () => {
    expect(getCentreColumnCSS("/intranet-other")).toBeNull();
  });

  it("returns null for the empty string", () => {
    expect(getCentreColumnCSS("")).toBeNull();
  });

  it("returns null for the root path", () => {
    expect(getCentreColumnCSS("/")).toBeNull();
  });
});
