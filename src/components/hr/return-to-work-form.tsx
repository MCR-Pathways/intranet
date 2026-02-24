"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ABSENCE_TYPE_CONFIG,
  SICKNESS_CATEGORY_CONFIG,
  RTW_STATUS_CONFIG,
  FIT_NOTE_REQUIRED_AFTER_DAYS,
  formatHRDate,
  formatLeaveDays,
} from "@/lib/hr";
import type { AbsenceRecord, ReturnToWorkForm as RTWFormType, RTWStatus } from "@/types/hr";
import {
  createRTWForm,
  saveRTWForm,
  submitRTWForm,
  confirmRTWForm,
  unlockRTWForm,
  fetchTriggerPointStatus,
} from "@/app/(protected)/hr/absence/actions";
import { AlertTriangle, CheckCircle2, Info, Loader2, Lock, Unlock } from "lucide-react";

interface ReturnToWorkFormProps {
  absenceRecord: AbsenceRecord;
  employeeName: string;
  existingForm: RTWFormType | null;
  currentUserId: string;
  isHRAdmin: boolean;
  isManager: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReturnToWorkForm({
  absenceRecord,
  employeeName,
  existingForm,
  currentUserId,
  isHRAdmin,
  isManager,
  open,
  onOpenChange,
}: ReturnToWorkFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formId, setFormId] = useState<string | null>(existingForm?.id ?? null);
  const [status, setStatus] = useState<RTWStatus>(existingForm?.status ?? "draft");

  // Form fields
  const [discussionDate, setDiscussionDate] = useState(existingForm?.discussion_date ?? "");
  const [reasonForAbsence, setReasonForAbsence] = useState(existingForm?.reason_for_absence ?? "");
  const [isWorkRelated, setIsWorkRelated] = useState(existingForm?.is_work_related ?? false);
  const [isPregnancyRelated, setIsPregnancyRelated] = useState(existingForm?.is_pregnancy_related ?? false);
  const [hasUnderlyingCause, setHasUnderlyingCause] = useState(existingForm?.has_underlying_cause ?? false);
  const [wellbeingDiscussion, setWellbeingDiscussion] = useState(existingForm?.wellbeing_discussion ?? "");
  const [medicalAdviceDetails, setMedicalAdviceDetails] = useState(existingForm?.medical_advice_details ?? "");
  const [gpClearanceReceived, setGpClearanceReceived] = useState(existingForm?.gp_clearance_received ?? false);
  const [adjustmentsNeeded, setAdjustmentsNeeded] = useState(existingForm?.adjustments_needed ?? "");
  const [phasedReturnAgreed, setPhasedReturnAgreed] = useState(existingForm?.phased_return_agreed ?? false);
  const [phasedReturnDetails, setPhasedReturnDetails] = useState(existingForm?.phased_return_details ?? "");
  const [triggerPointReached, setTriggerPointReached] = useState(existingForm?.trigger_point_reached ?? false);
  const [triggerPointDetails, setTriggerPointDetails] = useState(existingForm?.trigger_point_details ?? "");
  const [proceduresFollowed, setProceduresFollowed] = useState(existingForm?.procedures_followed ?? true);
  const [proceduresNotFollowedReason, setProceduresNotFollowedReason] = useState(existingForm?.procedures_not_followed_reason ?? "");
  const [followUpDate, setFollowUpDate] = useState(existingForm?.follow_up_date ?? "");
  const [additionalNotes, setAdditionalNotes] = useState(existingForm?.additional_notes ?? "");
  const [employeeComments, setEmployeeComments] = useState(existingForm?.employee_comments ?? "");
  const [triggerLoading, setTriggerLoading] = useState(!existingForm);

  // Computed values
  const calendarDays = (() => {
    const start = new Date(absenceRecord.start_date + "T00:00:00");
    const end = new Date(absenceRecord.end_date + "T00:00:00");
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  })();
  const needsFitNote = calendarDays > FIT_NOTE_REQUIRED_AFTER_DAYS;

  const isEditable = status === "draft" && (isManager || isHRAdmin);
  const isEmployee = currentUserId === absenceRecord.profile_id;
  const canConfirm = status === "submitted" && isEmployee;
  const canUnlock = (status === "locked" || status === "submitted" || status === "confirmed") && isHRAdmin;

  // Auto-create draft if no existing form
  useEffect(() => {
    if (!open || existingForm || formId) return;

    startTransition(async () => {
      const result = await createRTWForm(absenceRecord.id);
      if (result.success && result.formId) {
        setFormId(result.formId);
        setStatus("draft");
      } else {
        setError(result.error);
        // If form already exists, use the returned formId
        if (result.formId) {
          setFormId(result.formId);
        }
      }
    });
  }, [open, existingForm, formId, absenceRecord.id]);

