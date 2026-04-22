import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { ButtonSpinner } from "./button-spinner";

// SVG elements in jsdom expose `className` as an SVGAnimatedString, not a
// string. Use `getAttribute("class")` for substring/regex assertions.

describe("ButtonSpinner", () => {
  it("renders with size-4 by default", () => {
    const { container } = render(<ButtonSpinner />);
    const svg = container.querySelector("svg");
    const cls = svg?.getAttribute("class") ?? "";
    expect(cls).toMatch(/\bsize-4\b/);
    expect(cls).toContain("animate-spin");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("maps size='xs' and size='sm' to size-3.5", () => {
    const { container: xs } = render(<ButtonSpinner size="xs" />);
    const { container: sm } = render(<ButtonSpinner size="sm" />);
    expect(xs.querySelector("svg")?.getAttribute("class") ?? "").toMatch(
      /\bsize-3\.5\b/
    );
    expect(sm.querySelector("svg")?.getAttribute("class") ?? "").toMatch(
      /\bsize-3\.5\b/
    );
  });

  it("maps size='lg' to size-5", () => {
    const { container } = render(<ButtonSpinner size="lg" />);
    expect(container.querySelector("svg")?.getAttribute("class") ?? "").toMatch(
      /\bsize-5\b/
    );
  });

  it("merges additional className", () => {
    const { container } = render(<ButtonSpinner className="ml-2" />);
    expect(
      container.querySelector("svg")?.getAttribute("class") ?? ""
    ).toContain("ml-2");
  });
});
