import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Radix UI uses ResizeObserver internally — jsdom doesn't provide it
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock server action
const mockUpdateUserProfile = vi.fn();
vi.mock("@/app/(protected)/hr/users/actions", () => ({
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
}));

// Must import AFTER mocks are set up
import { PermissionsEditDialog } from "./permissions-edit-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

const defaultProps = {
  profileId: "user-1",
  profileName: "Sarah Mitchell",
  currentUserId: "admin-1",
  isCurrentUserHRAdmin: true,
  isHRAdmin: false,
  isLDAdmin: false,
  isSystemsAdmin: false,
  isLineManager: false,
  open: true,
  onOpenChange: vi.fn(),
};

// Radix Tooltip requires TooltipProvider — wrap all renders
function renderDialog(
  overrides: Partial<typeof defaultProps> = {}
) {
  return render(
    <TooltipProvider>
      <PermissionsEditDialog {...defaultProps} {...overrides} />
    </TooltipProvider>
  );
}

describe("PermissionsEditDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUpdateUserProfile.mockResolvedValue({ success: true });
  });

  it("renders dialog with profile name", () => {
    renderDialog();

    expect(screen.getByText(/Sarah Mitchell/)).toBeInTheDocument();
  });

  it("renders all four permission switches", () => {
    renderDialog();

    expect(screen.getByText("HR Admin")).toBeInTheDocument();
    expect(screen.getByText("L&D Admin")).toBeInTheDocument();
    expect(screen.getByText("Systems Admin")).toBeInTheDocument();
    expect(screen.getByText("Line Manager")).toBeInTheDocument();
  });

  it("shows current permission states", () => {
    renderDialog({
      isHRAdmin: true,
      isLDAdmin: false,
      isSystemsAdmin: true,
      isLineManager: true,
    });

    // Check that switches reflect the current state
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(4);
    expect(screen.getByRole("switch", { name: "HR Admin" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "L&D Admin" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Systems Admin" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Line Manager" })).toBeChecked();
  });

  it("disables all admin toggles when current user is neither HR nor systems admin", () => {
    renderDialog({ isCurrentUserHRAdmin: false, isCurrentUserSystemsAdmin: false });

    const switches = screen.getAllByRole("switch");
    // HR Admin, L&D Admin, Systems Admin should be disabled
    expect(switches[0]).toBeDisabled();
    expect(switches[1]).toBeDisabled();
    expect(switches[2]).toBeDisabled();
    // Line Manager should be enabled
    expect(switches[3]).not.toBeDisabled();
  });

  it("systems admin can toggle L&D Admin and Systems Admin but not HR Admin", () => {
    renderDialog({ isCurrentUserHRAdmin: false, isCurrentUserSystemsAdmin: true });

    const switches = screen.getAllByRole("switch");
    // HR Admin should be disabled (only HR admins can grant it)
    expect(switches[0]).toBeDisabled();
    // L&D Admin and Systems Admin should be enabled
    expect(switches[1]).not.toBeDisabled();
    expect(switches[2]).not.toBeDisabled();
    // Line Manager should be enabled
    expect(switches[3]).not.toBeDisabled();
  });

  it("disables admin toggles when editing self", () => {
    renderDialog({
      profileId: "admin-1",
      currentUserId: "admin-1",
      isCurrentUserHRAdmin: true,
    });

    const switches = screen.getAllByRole("switch");
    // HR Admin, L&D Admin, Systems Admin should be disabled (self-edit)
    expect(switches[0]).toBeDisabled();
    expect(switches[1]).toBeDisabled();
    expect(switches[2]).toBeDisabled();
  });

  it("shows confirmation dialog when toggling admin permission", async () => {
    renderDialog({ isCurrentUserHRAdmin: true });

    // Click HR Admin switch — should show confirmation (granting admin access)
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);

    // Confirmation title is "Grant HR Admin Access"
    await waitFor(() => {
      expect(screen.getByText(/Grant HR Admin Access/)).toBeInTheDocument();
    });
  });

  it("does not show confirmation for Line Manager toggle", () => {
    renderDialog({ isCurrentUserHRAdmin: true });

    // Click Line Manager switch (last one)
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[3]);

    // Should NOT show confirmation dialog
    expect(screen.queryByText(/Grant.*Access/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Remove.*Access/)).not.toBeInTheDocument();
  });

  it("calls updateUserProfile on save", async () => {
    renderDialog({
      isCurrentUserHRAdmin: true,
      isLineManager: false,
    });

    // Toggle Line Manager (no confirmation needed)
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[3]);

    // Click Save
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          is_line_manager: true,
        })
      );
    });
  });

  it("closes dialog on successful save", async () => {
    const onOpenChange = vi.fn();
    renderDialog({
      onOpenChange,
      isLineManager: false,
    });

    // Toggle Line Manager
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[3]);

    // Save
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows error on save failure", async () => {
    mockUpdateUserProfile.mockResolvedValue({
      success: false,
      error: "Permission denied",
    });

    renderDialog({ isLineManager: false });

    // Toggle and save
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[3]);
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
    });
  });
});