  // Auto-fetch trigger point status for new forms
  useEffect(() => {
    if (!open || existingForm) return;

    fetchTriggerPointStatus(absenceRecord.profile_id, absenceRecord.id).then(({ result }) => {
      setTriggerPointReached(result.reached);
      setTriggerPointDetails(result.reason ?? "");
      setTriggerLoading(false);
    });
  }, [open, existingForm, absenceRecord.profile_id, absenceRecord.id]);

  const handleSaveDraft = useCallback(() => {
    if (!formId) return;
    setError(null);

    startTransition(async () => {
      const result = await saveRTWForm(formId, {
        discussion_date: discussionDate || null,
        reason_for_absence: reasonForAbsence || null,
        is_work_related: isWorkRelated,
        is_pregnancy_related: isPregnancyRelated,
        has_underlying_cause: hasUnderlyingCause,
        wellbeing_discussion: wellbeingDiscussion || null,
        medical_advice_details: medicalAdviceDetails || null,
        gp_clearance_received: gpClearanceReceived,
        adjustments_needed: adjustmentsNeeded || null,
        phased_return_agreed: phasedReturnAgreed,
        phased_return_details: phasedReturnDetails || null,
        trigger_point_reached: triggerPointReached,
        trigger_point_details: triggerPointDetails || null,
        procedures_followed: proceduresFollowed,
        procedures_not_followed_reason: proceduresNotFollowedReason || null,
        follow_up_date: followUpDate || null,
        additional_notes: additionalNotes || null,
      });

      if (result.success) {
        setSuccess("Draft saved");
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError(result.error);
      }
    });
  }, [formId, discussionDate, reasonForAbsence, isWorkRelated, isPregnancyRelated, hasUnderlyingCause, wellbeingDiscussion, medicalAdviceDetails, gpClearanceReceived, adjustmentsNeeded, phasedReturnAgreed, phasedReturnDetails, triggerPointReached, triggerPointDetails, proceduresFollowed, proceduresNotFollowedReason, followUpDate, additionalNotes]);

  function handleSubmit() {
    if (!formId) return;
    if (!reasonForAbsence.trim()) {
      setError("Reason for absence is required before submitting");
      return;
    }
    setError(null);

    startTransition(async () => {
      // Save all fields first
      await saveRTWForm(formId, {
        discussion_date: discussionDate || null,
        reason_for_absence: reasonForAbsence || null,
        is_work_related: isWorkRelated,
        is_pregnancy_related: isPregnancyRelated,
        has_underlying_cause: hasUnderlyingCause,
        wellbeing_discussion: wellbeingDiscussion || null,
        medical_advice_details: medicalAdviceDetails || null,
        gp_clearance_received: gpClearanceReceived,
        adjustments_needed: adjustmentsNeeded || null,
        phased_return_agreed: phasedReturnAgreed,
        phased_return_details: phasedReturnDetails || null,
        trigger_point_reached: triggerPointReached,
        trigger_point_details: triggerPointDetails || null,
        procedures_followed: proceduresFollowed,
        procedures_not_followed_reason: proceduresNotFollowedReason || null,
        follow_up_date: followUpDate || null,
        additional_notes: additionalNotes || null,
      });

      // Then submit
      const result = await submitRTWForm(formId);
      if (result.success) {
        setStatus("submitted");
        setSuccess("Form submitted. Employee has been notified.");
      } else {
        setError(result.error);
      }
    });
  }

  function handleConfirm() {
    if (!formId) return;
    setError(null);

    startTransition(async () => {
      const result = await confirmRTWForm(formId, employeeComments || undefined);
      if (result.success) {
        setStatus("locked");
        setSuccess("Form confirmed and locked. Thank you.");
      } else {
        setError(result.error);
      }
    });
  }

  function handleUnlock() {
    if (!formId) return;
    setError(null);

    startTransition(async () => {
      const result = await unlockRTWForm(formId);
      if (result.success) {
        setStatus("draft");
        setSuccess("Form unlocked for corrections");
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError(result.error);
      }
    });
  }

