import { describe, it, expect } from "vitest";
import { buttonVariants } from "./button";

// Variant × size snapshot. Catches accidental class-string changes (variant
// additions/removals, size drift, base-class churn). Run after every change
// to `button.tsx` and verify the diff is intentional.

const variants = [
  "default",
  "secondary",
  "destructive",
  "success",
  "outline",
  "ghost",
  "link",
] as const;

const sizes = [
  "hero",
  "lg",
  "default",
  "sm",
  "icon",
  "icon-sm",
  "icon-xs",
] as const;

describe("buttonVariants", () => {
  it("produces the expected class string for every variant × size combination", () => {
    const matrix: Record<string, Record<string, string>> = {};
    for (const variant of variants) {
      matrix[variant] = {};
      for (const size of sizes) {
        matrix[variant][size] = buttonVariants({ variant, size });
      }
    }
    expect(matrix).toMatchSnapshot();
  });

  it("never renders the removed `action` variant", () => {
    // @ts-expect-error — intentional: verify TS flags removed variant
    const output = buttonVariants({ variant: "action" });
    // Fallback to default variant silently instead of crashing, but we
    // specifically assert the action-variant colour classes do NOT appear.
    expect(output).not.toContain("bg-action");
    expect(output).not.toContain("text-action-foreground");
  });

  it("applies destructive ring-flash override (active:scale-100 + active:ring-4)", () => {
    const output = buttonVariants({ variant: "destructive" });
    expect(output).toContain("active:scale-100");
    expect(output).toContain("active:ring-4");
    expect(output).toContain("active:ring-destructive/20");
  });

  it("applies hover-lift on filled primaries (default, success, destructive)", () => {
    for (const variant of ["default", "success", "destructive"] as const) {
      const output = buttonVariants({ variant });
      expect(output).toContain("hover:-translate-y-px");
      expect(output).toContain("hover:shadow-md");
    }
  });

  it("does NOT apply hover-lift on outline, ghost, secondary, or link", () => {
    for (const variant of ["outline", "ghost", "secondary", "link"] as const) {
      const output = buttonVariants({ variant });
      expect(output).not.toContain("hover:-translate-y-px");
    }
  });

  it("applies per-variant SVG sizing (hero/lg/icon → size-5, default/icon-sm → size-4, sm/icon-xs → size-3.5)", () => {
    expect(buttonVariants({ size: "hero" })).toContain("[&_svg]:size-5");
    expect(buttonVariants({ size: "lg" })).toContain("[&_svg]:size-5");
    expect(buttonVariants({ size: "icon" })).toContain("[&_svg]:size-5");
    expect(buttonVariants({ size: "default" })).toContain("[&_svg]:size-4");
    expect(buttonVariants({ size: "icon-sm" })).toContain("[&_svg]:size-4");
    expect(buttonVariants({ size: "sm" })).toContain("[&_svg]:size-3.5");
    expect(buttonVariants({ size: "icon-xs" })).toContain("[&_svg]:size-3.5");
  });

  it("applies font-weight hierarchy (primaries → semibold, secondaries → medium)", () => {
    for (const variant of ["default", "success", "destructive"] as const) {
      const output = buttonVariants({ variant });
      expect(output).toContain("font-semibold");
      expect(output).toContain("tracking-tight");
    }
    for (const variant of ["secondary", "outline", "ghost", "link"] as const) {
      const output = buttonVariants({ variant });
      expect(output).toContain("font-medium");
    }
  });

  it("link variant has always-underlined with thickening hover", () => {
    const output = buttonVariants({ variant: "link" });
    expect(output).toContain("underline");
    expect(output).toContain("underline-offset-[3px]");
    expect(output).toContain("decoration-1");
    expect(output).toContain("hover:decoration-2");
    expect(output).toContain("hover:underline-offset-4");
    // Old link variant had `hover:underline` (hover-only underline).
    // New variant always shows underline and thickens on hover. Make sure
    // the old class is gone without false-matching `hover:underline-offset-*`.
    expect(output).not.toMatch(/\bhover:underline(\s|$)/);
  });

  it("rounded-lg on every size (no rounded-md override)", () => {
    for (const size of sizes) {
      const output = buttonVariants({ size });
      expect(output).not.toContain("rounded-md");
    }
  });

  it("base class no longer hardcodes [&_svg]:size-4", () => {
    // Each size supplies its own SVG size. Base class should only have
    // [&_svg]:pointer-events-none and [&_svg]:shrink-0, not size-4.
    // Default variant + default size both pick up the size=default size-4.
    // But a raw `buttonVariants()` call (no args) uses default variant + default size.
    const defaultOutput = buttonVariants();
    expect(defaultOutput).toContain("[&_svg]:size-4");
    // Change the size; size-4 should go away, size-5 should appear.
    const lgOutput = buttonVariants({ size: "lg" });
    expect(lgOutput).toContain("[&_svg]:size-5");
    // Only one svg-size class should be applied at a time (twMerge resolves).
    // Basic presence check: lg output must not ALSO contain size-4.
    const size4Count = (lgOutput.match(/\[&_svg\]:size-4/g) ?? []).length;
    expect(size4Count).toBe(0);
  });

  it("base class removes its own focus-visible ring (global outline handles focus)", () => {
    const output = buttonVariants();
    expect(output).not.toContain("focus-visible:ring-2");
    expect(output).not.toContain("focus-visible:ring-ring");
    expect(output).not.toContain("focus-visible:ring-offset-2");
  });
});
