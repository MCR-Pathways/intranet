/**
 * Tests for LeaveRequestTable component.
 *
 * Covers: rendering, filtering (status/type/search), action buttons
 * (withdraw/approve/reject/cancel), team overlap notice, and empty state.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaveRequestTable } from "./leave-request-table";
import type { LeaveRequest, LeaveRequestWithEmployee } from "@/types/hr";

// Mock server actions
const mockWithdrawLeave = vi.fn().mockResolvedValue({ success: true });
const mockApproveLeave = vi.fn().mockResolvedValue({ success: true });
const mockRejectLeave = vi.fn().mockResolvedValue({ success: true });
const mockCancelLeave = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/app/(protected)/hr/leave/actions", () => ({
  withdrawLeave: (...args: unknown[]) => mockWithdrawLeave(...args),
  approveLeave: (...args: unknown[]) => mockApproveLeave(...args),
  rejectLeave: (...args: unknown[]) => mockRejectLeave(...args),
  cancelLeave: (...args: unknown[]) => mockCancelLeave(...args),
}));

function makeRequest(overrides?: Partial<LeaveRequest>): LeaveRequest {
  return {
    id: "lr-1",
    profile_id: "user-2",
    leave_type: "annual",
    start_date: "2026-03-10",
    end_date: "2026-03-12",
    start_half_day: false,
    end_half_day: false,
    total_days: 3,
    reason: null,
    status: "pending",
    decided_by: null,
    decided_at: null,
    decision_notes: null,
    rejection_reason: null,
    created_at: "2026-03-01T10:00:00Z",
    ...overrides,
  };
}

function makeRequestWithEmployee(
  overrides?: Partial<LeaveRequestWithEmployee>
): LeaveRequestWithEmployee {
  return {
    ...makeRequest(),
    employee_name: "Bob Jones",
    employee_avatar: null,
    employee_job_title: "Developer",
    ...overrides,
  };
}

const defaultProps = {
  currentUserId: "user-1",
  requests: [makeRequest()],
};

describe("LeaveRequestTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // Basic rendering
  // =============================================

  it("renders table with request data", () => {
    render(<LeaveRequestTable {...defaultProps} />);
    expect(screen.getByText("Annual Leave")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("3 days")).toBeInTheDocument();
  });

  it("shows request count", () => {
    render(<LeaveRequestTable {...defaultProps} />);
    expect(screen.getByText("Showing 1 of 1 requests")).toBeInTheDocument();
  });

  it("hides employee column by default", () => {
    render(<LeaveRequestTable {...defaultProps} />);
    expect(screen.queryByText("Employee")).not.toBeInTheDocument();
  });

  it("shows employee column when showEmployee is true", () => {
    render(
      <LeaveRequestTable
        {...defaultProps}
        requests={[makeRequestWithEmployee()]}
        showEmployee={true}
      />
    );
    expect(screen.getByText("Employee")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("shows empty state when no requests match filters", () => {
    render(<LeaveRequestTable {...defaultProps} requests={[]} />);
    expect(screen.getByText("No leave requests found")).toBeInTheDocument();
  });

  it("shows rejection reason when present", () => {
    render(
      <LeaveRequestTable
        {...defaultProps}
        requests={[
          makeRequest({
            status: "rejected",
            rejection_reason: "Insufficient notice",
          }),
        ]}
      />
    );
    expect(screen.getByText("Insufficient notice")).toBeInTheDocument();
  });

  // =============================================
  // Search filter
  // =============================================

  it("shows search input only when showEmployee is true", () => {
    const { rerender } = render(<LeaveRequestTable {...defaultProps} />);
    expect(screen.queryByPlaceholderText("Search by name...")).not.toBeInTheDocument();

    rerender(
      <LeaveRequestTable
        {...defaultProps}
        requests={[makeRequestWithEmployee()]}
        showEmployee={true}
      />
    );
    expect(screen.getByPlaceholderText("Search by name...")).toBeInTheDocument();
  });

  it("filters by employee name", async () => {
    const user = userEvent.setup();
    render(
      <LeaveRequestTable
        currentUserId="user-1"
        requests={[
          makeRequestWithEmployee({ id: "lr-1", employee_name: "Alice Smith" }),
          makeRequestWithEmployee({ id: "lr-2", employee_name: "Bob Jones" }),
        ]}
        showEmployee={true}
      />
    );

    const search = screen.getByPlaceholderText("Search by name...");
    await user.type(search, "Alice");

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 requests")).toBeInTheDocument();
  });

  // =============================================
  // Action buttons visibility
  // =============================================

  it("shows Withdraw for own pending requests", () => {
    render(
      <LeaveRequestTable
        currentUserId="user-2"
        requests={[makeRequest({ profile_id: "user-2", status: "pending" })]}
      />
    );
    expect(screen.getByText("Withdraw")).toBeInTheDocument();
  });

  it("hides Withdraw for others' pending requests", () => {
    render(
      <LeaveRequestTable
        currentUserId="user-1"
        requests={[makeRequest({ profile_id: "user-2", status: "pending" })]}
      />
    );
    expect(screen.queryByText("Withdraw")).not.toBeInTheDocument();
  });

  it("shows Approve/Reject for manager on others' pending requests", () => {
    render(
      <LeaveRequestTable
        currentUserId="user-1"
        isManager={true}
        requests={[makeRequest({ profile_id: "user-2", status: "pending" })]}
      />
    );
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("hides Approve/Reject for own requests even as manager", () => {
    render(
      <LeaveRequestTable
        currentUserId="user-2"
        isManager={true}
        requests={[makeRequest({ profile_id: "user-2", status: "pending" })]}
      />
    );
    // Own request — should show Withdraw, not Approve/Reject
    expect(screen.getByText("Withdraw")).toBeInTheDocument();
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
  });

  it("shows Cancel for HR admin on approved requests", () => {
    render(
      <LeaveRequestTable
        currentUserId="user-1"
        isHRAdmin={true}
        requests={[makeRequest({ profile_id: "user-2", status: "approved" })]}
      />
    );
    // Scope to the table row to avoid matching dialog Cancel buttons
    const row = screen.getByText("Approved").closest("tr");
    expect(row).not.toBeNull();
    const cancelButton = within(row!).getByRole("button", { name: "Cancel" });
    expect(cancelButton).toBeInTheDocument();
  });

  it("hides Cancel for non-HR on approved requests", () => {
    render(
      <LeaveRequestTable
        currentUserId="user-1"
        requests={[makeRequest({ profile_id: "user-2", status: "approved" })]}
      />
    );
    // No action buttons at all for regular user on approved requests
    expect(screen.queryByText("Withdraw")).not.toBeInTheDocument();
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
  });

  // =============================================
  // Team overlap notice
  // =============================================

  it("shows overlap notice when teammates have overlapping leave", () => {
    const request = makeRequestWithEmployee({
      id: "lr-1",
      profile_id: "user-2",
      start_date: "2026-03-10",
      end_date: "2026-03-12",
      status: "pending",
    });
    const overlappingRequest = makeRequestWithEmployee({
      id: "lr-2",
      profile_id: "user-3",
      employee_name: "Charlie Davis",
      start_date: "2026-03-11",
      end_date: "2026-03-13",
      status: "approved",
    });

    render(
      <LeaveRequestTable
        currentUserId="user-1"
        isManager={true}
        requests={[request]}
        allRequests={[request, overlappingRequest]}
        teamMemberMap={{ "user-2": ["user-3"] }}
        showEmployee={true}
      />
    );
    expect(screen.getByText(/Charlie Davis/)).toBeInTheDocument();
    expect(screen.getByText(/also on leave during this period/)).toBeInTheDocument();
  });

  it("hides overlap notice when no overlapping leave", () => {
    const request = makeRequestWithEmployee({
      id: "lr-1",
      profile_id: "user-2",
      start_date: "2026-03-10",
      end_date: "2026-03-12",
    });

    render(
      <LeaveRequestTable
        currentUserId="user-1"
        requests={[request]}
        allRequests={[request]}
        teamMemberMap={{ "user-2": ["user-3"] }}
      />
    );
    expect(screen.queryByText(/also on leave/)).not.toBeInTheDocument();
  });

  // =============================================
  // Action button interactions
  // =============================================

  it("calls withdrawLeave when Withdraw is confirmed", async () => {
    const user = userEvent.setup();
    render(
      <LeaveRequestTable
        currentUserId="user-2"
        requests={[makeRequest({ id: "lr-1", profile_id: "user-2", status: "pending" })]}
      />
    );

    await user.click(screen.getByText("Withdraw"));

    // Confirmation dialog appears
    expect(await screen.findByText("Withdraw leave request?")).toBeInTheDocument();

    // Confirm withdrawal
    const dialogWithdraw = await screen.findByRole("button", { name: "Withdraw" });
    await user.click(dialogWithdraw);

    expect(mockWithdrawLeave).toHaveBeenCalledWith("lr-1");
  });

  it("calls approveLeave when Approve is confirmed", async () => {
    const user = userEvent.setup();
    render(
      <LeaveRequestTable
        currentUserId="user-1"
        isManager={true}
        requests={[makeRequest({ id: "lr-1", profile_id: "user-2", status: "pending" })]}
      />
    );

    await user.click(screen.getByText("Approve"));

    // Confirmation dialog appears
    expect(await screen.findByText("Approve leave request?")).toBeInTheDocument();

    // Confirm approval
    const dialogApprove = await screen.findByRole("button", { name: "Approve" });
    await user.click(dialogApprove);

    expect(mockApproveLeave).toHaveBeenCalledWith("lr-1");
  });

  it("calls rejectLeave with reason when Reject is confirmed", async () => {
    const user = userEvent.setup();
    render(
      <LeaveRequestTable
        currentUserId="user-1"
        isManager={true}
        requests={[makeRequest({ id: "lr-1", profile_id: "user-2", status: "pending" })]}
      />
    );

    await user.click(screen.getByText("Reject"));

    // Reject dialog appears with reason textarea
    expect(await screen.findByText("Reject Leave Request")).toBeInTheDocument();
    const reasonInput = screen.getByPlaceholderText("Enter rejection reason...");
    await user.type(reasonInput, "Insufficient notice");

    // Confirm rejection — scope to dialog
    const dialog = screen.getByRole("dialog", { name: "Reject Leave Request" });
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));

    expect(mockRejectLeave).toHaveBeenCalledWith("lr-1", "Insufficient notice");
  });

  it("disables Reject button when reason is empty", async () => {
    const user = userEvent.setup();
    render(
      <LeaveRequestTable
        currentUserId="user-1"
        isManager={true}
        requests={[makeRequest({ id: "lr-1", profile_id: "user-2", status: "pending" })]}
      />
    );

    await user.click(screen.getByText("Reject"));

    // Reject dialog appears — the destructive Reject button should be disabled
    const dialog = await screen.findByRole("dialog", { name: "Reject Leave Request" });
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();
  });

  it("calls cancelLeave when Cancel Leave is confirmed", async () => {
    const user = userEvent.setup();
    render(
      <LeaveRequestTable
        currentUserId="user-1"
        isHRAdmin={true}
        requests={[makeRequest({ id: "lr-1", profile_id: "user-2", status: "approved" })]}
      />
    );

    // Click Cancel in the table row
    const row = screen.getByText("Approved").closest("tr");
    await user.click(within(row!).getByRole("button", { name: "Cancel" }));

    // Confirmation dialog appears
    expect(await screen.findByText("Cancel approved leave?")).toBeInTheDocument();

    // Confirm cancellation
    const cancelLeaveBtn = await screen.findByRole("button", { name: "Cancel Leave" });
    await user.click(cancelLeaveBtn);

    expect(mockCancelLeave).toHaveBeenCalledWith("lr-1");
  });
});