  const statusConfig = RTW_STATUS_CONFIG[status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <SheetTitle>Return to Work — {employeeName}</SheetTitle>
            <Badge className={`${statusConfig.bgColour} ${statusConfig.colour} border-0`}>
              {statusConfig.label}
            </Badge>
          </div>
          <SheetDescription>
            Return-to-work discussion form for absence {formatHRDate(absenceRecord.start_date)} – {formatHRDate(absenceRecord.end_date)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Section 1: Absence Summary (read-only) */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Absence Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Dates:</span>{" "}
                {formatHRDate(absenceRecord.start_date)} – {formatHRDate(absenceRecord.end_date)}
              </div>
              <div>
                <span className="text-muted-foreground">Working days:</span>{" "}
                {formatLeaveDays(absenceRecord.total_days)}
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>{" "}
                {ABSENCE_TYPE_CONFIG[absenceRecord.absence_type]?.label ?? absenceRecord.absence_type}
              </div>
              {absenceRecord.sickness_category && (
                <div>
                  <span className="text-muted-foreground">Category:</span>{" "}
                  {SICKNESS_CATEGORY_CONFIG[absenceRecord.sickness_category]?.label ?? absenceRecord.sickness_category}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Calendar days:</span> {calendarDays}
                {absenceRecord.is_long_term && (
                  <Badge variant="outline" className="ml-2 text-amber-700 border-amber-300">Long-term</Badge>
                )}
              </div>
              {needsFitNote && (
                <div>
                  <span className="text-muted-foreground">Fit note required:</span>{" "}
                  <span className="text-amber-700 font-medium">Yes (7+ calendar days)</span>
                </div>
              )}
            </div>
          </section>

          <hr />

          {/* Section 2: Preparation & Wellbeing Discussion */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Wellbeing Discussion
            </h3>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Date of Discussion</Label>
                <Input
                  type="date"
                  value={discussionDate}
                  onChange={(e) => setDiscussionDate(e.target.value)}
                  disabled={!isEditable}
                />
              </div>

              <div className="grid gap-2">
                <Label>Reason for Absence *</Label>
                <Textarea
                  value={reasonForAbsence}
                  onChange={(e) => setReasonForAbsence(e.target.value)}
                  placeholder="Discuss the reason for the absence"
                  rows={2}
                  disabled={!isEditable}
                />
              </div>

              <div className="grid gap-2">
                <Label>How are you feeling? Discussion notes</Label>
                <Textarea
                  value={wellbeingDiscussion}
                  onChange={(e) => setWellbeingDiscussion(e.target.value)}
                  placeholder="Notes from the wellbeing discussion"
                  rows={3}
                  disabled={!isEditable}
                />
              </div>

              <div className="grid gap-2">
                <Label>Medical advice sought/shared</Label>
                <Textarea
                  value={medicalAdviceDetails}
                  onChange={(e) => setMedicalAdviceDetails(e.target.value)}
                  placeholder="Any medical advice the employee is happy to share, including adjustments"
                  rows={2}
                  disabled={!isEditable}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="work-related"
                    checked={isWorkRelated}
                    onCheckedChange={(checked) => setIsWorkRelated(checked === true)}
                    disabled={!isEditable}
                  />
                  <Label htmlFor="work-related" className="font-normal">Was the absence work-related?</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pregnancy-related"
                    checked={isPregnancyRelated}
                    onCheckedChange={(checked) => setIsPregnancyRelated(checked === true)}
                    disabled={!isEditable}
                  />
                  <Label htmlFor="pregnancy-related" className="font-normal">Was the absence pregnancy-related?</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="underlying-cause"
                    checked={hasUnderlyingCause}
                    onCheckedChange={(checked) => setHasUnderlyingCause(checked === true)}
                    disabled={!isEditable}
                  />
                  <Label htmlFor="underlying-cause" className="font-normal">Was there any underlying cause for the absence?</Label>
                </div>
              </div>
            </div>
          </section>

          <hr />

          {/* Section 3: Return Assessment */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Return Assessment
            </h3>
            <div className="space-y-4">
              {needsFitNote && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="gp-clearance"
                    checked={gpClearanceReceived}
                    onCheckedChange={(checked) => setGpClearanceReceived(checked === true)}
                    disabled={!isEditable}
                  />
                  <Label htmlFor="gp-clearance" className="font-normal">Fit note / GP clearance received?</Label>
                </div>
              )}

              <div className="grid gap-2">
                <Label>Adjustments or support needed</Label>
                <Textarea
                  value={adjustmentsNeeded}
                  onChange={(e) => setAdjustmentsNeeded(e.target.value)}
                  placeholder="Any workplace adjustments required"
                  rows={2}
                  disabled={!isEditable}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="phased-return"
                  checked={phasedReturnAgreed}
                  onCheckedChange={(checked) => setPhasedReturnAgreed(checked === true)}
                  disabled={!isEditable}
                />
                <Label htmlFor="phased-return" className="font-normal">Phased return agreed?</Label>
              </div>

              {phasedReturnAgreed && (
                <div className="grid gap-2">
                  <Label>Phased return details</Label>
                  <Textarea
                    value={phasedReturnDetails}
                    onChange={(e) => setPhasedReturnDetails(e.target.value)}
                    placeholder="Details of the phased return arrangement"
                    rows={2}
                    disabled={!isEditable}
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label>Follow-up date</Label>
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  disabled={!isEditable}
                />
              </div>
            </div>
          </section>

          <hr />

          {/* Section 4: Trigger Points */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Trigger Points
            </h3>
            {triggerLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating trigger point status...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="trigger-reached"
                    checked={triggerPointReached}
                    onCheckedChange={(checked) => setTriggerPointReached(checked === true)}
                    disabled={!isEditable}
                  />
                  <Label htmlFor="trigger-reached" className="font-normal">
                    Has the employee reached a trigger point?
                  </Label>
                </div>

                {triggerPointReached && (
                  <>
                    <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{triggerPointDetails || "Trigger point reached. Please provide details below."}</span>
                    </div>
                    <div className="grid gap-2">
                      <Label>Trigger point details / next steps</Label>
                      <Textarea
                        value={triggerPointDetails}
                        onChange={(e) => setTriggerPointDetails(e.target.value)}
                        placeholder="e.g. Attendance review meeting to be scheduled"
                        rows={2}
                        disabled={!isEditable}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          <hr />

          {/* Section 5: Procedures */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Procedures
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="procedures-followed"
                  checked={proceduresFollowed}
                  onCheckedChange={(checked) => setProceduresFollowed(checked === true)}
                  disabled={!isEditable}
                />
                <Label htmlFor="procedures-followed" className="font-normal">
                  Were absence reporting/certification procedures followed?
                </Label>
              </div>

              {!proceduresFollowed && (
                <div className="grid gap-2">
                  <Label>Why were procedures not followed?</Label>
                  <Textarea
                    value={proceduresNotFollowedReason}
                    onChange={(e) => setProceduresNotFollowedReason(e.target.value)}
                    placeholder="Explain why procedures were not followed"
                    rows={2}
                    disabled={!isEditable}
                  />
                </div>
              )}
            </div>
          </section>

          <hr />

          {/* Section 6: Additional Notes */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Summary & Additional Notes
            </h3>
            <Textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Summary of discussion, including any adjustments or phased return arrangements agreed"
              rows={3}
              disabled={!isEditable}
            />
          </section>

          <hr />

          {/* Section 7: Employee Comments */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Employee Comments
            </h3>
            {canConfirm ? (
              <Textarea
                value={employeeComments}
                onChange={(e) => setEmployeeComments(e.target.value)}
                placeholder="Add any comments before confirming (optional)"
                rows={2}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {existingForm?.employee_comments || (status === "draft" ? "Employee can add comments after form is submitted." : "No comments from employee.")}
              </p>
            )}
          </section>

          {/* Employee confirmation section */}
          {existingForm?.employee_confirmed && (
            <div className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Confirmed by employee on {formatHRDate(existingForm.employee_confirmed_at)}
              </span>
            </div>
          )}

          {/* Declaration (visible when employee is confirming) */}
          {canConfirm && (
            <div className="flex items-start gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                By clicking &quot;I Confirm This Is Accurate&quot;, you confirm that the information in this form is accurate.
                You understand that giving false information regarding your absence from work may result in disciplinary action.
              </span>
            </div>
          )}

          {/* Error / Success messages */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>

        <SheetFooter className="border-t pt-4">
          {/* Draft actions (manager/HR) */}
          {isEditable && (
            <div className="flex w-full gap-2 justify-end">
              <Button variant="outline" onClick={handleSaveDraft} disabled={isPending || !formId}>
                {isPending ? "Saving..." : "Save Draft"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isPending || !formId || !reasonForAbsence.trim()}>
                    Submit for Employee Confirmation
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit RTW Form?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will notify {employeeName} to review and confirm the form. You will not be able to edit it after submission unless HR unlocks it.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit}>Submit</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Employee confirmation action */}
          {canConfirm && (
            <div className="flex w-full gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    I Confirm This Is Accurate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Return-to-Work Form</AlertDialogTitle>
                    <AlertDialogDescription>
                      By confirming, you acknowledge that the information in this form is accurate. This form will be locked after confirmation.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* HR unlock action */}
          {canUnlock && (
            <div className="flex w-full gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={isPending}>
                    <Unlock className="h-4 w-4 mr-2" />
                    Unlock for Corrections
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unlock RTW Form?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reset the form to draft state and clear the employee&apos;s confirmation. The manager will need to resubmit and the employee will need to confirm again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUnlock}>Unlock</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Read-only close (submitted state, non-employee, non-HR) */}
          {status === "submitted" && !canConfirm && !canUnlock && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}

          {/* Locked view for non-HR users */}
          {status === "locked" && !canUnlock && (
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                Form locked
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
