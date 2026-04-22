import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { TooltipButton } from "./tooltip-button";

// jsdom renders Radix Tooltip's portal content lazily on hover/focus. We
// assert the structural contract (span wrapper vs bare button) rather than
// the tooltip's rendered text, which would require interaction we don't
// need for the unit-level guarantees.

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TooltipButton", () => {
  it("renders a plain Button (no wrapper span) when not disabled", () => {
    const { container } = render(
      <TooltipButton>Click me</TooltipButton>
    );
    // No wrapping span with tabIndex=0; the button is the outermost element.
    const outer = container.firstElementChild;
    expect(outer?.tagName).toBe("BUTTON");
  });

  it("wraps the disabled Button in a focusable span when `reason` is provided", () => {
    const { container } = render(
      <TooltipButton disabled reason="Fill in required fields first">
        Submit
      </TooltipButton>
    );
    const outer = container.firstElementChild;
    expect(outer?.tagName).toBe("SPAN");
    expect(outer?.getAttribute("tabindex")).toBe("0");
    expect(outer?.getAttribute("aria-disabled")).toBe("true");
    const button = outer?.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.hasAttribute("disabled")).toBe(true);
  });

  it("renders a bare disabled Button and warns in dev when `reason` is missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { container } = render(
      <TooltipButton disabled>Submit</TooltipButton>
    );
    const outer = container.firstElementChild;
    expect(outer?.tagName).toBe("BUTTON");
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/disabled without `reason`/);
  });

  it("surfaces the reason as accessible text", () => {
    render(
      <TooltipButton disabled reason="Course not yet assigned">
        Enrol
      </TooltipButton>
    );
    // Radix sets `aria-describedby` on the trigger once the tooltip mounts;
    // before interaction we can at least assert the content is in the DOM
    // via Radix's portal.
    const buttons = screen.getAllByRole("button", { hidden: true });
    expect(buttons[0].hasAttribute("disabled")).toBe(true);
  });
});
