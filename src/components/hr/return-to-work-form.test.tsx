/**
 * Tests for ReturnToWorkForm component.
 *
 * Covers: status-dependent rendering (draft/submitted/locked/confirmed),
 * field editability, conditional sections, and action button visibility.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReturnToWorkForm } from "./return-to-work-form";
import type { AbsenceRecord, ReturnToWorkForm as RTWFormType } from "@/types/hr";

// Mock server actions
const mockCreateRTWForm = vi.fn().mockResolvedValue({ success: true, formId: "form-new" });
const mockSaveRTWForm = vi.fn().mockResolvedValue({ success: true });
const mockSubmitRTWForm = vi.fn().mockResolvedValue({ success: true });
const mockConfirmRTWForm = vi.fn().mockResolvedValue({ success: true });
const mockUnlockRTWForm = vi.fn().mockResolvedValue({ success: true });
const mockFetchTriggerPointStatus = vi.fn().mockResolvedValue({
  result: { reached: false, reason: null },
});

vi.mock("@/app/(protected)/hr/absence/actions", () => ({
  createRTWForm: (...args: unknown[]) => mockCreateRTWForm(...args),
  saveRTWForm: (...args: unknown[]) => mockSaveRTWForm(...args),
  submitRTWForm: (...args: unknown[]) => mockSubmitRTWForm(...args),
  confirmRTWForm: (...args: unknown[]) => mockConfirmRTWForm(...args),
  unlockRTWForm: (...args: unknown[]) => mockUnlockRTWForm(...args),
  fetchTriggerPointStatus: (...args: unknown[]) => mockFetchTriggerPointStatus(...args),
}));

function makeAbsence(overrides?: Partial<AbsenceRecord>): AbsenceRecord {
  return {
    id: "absence-1",
    profile_id: "employee-1",
    leave_request_id: null,
    absence_type: "sick_self_certified",
    start_date: "2026-02-01",
    end_date: "2026-02-05",
    total_days: 3,
    is_long_term: false,
    reason: "Flu",
    sickness_category: "cold_flu",
    fit_note_path: null,
    fit_note_file_name: null,
    recorded_by: "manager-1",
    created_at: "2026-02-01T09:00:00Z",
    updated_at: "2026-02-05T09:00:00Z",
    ...overrides,
  };
}

function makeForm(overrides?: Partial<RTWFormType>): RTWFormType {
  return {
    id: "form-1",
    absence_record_id: "absence-1",
    employee_id: "employee-1",
    completed_by: "manager-1",
    completed_at: "2026-02-06T09:00:00Z",
    absence_start_date: "2026-02-01",
    absence_end_date: "2026-02-05",
    discussion_date: null,
    reason_for_absence: null,
    is_work_related: false,
    is_pregnancy_related: false,
    has_underlying_cause: false,
    wellbeing_discussion: null,
    medical_advice_details: null,
    trigger_point_reached: false,
    trigger_point_details: null,
    procedures_followed: true,
    procedures_not_followed_reason: null,
    gp_clearance_received: false,
    adjustments_needed: null,
    phased_return_agreed: false,
    phased_return_details: null,
    follow_up_date: null,
    additional_notes: null,
    employee_comments: null,
    employee_confirmed: false,
    employee_confirmed_at: null,
    status: "draft",
    created_at: "2026-02-06T09:00:00Z",
    updated_at: "2026-02-06T09:00:00Z",
    ...overrides,
  };
}

const defaultProps = {
  absenceRecord: makeAbsence(),
  employeeName: "Alice Smith",
  existingForm: makeForm(),
  currentUserId: "manager-1",
  isHRAdmin: false,
  isManager: true,
  open: true,
  onOpenChange: vi.fn(),
};

describe("ReturnToWorkForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // Header and status display
  // =============================================

  it("renders employee name in header", () => {
    render(<ReturnToWorkForm {...defaultProps} />);
    expect(screen.getByText(/Return to Work — Alice Smith/)).toBeInTheDocument();
  });

  it("shows Draft status badge for draft forms", () => {
    render(<ReturnToWorkForm {...defaultProps} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows Submitted badge for submitted forms", () => {
    render(
      <ReturnToWorkForm
        {...defaultProps}
        existingForm={makeForm({ status: "submitted" })}
      />
    );
    expect(screen.getByText("Awaiting Confirmation")).toBeInTheDocument();
  });

  // =============================================
  // Field editability
  // =============================================

  it("shows editable fields for manager in draft status", () => {
    render(<ReturnToWorkForm {...defaultProps} />);
    // Save Draft button should be visible for editable form
    expect(screen.getByText("Save Draft")).toBeInTheDocument();
  });

  it("shows Submit button for manager in draft status", () => {
    render(<ReturnToWorkForm {...defaultProps} />);
    expect(screen.getByText("Submit for Employee Confirmation")).toBeInTheDocument();
  });

  it("shows confirm button for employee in submitted status", () => {
    render(
      <ReturnToWorkForm
        {...defaultProps}
        existingForm={makeForm({ status: "submitted" })}
        currentUserId="employee-1"
        isManager={false}
      />
    );
    expect(screen.getByText("I Confirm This Is Accurate")).toBeInTheDocument();
  });

  it("shows unlock button for HR admin on locked forms", () => {
    render(
      <ReturnToWorkForm
        {...defaultProps}
        existingForm={makeForm({ status: "locked" })}
        isHRAdmin={true}
        isManager={false}
      />
    );
    expect(screen.getByText("Unlock for Corrections")).toBeInTheDocument();
  });

  it("hides unlock button for non-HR on locked forms", () => {
    render(
      <ReturnToWorkForm
        {...defaultProps}
        existingForm={makeForm({ status: "locked" })}
        currentUserId="employee-1"
        isManager={false}
        isHRAdmin={false}
      />
    );
    expect(screen.queryByText("Unlock for Corrections")).not.toBeInTheDocument();
  });

  // =============================================
  // Conditional sections
  // =============================================

  it("shows fit note section when absence exceeds 7 calendar days", () => {
    render(
      <ReturnToWorkForm
        {...defaultProps}
        absenceRecord={makeAbsence({
          start_date: "2026-02-01",
          end_date: "2026-02-10", // 10 calendar days
        })}
      />
    );
    expect(screen.getByText(/GP Clearance/i)).toBeInTheDocument();
  });

  it("hides fit note section when absence is 7 days or fewer", () => {
    render(
      <ReturnToWorkForm
        {...defaultProps}
        absenceRecord={makeAbsence({
          start_date: "2026-02-01",
          end_date: "2026-02-05", // 5 calendar days
        })}
      />
    );
    expect(screen.queryByText(/GP Clearance/i)).not.toBeInTheDocument();
  });

  // =============================================
  // Employee confirmation display
  // =============================================

  it("shows confirmation notice when employee has confirmed", () => {
    render(
      <ReturnToWorkForm
        {...defaultProps}
        existingForm={makeForm({
          status: "locked",
          employee_confirmed: true,
          employee_confirmed_at: "2026-02-07T09:00:00Z",
        })}
      />
    );
    expect(screen.getByText(/Confirmed by employee/)).toBeInTheDocument();
  });

  // =============================================
  // Action button interactions
  // =============================================

  it("calls saveRTWForm when Save Draft is clicked", async () => {
    const user = userEvent.setup();
    render(<ReturnToWorkForm {...defaultProps} />);

    await user.click(screen.getByText("Save Draft"));

    expect(mockSaveRTWForm).toHaveBeenCalledWith(
      "form-1",
      expect.objectContaining({
        is_work_related: false,
        is_pregnancy_related: false,
      })
    );
  });

  it("shows submit confirmation dialog and calls submitRTWForm", async () => {
    const user = userEvent.setup();
    render(
      <ReturnToWorkForm
        {...defaultProps}
        existingForm={makeForm({ reason_for_absence: "Had the flu" })}
      />
    );

    await user.click(screen.getByText("Submit for Employee Confirmation"));

    // Confirmation dialog appears
    expect(await screen.findByText("Submit RTW Form?")).toBeInTheDocument();
    expect(screen.getByText(/will notify Alice Smith/)).toBeInTheDocument();

    // Confirm submission
    const submitBtn = await screen.findByRole("button", { name: "Submit" });
    await user.click(submitBtn);

    expect(mockSaveRTWForm).toHaveBeenCalled();
    expect(mockSubmitRTWForm).toHaveBeenCalledWith("form-1");
  });

  it("calls confirmRTWForm when employee confirms", async () => {
    const user = userEvent.setup();
    render(
      <ReturnToWorkForm
        {...defaultProps}
        existingForm={makeForm({ status: "submitted" })}
        currentUserId="employee-1"
        isManager={false}
      />
    );

    await user.click(screen.getByText("I Confirm This Is Accurate"));

    // Confirmation dialog appears
    expect(await screen.findByText("Confirm Return-to-Work Form")).toBeInTheDocument();

    // Confirm
    const confirmBtn = await screen.findByRole("button", { name: "Confirm" });
    await user.click(confirmBtn);

    expect(mockConfirmRTWForm).toHaveBeenCalledWith("form-1", undefined);
  });

  it("calls unlockRTWForm when HR admin unlocks", async () => {
    const user = userEvent.setup();
    render(
      <ReturnToWorkForm
        {...defaultProps}
        existingForm={makeForm({ status: "locked" })}
        isHRAdmin={true}
        isManager={false}
      />
    );

    await user.click(screen.getByText("Unlock for Corrections"));

    // Confirmation dialog appears
    expect(await screen.findByText("Unlock RTW Form?")).toBeInTheDocument();

    // Confirm unlock
    const unlockBtn = await screen.findByRole("button", { name: "Unlock" });
    await user.click(unlockBtn);

    expect(mockUnlockRTWForm).toHaveBeenCalledWith("form-1");
  });
});
