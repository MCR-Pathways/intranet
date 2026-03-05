import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

// Radix UI uses ResizeObserver internally — jsdom doesn't provide it
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock server actions
const mockCreateDepartment = vi.fn();
const mockUpdateDepartment = vi.fn();
const mockToggleDepartmentActive = vi.fn();

vi.mock("@/app/(protected)/hr/departments/actions", () => ({
  createDepartment: (...args: unknown[]) => mockCreateDepartment(...args),
  updateDepartment: (...args: unknown[]) => mockUpdateDepartment(...args),
  toggleDepartmentActive: (...args: unknown[]) => mockToggleDepartmentActive(...args),
}));

import { DepartmentManagementContent } from "./department-management-content";

const testDepartments = [
  {
    id: "dept-1",
    slug: "executive",
    name: "Executive",
    colour: "#1e293b",
    sort_order: 1,
    is_active: true,
    staff_count: 3,
  },
  {
    id: "dept-2",
    slug: "delivery",
    name: "Delivery",
    colour: "#15803d",
    sort_order: 2,
    is_active: true,
    staff_count: 15,
  },
  {
    id: "dept-3",
    slug: "finance",
    name: "Finance",
    colour: "#b45309",
    sort_order: 3,
    is_active: false,
    staff_count: 0,
  },
];

describe("DepartmentManagementContent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCreateDepartment.mockResolvedValue({ success: true });
    mockUpdateDepartment.mockResolvedValue({ success: true });
    mockToggleDepartmentActive.mockResolvedValue({ success: true });
  });

  // =============================================
  // RENDERING
  // =============================================

  it("renders department count", () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    expect(screen.getByText("3 departments")).toBeInTheDocument();
  });

  it("renders singular count for 1 department", () => {
    render(
      <DepartmentManagementContent departments={[testDepartments[0]]} />
    );

    expect(screen.getByText("1 department")).toBeInTheDocument();
  });

  it("renders department names in table", () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    expect(screen.getByText("Executive")).toBeInTheDocument();
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
  });

  it("renders department slugs", () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    expect(screen.getByText("executive")).toBeInTheDocument();
    expect(screen.getByText("delivery")).toBeInTheDocument();
  });

  it("renders staff counts", () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    // "3" appears in both staff_count (Executive) and sort_order (Finance) columns
    const threes = screen.getAllByText("3");
    expect(threes.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("renders Active/Inactive badges", () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    const activeBadges = screen.getAllByText("Active");
    const inactiveBadges = screen.getAllByText("Inactive");
    expect(activeBadges).toHaveLength(2);
    expect(inactiveBadges).toHaveLength(1);
  });

  it("renders empty state when no departments", () => {
    render(<DepartmentManagementContent departments={[]} />);

    expect(
      screen.getByText("No departments yet. Create one to get started.")
    ).toBeInTheDocument();
  });

  it("renders Create Department button", () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    expect(
      screen.getByRole("button", { name: /Create Department/i })
    ).toBeInTheDocument();
  });

  // =============================================
  // CREATE FLOW
  // =============================================

  it("opens create dialog when Create Department is clicked", () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    fireEvent.click(screen.getByRole("button", { name: /Create Department/i }));

    // Dialog description confirms the dialog opened
    expect(
      screen.getByText("Add a new department to the organisation.")
    ).toBeInTheDocument();
    // Dialog title contains "Create Department" (separate from the button)
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("auto-generates slug from name in create mode", () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    fireEvent.click(screen.getByRole("button", { name: /Create Department/i }));

    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, {
      target: { value: "Marketing & Communications" },
    });

    const slugInput = screen.getByLabelText("Slug");
    expect(slugInput).toHaveValue("marketing_and_communications");
  });

  it("disables create button when name is empty", () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    fireEvent.click(screen.getByRole("button", { name: /Create Department/i }));

    // Create button should be disabled (empty name and slug)
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("calls createDepartment on submit", async () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    fireEvent.click(screen.getByRole("button", { name: /Create Department/i }));

    // Fill form
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "New Dept" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockCreateDepartment).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Dept",
          slug: "new_dept",
        })
      );
    });
  });

  // =============================================
  // EDIT FLOW
  // =============================================

  it("opens edit dialog from dropdown menu", async () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    // Find the actions button for the first department (sr-only text "Actions")
    const actionButtons = screen.getAllByRole("button", { name: "Actions" });
    fireEvent.pointerDown(actionButtons[0], { button: 0, pointerType: "mouse" });

    // Click Edit in the dropdown
    const editItem = await screen.findByRole("menuitem", { name: /Edit/i });
    fireEvent.click(editItem);

    await waitFor(() => {
      expect(screen.getByText("Edit Department")).toBeInTheDocument();
      expect(screen.getByText("Update department details.")).toBeInTheDocument();
    });
  });

  // =============================================
  // TOGGLE ACTIVE
  // =============================================

  it("shows deactivate confirmation from dropdown", async () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    // Open dropdown for first department (active, 3 staff)
    const actionButtons = screen.getAllByRole("button", { name: "Actions" });
    fireEvent.pointerDown(actionButtons[0], { button: 0, pointerType: "mouse" });

    const deactivateItem = await screen.findByRole("menuitem", { name: /Deactivate/i });
    fireEvent.click(deactivateItem);

    // Should show confirmation with staff count warning
    await waitFor(() => {
      expect(screen.getByText("Deactivate Executive?")).toBeInTheDocument();
    });
  });

  it("shows reactivate option for inactive departments", async () => {
    render(<DepartmentManagementContent departments={testDepartments} />);

    // Open dropdown for Finance (inactive) — 3rd action button
    const actionButtons = screen.getAllByRole("button", { name: "Actions" });
    fireEvent.pointerDown(actionButtons[2], { button: 0, pointerType: "mouse" });

    const reactivateItem = await screen.findByRole("menuitem", { name: /Reactivate/i });
    expect(reactivateItem).toBeInTheDocument();
  });

  it("calls toggleDepartmentActive on confirm", async () => {
    render(
      <DepartmentManagementContent
        departments={[
          { ...testDepartments[2] }, // Finance (inactive, 0 staff)
        ]}
      />
    );

    // Open dropdown
    const actionButton = screen.getAllByRole("button").find(
      (b) => b.querySelector("svg.lucide-more-horizontal") || b.textContent?.trim() === "Actions"
    )!;
    fireEvent.pointerDown(actionButton, { button: 0, pointerType: "mouse" });

    const reactivateItem = await screen.findByRole("menuitem", { name: /Reactivate/i });
    fireEvent.click(reactivateItem);

    // Confirm in the AlertDialog
    await waitFor(() => {
      expect(screen.getByText("Reactivate Finance?")).toBeInTheDocument();
    });

    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Reactivate" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockToggleDepartmentActive).toHaveBeenCalledWith("dept-3");
    });
  });
});
