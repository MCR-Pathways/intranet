import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrgChartPersonCard } from "./org-chart-person-card";

// Mock DEPARTMENT_CONFIG
vi.mock("@/lib/hr", () => ({
  DEPARTMENT_CONFIG: {
    executive: { label: "Executive", colour: "#1e293b" },
    delivery: { label: "Delivery", colour: "#15803d" },
    people: { label: "People", colour: "#7c3aed" },
  } as Record<string, { label: string; colour: string }>,
}));

const defaultProps = {
  personId: "user-1",
  name: "Sarah Mitchell",
  jobTitle: "Programme Manager",
  department: "delivery" as const,
  avatarUrl: "",
  isExternal: false,
  isOnLeave: false,
  fte: 1,
  directReportCount: 3,
  totalReportCount: 8,
  isHighlighted: false,
  isAncestor: false,
  hasChildren: true,
  isCollapsed: false,
  onToggleExpand: vi.fn(),
  onFocus: vi.fn(),
};

// foreignObject is an SVG element — must be inside <svg> for jsdom to parse children
function renderCard(overrides: Partial<typeof defaultProps> = {}) {
  return render(
    <svg>
      <OrgChartPersonCard {...defaultProps} {...overrides} />
    </svg>
  );
}

describe("OrgChartPersonCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });
  });

  it("renders person name and job title", () => {
    renderCard();

    expect(screen.getByText("Sarah Mitchell")).toBeInTheDocument();
    expect(screen.getByText("Programme Manager")).toBeInTheDocument();
  });

  it("shows reports badge when totalReportCount > 0", () => {
    renderCard({ totalReportCount: 8 });

    expect(screen.getByText("8 reports")).toBeInTheDocument();
  });

  it("shows singular 'report' for totalReportCount = 1", () => {
    renderCard({ totalReportCount: 1 });

    expect(screen.getByText("1 report")).toBeInTheDocument();
  });

  it("hides reports badge when totalReportCount is 0", () => {
    renderCard({ totalReportCount: 0 });

    expect(screen.queryByText(/report/)).not.toBeInTheDocument();
  });

  it("shows GCC badge for external staff", () => {
    renderCard({ isExternal: true });

    expect(screen.getByText("GCC")).toBeInTheDocument();
  });

  it("does not show GCC badge for internal staff", () => {
    renderCard({ isExternal: false });

    expect(screen.queryByText("GCC")).not.toBeInTheDocument();
  });

  it("shows FTE badge when fte !== 1", () => {
    renderCard({ fte: 0.8 });

    expect(screen.getByText("0.8 FTE")).toBeInTheDocument();
  });

  it("hides FTE badge when fte is 1", () => {
    renderCard({ fte: 1 });

    expect(screen.queryByText(/FTE/)).not.toBeInTheDocument();
  });

  it("shows on-leave indicator when isOnLeave is true", () => {
    renderCard({ isOnLeave: true });

    expect(screen.getByText("On leave")).toBeInTheDocument();
  });

  it("hides on-leave indicator when isOnLeave is false", () => {
    renderCard({ isOnLeave: false });

    expect(screen.queryByText("On leave")).not.toBeInTheDocument();
  });

  it("applies highlight ring when isHighlighted is true", () => {
    const { container } = renderCard({ isHighlighted: true });

    const card = container.querySelector("[role='button']");
    expect(card?.className).toContain("ring-2");
    expect(card?.className).toContain("ring-primary");
  });

  it("applies ancestor styling when isAncestor is true", () => {
    const { container } = renderCard({ isAncestor: true });

    const card = container.querySelector("[role='button']");
    expect(card?.className).toContain("opacity-60");
    expect(card?.className).toContain("border-dashed");
  });

  it("navigates to user profile on click", () => {
    const { container } = renderCard();

    const card = container.querySelector("[role='button']") as HTMLElement;
    fireEvent.click(card);

    expect(window.location.href).toBe("/hr/users/user-1");
  });

  it("navigates on Enter key press", () => {
    const { container } = renderCard();

    const card = container.querySelector("[role='button']") as HTMLElement;
    fireEvent.keyDown(card, { key: "Enter" });

    expect(window.location.href).toBe("/hr/users/user-1");
  });

  it("shows expand/collapse button when hasChildren", () => {
    renderCard({ hasChildren: true, isCollapsed: true, directReportCount: 3 });

    expect(
      screen.getByLabelText("Expand 3 direct reports")
    ).toBeInTheDocument();
  });

  it("hides expand/collapse button when no children", () => {
    renderCard({ hasChildren: false });

    expect(
      screen.queryByLabelText(/Expand|Collapse/)
    ).not.toBeInTheDocument();
  });

  it("calls onToggleExpand when expand button is clicked", () => {
    const onToggleExpand = vi.fn();
    renderCard({ hasChildren: true, isCollapsed: true, onToggleExpand });

    fireEvent.click(screen.getByLabelText("Expand 3 direct reports"));
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it("shows collapse label when expanded", () => {
    renderCard({ hasChildren: true, isCollapsed: false });

    expect(screen.getByLabelText("Collapse team")).toBeInTheDocument();
  });

  it("shows focus button for managers", () => {
    renderCard({ hasChildren: true });

    expect(
      screen.getByLabelText("Focus on Sarah Mitchell's team")
    ).toBeInTheDocument();
  });

  it("calls onFocus with personId when focus button is clicked", () => {
    const onFocus = vi.fn();
    renderCard({ hasChildren: true, onFocus });

    fireEvent.click(screen.getByLabelText("Focus on Sarah Mitchell's team"));
    expect(onFocus).toHaveBeenCalledWith("user-1");
  });

  it("has correct aria-label with full context", () => {
    const { container } = renderCard();

    const card = container.querySelector("[role='button']");
    expect(card).toHaveAttribute(
      "aria-label",
      "Sarah Mitchell, Programme Manager, 3 direct reports"
    );
  });

  it("renders avatar fallback with initials", () => {
    renderCard({ avatarUrl: "" });

    expect(screen.getByText("SM")).toBeInTheDocument();
  });
});
