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

import { PersonCombobox } from "./person-combobox";

const testPeople = [
  { id: "p1", full_name: "Alice Fraser", job_title: "People Director" },
  { id: "p2", full_name: "Robert Campbell", job_title: "Director of Delivery" },
  { id: "p3", full_name: "David Wilson", job_title: "Programme Manager" },
  { id: "p4", full_name: "Karen MacDonald", job_title: null },
];

const defaultProps = {
  people: testPeople,
  value: null,
  onChange: vi.fn(),
};

describe("PersonCombobox", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders with placeholder text", () => {
    render(<PersonCombobox {...defaultProps} />);

    expect(
      screen.getByRole("combobox")
    ).toBeInTheDocument();
  });

  it("renders custom placeholder", () => {
    render(
      <PersonCombobox {...defaultProps} placeholder="Choose a manager" />
    );

    expect(screen.getByText("Choose a manager")).toBeInTheDocument();
  });

  it("shows selected person name when value is set", () => {
    render(
      <PersonCombobox {...defaultProps} value="p1" />
    );

    expect(screen.getByText("Alice Fraser")).toBeInTheDocument();
  });

  it("shows people list when opened", () => {
    render(<PersonCombobox {...defaultProps} />);

    // Open the popover
    fireEvent.click(screen.getByRole("combobox"));

    // Should show all people
    expect(screen.getByText("Alice Fraser")).toBeInTheDocument();
    expect(screen.getByText("Robert Campbell")).toBeInTheDocument();
    expect(screen.getByText("David Wilson")).toBeInTheDocument();
    expect(screen.getByText("Karen MacDonald")).toBeInTheDocument();
  });

  it("shows job title as secondary text", () => {
    render(<PersonCombobox {...defaultProps} />);

    fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByText("People Director")).toBeInTheDocument();
    expect(screen.getByText("Director of Delivery")).toBeInTheDocument();
  });

  it("calls onChange when a person is selected", () => {
    const onChange = vi.fn();
    render(<PersonCombobox {...defaultProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("David Wilson"));

    expect(onChange).toHaveBeenCalledWith("p3");
  });

  it("excludes person with excludeId", () => {
    render(
      <PersonCombobox {...defaultProps} excludeId="p2" />
    );

    fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByText("Alice Fraser")).toBeInTheDocument();
    expect(screen.queryByText("Robert Campbell")).not.toBeInTheDocument();
    expect(screen.getByText("David Wilson")).toBeInTheDocument();
  });

  it("shows empty state when no results match filter", () => {
    render(<PersonCombobox {...defaultProps} />);

    fireEvent.click(screen.getByRole("combobox"));

    // Type something that doesn't match
    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: "zzzzz" } });

    expect(screen.getByText(/No person found/i)).toBeInTheDocument();
  });
});
