import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyRoundupBanner } from "./weekly-roundup-banner";

const roundup = {
  id: "abc-123",
  title: "Weekly Round Up — 8 Jun to 12 Jun 2026",
  summary: "New mentor cohort, EDI training dates, and the kiosk pilot.",
  week_start: "2026-06-08",
  week_end: "2026-06-12",
};

describe("WeeklyRoundupBanner", () => {
  it("renders the ISO week tag, fixed heading, summary and CTA link", () => {
    render(<WeeklyRoundupBanner roundup={roundup} />);
    expect(screen.getByText("Week 24")).toBeInTheDocument();
    expect(screen.getByText("Your Weekly Round Up")).toBeInTheDocument();
    expect(screen.getByText("8–12 Jun")).toBeInTheDocument();
    expect(screen.getByText(/New mentor cohort/)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /read the round up/i });
    expect(cta).toHaveAttribute("href", "/intranet/weekly-roundup/abc-123");
  });

  it("omits the summary line when there is no summary", () => {
    render(<WeeklyRoundupBanner roundup={{ ...roundup, summary: null }} />);
    expect(screen.queryByText(/New mentor cohort/)).not.toBeInTheDocument();
    expect(screen.getByText("Your Weekly Round Up")).toBeInTheDocument();
    // The covered-days line still shows when there's no summary.
    expect(screen.getByText("8–12 Jun")).toBeInTheDocument();
  });

  it("hides the decorative quotemark from assistive tech", () => {
    const { container } = render(<WeeklyRoundupBanner roundup={roundup} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
