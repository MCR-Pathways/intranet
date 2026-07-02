import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ArticleOutline } from "./article-outline";
import type { ArticleHeading } from "@/lib/article-constants";

/**
 * The rail is a pure renderer: the parent filters headings (filterRailHeadings)
 * and runs scroll-spy. These cover what the component owns: the active marker,
 * the hide-when-thin guard, the landmark name, and the narrow disclosure's
 * a11y wiring (button + aria-expanded + aria-controls). The desktop/narrow
 * split is pure CSS (lg: variants), so both the disclosure button and the
 * desktop label are always in the DOM; jsdom cannot exercise breakpoints, so
 * visibility-at-width is covered by the build-time visual checks instead.
 */

const HEADINGS: ArticleHeading[] = [
  { level: 2, text: "Section A", slug: "section-a" },
  { level: 3, text: "Sub one", slug: "sub-one" },
  { level: 2, text: "Section B", slug: "section-b" },
];

describe("ArticleOutline", () => {
  it("renders a link per heading", () => {
    render(<ArticleOutline headings={HEADINGS} activeHeadingId="section-a" />);
    expect(screen.getByRole("link", { name: "Section A" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sub one" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Section B" })).toBeInTheDocument();
  });

  it("renders nothing with fewer than 2 headings", () => {
    const { container } = render(
      <ArticleOutline headings={[HEADINGS[0]]} activeHeadingId="" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names the nav landmark so screen readers can find the contents list", () => {
    render(<ArticleOutline headings={HEADINGS} activeHeadingId="" />);
    expect(
      screen.getByRole("navigation", { name: "On this page" })
    ).toBeInTheDocument();
  });

  it("marks the active heading with aria-current", () => {
    render(<ArticleOutline headings={HEADINGS} activeHeadingId="section-b" />);
    expect(screen.getByRole("link", { name: "Section B" })).toHaveAttribute(
      "aria-current",
      "location"
    );
    expect(screen.getByRole("link", { name: "Section A" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("marks nothing when scroll-spy reports no active heading", () => {
    // Reader is above the first heading: asserting aria-current there would
    // tell screen readers they are somewhere they have not reached.
    render(<ArticleOutline headings={HEADINGS} activeHeadingId="" />);
    HEADINGS.forEach((h) => {
      expect(screen.getByRole("link", { name: h.text })).not.toHaveAttribute(
        "aria-current"
      );
    });
  });

  it("wires the disclosure button with aria-expanded and aria-controls", () => {
    render(<ArticleOutline headings={HEADINGS} activeHeadingId="" />);

    const button = screen.getByRole("button", { name: /on this page/i });
    expect(button).toHaveAttribute("aria-expanded", "false");

    const listId = button.getAttribute("aria-controls");
    const list = document.getElementById(listId!);
    expect(list).not.toBeNull();
    // Collapsed = hidden on narrow viewports only; always visible from lg.
    expect(list!.className).toContain("max-lg:hidden");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(list!.className).not.toContain("max-lg:hidden");
  });

  it("collapses the disclosure and updates the URL hash when a heading is picked", () => {
    render(<ArticleOutline headings={HEADINGS} activeHeadingId="" />);

    const button = screen.getByRole("button", { name: /on this page/i });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("link", { name: "Section B" }));
    expect(button).toHaveAttribute("aria-expanded", "false");
    // preventDefault suppresses the browser's own hash update; goToHeading
    // pushes it so the section link stays shareable.
    expect(window.location.hash).toBe("#section-b");
  });
});
