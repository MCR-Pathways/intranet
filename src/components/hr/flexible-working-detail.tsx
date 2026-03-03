"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FWR_STATUS_CONFIG,
  FWR_REQUEST_TYPE_CONFIG,
  FWR_REJECTION_GROUNDS,
  FWR_CONSULTATION_FORMAT_CONFIG,
  FWR_TRIAL_OUTCOME_CONFIG,
  WORK_PATTERN_CONFIG,
  formatHRDate,
} from "@/lib/hr";
import type { FWRStatus, FWRRequestType, FWRRejectionGround, FWRConsultationFormat } from "@/lib/hr";
import type { FlexibleWorkingRequest, FWRAppeal } from "@/types/hr";
import {
  withdrawFlexibleWorkingRequest,
  markRequestUnderReview,
  recordConsultation,
  approveFlexibleWorkingRequest,
  rejectFlexibleWorkingRequest,
  recordTrialOutcome,
  submitFWRAppeal,
  decideFWRAppeal,
} from "@/app/(protected)/hr/flexible-working/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FlexibleWorkingApproveDialog } from "./flexible-working-approve-dialog";
import { FlexibleWorkingRejectDialog } from "./flexible-working-reject-dialog";

interface FlexibleWorkingDetailProps {
  request: FlexibleWorkingRequest & {
    employee_name: string;
    employee_job_title: string | null;
    manager_name: string | null;
  };
  appeal: FWRAppeal | null;
  currentUserId: string;
  isHRAdmin: boolean;
  isOwner: boolean;
  isAssignedManager: boolean;
}

