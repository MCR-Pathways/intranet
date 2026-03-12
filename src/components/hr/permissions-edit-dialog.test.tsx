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
  isCurrentUserSystemsAdmin: false,
  isHRAdmin: false,
  isLDAdmin: false,
  isSystemsAdmin: false,
  isContentEditor: false,
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

  it("renders all five permission switches", () => {
    renderDialog();

    expect(screen.getByText("HR Admin")).toBeInTheDocument();
    expect(screen.getByText("L&D Admin")).toBeInTheDocument();
    expect(screen.getByText("Systems Admin")).toBeInTheDocument();
    expect(screen.getByText("Content Editor")).toBeInTheDocument();
    expect(screen.getByText("Line Manager")).toBeInTheDocument();
  });

  it("shows current permission states", () => {
    renderDialog({
      isHRAdmin: true,
      isLDAdmin: false,
      isSystemsAdmin: true,
      isContentEditor: true,
      isLineManager: true,
    });

    // Check that switches reflect the current state
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(5);
    expect(screen.getByRole("switch", { name: "HR Admin" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "L&D Admin" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Systems Admin" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Content Editor" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Line Manager" })).toBeChecked();
  });

  it("disables all admin toggles when current user is neither HR nor systems admin", () => {
    renderDialog({ isCurrentUserHRAdmin: false, isCurrentUserSystemsAdmin: false });

    expect(screen.getByRole("switch", { name: "HR Admin" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "L&D Admin" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Systems Admin" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Content Editor" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Line Manager" })).not.toBeDisabled();
  });

  it("systems admin can toggle L&D Admin, Systems Admin, and Content Editor but not HR Admin", () => {
    renderDialog({ isCurrentUserHRAdmin: false, isCurrentUserSystemsAdmin: true });

    expect(screen.getByRole("switch", { name: "HR Admin" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "L&D Admin" })).not.toBeDisabled();
    expect(screen.getByRole("switch", { name: "Systems Admin" })).not.toBeDisabled();
    expect(screen.getByRole("switch", { name: "Content Editor" })).not.toBeDisabled();
    expect(screen.getByRole("switch", { name: "Line Manager" })).not.toBeDisabled();
  });

  it("disables admin toggles when editing self", () => {
    renderDialog({
      profileId: "admin-1",
      currentUserId: "admin-1",
      isCurrentUserHRAdmin: true,
    });

    expect(screen.getByRole("switch", { name: "HR Admin" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "L&D Admin" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Systems Admin" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Content Editor" })).toBeDisabled();
  });

  it("shows confirmation dialog when toggling admin permission", async () => {
    renderDialog({ isCurrentUserHRAdmin: true });

    fireEvent.click(screen.getByRole("switch", { name: "HR Admin" }));

    await waitFor(() => {
      expect(screen.getByText(/Grant HR Admin Access/)).toBeInTheDocument();
    });
  });

  it("does not show confirmation for Line Manager toggle", () => {
    renderDialog({ isCurrentUserHRAdmin: true });

    fireEvent.click(screen.getByRole("switch", { name: "Line Manager" }));

    // Should NOT show confirmation dialog
    expect(screen.queryByText(/Grant.*Access/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Remove.*Access/)).not.toBeInTheDocument();
  });

  it("calls updateUserProfile on save", async () => {
    renderDialog({
      isCurrentUserHRAdmin: true,
      isLineManager: false,
    });

    fireEvent.click(screen.getByRole("switch", { name: "Line Manager" }));

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
    fireEvent.click(switches[4]);

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
    fireEvent.click(switches[4]);
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
    });
  });
});
