import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// cmdk uses ResizeObserver and scrollIntoView — jsdom doesn't provide them
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView = vi.fn();

import { TeamCombobox } from "./team-combobox";

const testTeams = [
  { id: "t1", name: "West Region Team" },
  { id: "t2", name: "East Region Team" },
  { id: "t3", name: "Finance Team" },
];

const defaultProps = {
  teams: testTeams,
  value: null,
  onChange: vi.fn(),
};

describe("TeamCombobox", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders with default placeholder", () => {
    render(<TeamCombobox {...defaultProps} />);

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows selected team name when value is set", () => {
    render(<TeamCombobox {...defaultProps} value="t1" />);

    expect(screen.getByText("West Region Team")).toBeInTheDocument();
  });

  it("shows team list when opened", () => {
    render(<TeamCombobox {...defaultProps} />);

    fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByText("West Region Team")).toBeInTheDocument();
    expect(screen.getByText("East Region Team")).toBeInTheDocument();
    expect(screen.getByText("Finance Team")).toBeInTheDocument();
  });

  it("calls onChange when a team is selected", () => {
    const onChange = vi.fn();
    render(<TeamCombobox {...defaultProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Finance Team"));

    expect(onChange).toHaveBeenCalledWith("t3");
  });

  it("shows empty state when no results match", () => {
    render(<TeamCombobox {...defaultProps} />);

    fireEvent.click(screen.getByRole("combobox"));

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: "zzzzz" } });

    expect(screen.getByText(/No team found/i)).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<TeamCombobox {...defaultProps} disabled={true} />);

    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