export function FlexibleWorkingDetail({
  request,
  appeal,
  currentUserId,
  isHRAdmin,
  isOwner,
  isAssignedManager,
}: FlexibleWorkingDetailProps) {
  const [isPending, startTransition] = useTransition();
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealDialogOpen, setAppealDialogOpen] = useState(false);
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [trialOutcomeOpen, setTrialOutcomeOpen] = useState(false);
  const [appealDecisionOpen, setAppealDecisionOpen] = useState(false);

  const status = request.status as FWRStatus;
  const statusConfig = FWR_STATUS_CONFIG[status];
  const typeConfig = FWR_REQUEST_TYPE_CONFIG[request.request_type as FWRRequestType];
  const canDecide = (isAssignedManager || isHRAdmin) && ["submitted", "under_review"].includes(status);
  const canWithdraw = isOwner && ["submitted", "under_review"].includes(status);
  const canAppeal = isOwner && status === "rejected";
  const canRecordTrialOutcome = (isAssignedManager || isHRAdmin) && status === "approved_trial";
  const canDecideAppeal = isHRAdmin && status === "appealed";

  // Deadline warning — Date.now() is intentionally impure (we need the current time)
  const deadlineDays = Math.ceil(
    // eslint-disable-next-line react-hooks/purity
    (new Date(request.response_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const isDeadlineActive = ["submitted", "under_review"].includes(status);

  const handleWithdraw = () => {
    startTransition(async () => {
      const result = await withdrawFlexibleWorkingRequest(request.id);
      if (result.success) {
        toast.success("Request withdrawn.");
        window.location.href = "/hr/flexible-working";
      } else {
        toast.error(result.error ?? "Failed to withdraw request.");
      }
    });
  };

  const handleMarkUnderReview = () => {
    startTransition(async () => {
      const result = await markRequestUnderReview(request.id);
      if (result.success) {
        toast.success("Request marked as under review.");
        window.location.reload();
      } else {
        toast.error(result.error ?? "Failed to update status.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        {status === "submitted" && canDecide && (
          <Button type="button" variant="outline" onClick={handleMarkUnderReview} disabled={isPending}>
            Mark as Under Review
          </Button>
        )}

        {canDecide && (
          <>
            <Button type="button" onClick={() => setApproveDialogOpen(true)} disabled={isPending}>
              Approve
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setRejectDialogOpen(true)}
              disabled={isPending}
            >
              Reject
            </Button>
          </>
        )}

        {canWithdraw && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Withdraw Request
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Withdraw Request</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to withdraw this flexible working request?
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleWithdraw}>Withdraw</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {canAppeal && (
          <Button type="button" variant="outline" onClick={() => setAppealDialogOpen(true)} disabled={isPending}>
            Appeal Decision
          </Button>
        )}

        {canRecordTrialOutcome && (
          <Button type="button" onClick={() => setTrialOutcomeOpen(true)} disabled={isPending}>
            Record Trial Outcome
          </Button>
        )}

        {canDecideAppeal && (
          <Button type="button" onClick={() => setAppealDecisionOpen(true)} disabled={isPending}>
            Decide Appeal
          </Button>
        )}
      </div>

      {/* Request Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Request Summary</CardTitle>
            {statusConfig && (
              <Badge
                variant="outline"
                className={cn(statusConfig.colour, statusConfig.bgColour, "border-0")}
              >
                {statusConfig.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Employee</p>
              <p className="text-sm">{request.employee_name}</p>
              {request.employee_job_title && (
                <p className="text-xs text-muted-foreground">{request.employee_job_title}</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Line Manager</p>
              <p className="text-sm">{request.manager_name ?? "Not assigned"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Request Type</p>
              <p className="text-sm">{typeConfig?.label ?? request.request_type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Proposed Start Date</p>
              <p className="text-sm">{formatHRDate(request.proposed_start_date)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Submitted</p>
              <p className="text-sm">{formatHRDate(request.created_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Response Deadline</p>
              <p
                className={cn(
                  "text-sm",
                  isDeadlineActive && deadlineDays < 0 && "font-semibold text-red-600",
                  isDeadlineActive && deadlineDays >= 0 && deadlineDays <= 14 && "font-medium text-amber-600",
                )}
              >
                {formatHRDate(request.response_deadline)}
                {isDeadlineActive && deadlineDays < 0 && " (overdue)"}
                {isDeadlineActive && deadlineDays >= 0 && deadlineDays <= 14 && ` (${deadlineDays} days left)`}
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium text-muted-foreground">Current Working Pattern</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{request.current_working_pattern}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Requested Working Pattern</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{request.requested_working_pattern}</p>
          </div>

          {request.reason && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Reason</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{request.reason}</p>
            </div>
          )}

          {request.previous_work_pattern && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Previous Work Pattern (System)</p>
              <p className="text-sm">
                {WORK_PATTERN_CONFIG[request.previous_work_pattern as keyof typeof WORK_PATTERN_CONFIG]?.label ?? request.previous_work_pattern}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consultation Record */}
      {(request.consultation_date || canDecide) && (
        <Card>
          <CardHeader>
            <CardTitle>Consultation Meeting</CardTitle>
          </CardHeader>
          <CardContent>
            {request.consultation_date ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="text-sm">{formatHRDate(request.consultation_date)}</p>
                </div>
                {request.consultation_format && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Format</p>
                    <p className="text-sm">
                      {FWR_CONSULTATION_FORMAT_CONFIG[request.consultation_format as FWRConsultationFormat]?.label ?? request.consultation_format}
                    </p>
                  </div>
                )}
                {request.consultation_attendees && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Attendees</p>
                    <p className="text-sm">{request.consultation_attendees}</p>
                  </div>
                )}
                {request.consultation_summary && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Discussion Summary</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{request.consultation_summary}</p>
                  </div>
                )}
                {request.consultation_alternatives && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Alternatives Explored</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{request.consultation_alternatives}</p>
                  </div>
                )}
              </div>
            ) : canDecide ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No consultation meeting has been recorded yet. You must consult with the employee
                  before making a decision (Acas Code of Practice).
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConsultationOpen(true)}
                  disabled={isPending}
                >
                  Record Consultation
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Decision */}
      {request.decided_at && (
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Decision Date</p>
                <p className="text-sm">{formatHRDate(request.decided_at)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Outcome</p>
                {statusConfig && (
                  <Badge
                    variant="outline"
                    className={cn(statusConfig.colour, statusConfig.bgColour, "border-0")}
                  >
                    {statusConfig.label}
                  </Badge>
                )}
              </div>
            </div>

            {request.decision_notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Decision Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{request.decision_notes}</p>
              </div>
            )}

            {/* Rejection details */}
            {request.rejection_grounds && request.rejection_grounds.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Statutory Grounds for Refusal</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {request.rejection_grounds.map((ground) => (
                    <li key={ground} className="text-sm">
                      {FWR_REJECTION_GROUNDS[ground as FWRRejectionGround] ?? ground}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {request.rejection_explanation && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Explanation of Reasonableness
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{request.rejection_explanation}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Trial Period */}
      {(status === "approved_trial" || request.trial_end_date) && (
        <Card>
          <CardHeader>
            <CardTitle>Trial Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Trial End Date</p>
                <p className="text-sm">{formatHRDate(request.trial_end_date!)}</p>
              </div>
              {request.trial_outcome && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Outcome</p>
                  <p className="text-sm">
                    {FWR_TRIAL_OUTCOME_CONFIG[request.trial_outcome as keyof typeof FWR_TRIAL_OUTCOME_CONFIG]?.label ?? request.trial_outcome}
                  </p>
                </div>
              )}
              {request.trial_outcome_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Outcome Recorded</p>
                  <p className="text-sm">{formatHRDate(request.trial_outcome_at)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appeal */}
      {appeal && (
        <Card>
          <CardHeader>
            <CardTitle>Appeal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Appeal Reason</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{appeal.appeal_reason}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Appealed On</p>
              <p className="text-sm">{formatHRDate(appeal.appealed_at)}</p>
            </div>
            {appeal.meeting_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Appeal Meeting</p>
                <p className="text-sm">{formatHRDate(appeal.meeting_date)}</p>
              </div>
            )}
            {appeal.meeting_notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Meeting Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{appeal.meeting_notes}</p>
              </div>
            )}
            {appeal.outcome && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Outcome</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-0",
                    appeal.outcome === "upheld" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700",
                  )}
                >
                  {appeal.outcome === "upheld" ? "Original Decision Upheld" : "Decision Overturned"}
                </Badge>
              </div>
            )}
            {appeal.outcome_notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Outcome Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{appeal.outcome_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <FlexibleWorkingApproveDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        requestId={request.id}
      />

      <FlexibleWorkingRejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        requestId={request.id}
        hasConsultation={!!request.consultation_date}
      />

      <ConsultationDialog
        open={consultationOpen}
        onOpenChange={setConsultationOpen}
        requestId={request.id}
      />

      <AppealDialog
        open={appealDialogOpen}
        onOpenChange={setAppealDialogOpen}
        requestId={request.id}
      />

      <TrialOutcomeDialog
        open={trialOutcomeOpen}
        onOpenChange={setTrialOutcomeOpen}
        requestId={request.id}
      />

      <AppealDecisionDialog
        open={appealDecisionOpen}
        onOpenChange={setAppealDecisionOpen}
        requestId={request.id}
      />
    </div>
  );
}

// =============================================
// CONSULTATION DIALOG
// =============================================

function ConsultationDialog({
  open,
  onOpenChange,
  requestId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [format, setFormat] = useState("");
  const [attendees, setAttendees] = useState("");
  const [summary, setSummary] = useState("");
  const [alternatives, setAlternatives] = useState("");

  const resetForm = () => {
    setDate("");
    setFormat("");
    setAttendees("");
    setSummary("");
    setAlternatives("");
  };

  const handleSubmit = () => {
    if (!date || !summary.trim()) return;

    startTransition(async () => {
      const result = await recordConsultation(requestId, {
        consultation_date: date,
        consultation_format: format || null,
        consultation_attendees: attendees.trim() || null,
        consultation_summary: summary.trim(),
        consultation_alternatives: alternatives.trim() || null,
      });

      if (result.success) {
        toast.success("Consultation meeting recorded.");
        resetForm();
        onOpenChange(false);
        window.location.reload();
      } else {
        toast.error(result.error ?? "Failed to record consultation.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetForm(); onOpenChange(next); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Consultation Meeting</DialogTitle>
          <DialogDescription>
            Record the details of the consultation meeting with the employee
            (required before making a decision).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="consult-date">Meeting Date *</Label>
              <Input
                id="consult-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consult-format">Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="consult-format">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FWR_CONSULTATION_FORMAT_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="consult-attendees">Attendees</Label>
            <Input
              id="consult-attendees"
              placeholder="e.g. Employee, Line Manager, HR Representative"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="consult-summary">Discussion Summary *</Label>
            <Textarea
              id="consult-summary"
              placeholder="Summarise the key points discussed..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="consult-alternatives">Alternatives Explored</Label>
            <Textarea
              id="consult-alternatives"
              placeholder="Note any alternative arrangements discussed..."
              value={alternatives}
              onChange={(e) => setAlternatives(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!date || !summary.trim() || isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// APPEAL DIALOG (employee submits appeal)
// =============================================

function AppealDialog({
  open,
  onOpenChange,
  requestId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (!reason.trim()) return;

    startTransition(async () => {
      const result = await submitFWRAppeal(requestId, reason);
      if (result.success) {
        toast.success("Appeal submitted. HR will review your case.");
        setReason("");
        onOpenChange(false);
        window.location.reload();
      } else {
        toast.error(result.error ?? "Failed to submit appeal.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setReason(""); onOpenChange(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appeal Decision</DialogTitle>
          <DialogDescription>
            Explain why you believe the decision should be reconsidered.
            Your appeal will be reviewed by HR.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="appeal-reason">Reason for Appeal *</Label>
          <Textarea
            id="appeal-reason"
            placeholder="Explain your grounds for appeal..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!reason.trim() || isPending}>
            {isPending ? "Submitting..." : "Submit Appeal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// TRIAL OUTCOME DIALOG
// =============================================

function TrialOutcomeDialog({
  open,
  onOpenChange,
  requestId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [extendedDate, setExtendedDate] = useState("");

  const resetForm = () => {
    setOutcome("");
    setNotes("");
    setExtendedDate("");
  };

  const handleSubmit = () => {
    if (!outcome) return;
    if (outcome === "extended" && !extendedDate) return;

    startTransition(async () => {
      const result = await recordTrialOutcome(requestId, {
        outcome,
        notes: notes.trim() || undefined,
        extended_end_date: outcome === "extended" ? extendedDate : undefined,
      });

      if (result.success) {
        toast.success("Trial outcome recorded.");
        resetForm();
        onOpenChange(false);
        window.location.reload();
      } else {
        toast.error(result.error ?? "Failed to record outcome.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetForm(); onOpenChange(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Trial Outcome</DialogTitle>
          <DialogDescription>
            Record the outcome of the flexible working trial period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Outcome *</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue placeholder="Select outcome..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FWR_TRIAL_OUTCOME_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {outcome === "extended" && (
            <div className="space-y-2">
              <Label htmlFor="trial-extended-date">New End Date *</Label>
              <Input
                id="trial-extended-date"
                type="date"
                value={extendedDate}
                onChange={(e) => setExtendedDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="trial-notes">Notes</Label>
            <Textarea
              id="trial-notes"
              placeholder="Add any relevant notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!outcome || (outcome === "extended" && !extendedDate) || isPending}
          >
            {isPending ? "Saving..." : "Save Outcome"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// APPEAL DECISION DIALOG (HR admin)
// =============================================

function AppealDecisionDialog({
  open,
  onOpenChange,
  requestId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<"upheld" | "overturned" | "">("");
  const [notes, setNotes] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");

  const resetForm = () => {
    setOutcome("");
    setNotes("");
    setMeetingDate("");
    setMeetingNotes("");
  };

  const handleSubmit = () => {
    if (!outcome) return;

    startTransition(async () => {
      const result = await decideFWRAppeal(requestId, {
        outcome: outcome as "upheld" | "overturned",
        outcome_notes: notes.trim() || undefined,
        meeting_date: meetingDate || undefined,
        meeting_notes: meetingNotes.trim() || undefined,
      });

      if (result.success) {
        toast.success("Appeal decision recorded.");
        resetForm();
        onOpenChange(false);
        window.location.reload();
      } else {
        toast.error(result.error ?? "Failed to record decision.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetForm(); onOpenChange(next); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Decide Appeal</DialogTitle>
          <DialogDescription>
            Review the appeal and record your decision.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Decision *</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as "upheld" | "overturned")}>
              <SelectTrigger>
                <SelectValue placeholder="Select decision..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overturned">Overturn — Approve the Request</SelectItem>
                <SelectItem value="upheld">Uphold — Maintain Original Rejection</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appeal-meeting-date">Appeal Meeting Date</Label>
            <Input
              id="appeal-meeting-date"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appeal-meeting-notes">Meeting Notes</Label>
            <Textarea
              id="appeal-meeting-notes"
              placeholder="Record the key points from the appeal meeting..."
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appeal-outcome-notes">Decision Notes</Label>
            <Textarea
              id="appeal-outcome-notes"
              placeholder="Explain the reasoning behind your decision..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!outcome || isPending}>
            {isPending ? "Saving..." : "Record Decision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

