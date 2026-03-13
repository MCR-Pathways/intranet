"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  ABSENCE_TYPE_CONFIG,
  SICKNESS_CATEGORY_CONFIG,
  RTW_STATUS_CONFIG,
  formatHRDate,
  formatLeaveDays,
} from "@/lib/hr";
import { confirmRTWForm } from "@/app/(protected)/hr/absence/actions";
import type { ReturnToWorkForm, AbsenceRecord, RTWStatus } from "@/types/hr";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lock,
} from "lucide-react";

interface RTWConfirmationContentProps {
  form: ReturnToWorkForm;
  absence: AbsenceRecord | null;
  isEmployee: boolean;
}

export function RTWConfirmationContent({
  form,
  absence,
  isEmployee,
}: RTWConfirmationContentProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<RTWStatus>(form.status);
  const [employeeComments, setEmployeeComments] = useState(form.employee_comments ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const statusConfig = RTW_STATUS_CONFIG[status];
  const canConfirm = status === "submitted" && isEmployee;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmRTWForm(form.id, employeeComments || undefined);
      if (result.success) {
        setStatus("locked");
        setSuccess("Form confirmed and locked. Thank you.");
      } else {
        setError(result.error);
      }
    });
  }

  // Already confirmed/locked
  if (status === "locked" || status === "confirmed") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 className="h-12 w-12 text-green-600 mb-4" />
          <h2 className="text-lg font-semibold">Form Confirmed</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This return-to-work form has been confirmed
            {form.employee_confirmed_at && ` on ${formatHRDate(form.employee_confirmed_at)}`}.
          </p>
          {form.employee_comments && (
            <div className="mt-4 rounded-md bg-muted p-3 text-sm max-w-md">
              <p className="font-medium text-xs text-muted-foreground mb-1">Your comments:</p>
              <p>{form.employee_comments}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Draft — not ready for employee yet
  if (status === "draft") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Info className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold">Form Not Ready</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This return-to-work form is still being prepared by your manager.
            You will be notified when it is ready for your review.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Submitted — ready for employee confirmation
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Badge variant={statusConfig.badgeVariant}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Absence Summary */}
      {absence && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Absence Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Dates:</span>{" "}
                {formatHRDate(absence.start_date)} – {formatHRDate(absence.end_date)}
              </div>
              <div>
                <span className="text-muted-foreground">Working days:</span>{" "}
                {formatLeaveDays(absence.total_days)}
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>{" "}
                {ABSENCE_TYPE_CONFIG[absence.absence_type as keyof typeof ABSENCE_TYPE_CONFIG]?.label ?? absence.absence_type}
              </div>
              {absence.sickness_category && (
                <div>
                  <span className="text-muted-foreground">Category:</span>{" "}
                  {SICKNESS_CATEGORY_CONFIG[absence.sickness_category as keyof typeof SICKNESS_CATEGORY_CONFIG]?.label ?? absence.sickness_category}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discussion Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Discussion Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.discussion_date && (
            <ReadOnlyField label="Discussion Date" value={formatHRDate(form.discussion_date)} />
          )}
          {form.reason_for_absence && (
            <ReadOnlyField label="Reason for Absence" value={form.reason_for_absence} />
          )}
          {form.wellbeing_discussion && (
            <ReadOnlyField label="Wellbeing Discussion" value={form.wellbeing_discussion} />
          )}
          {form.medical_advice_details && (
            <ReadOnlyField label="Medical Advice" value={form.medical_advice_details} />
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {form.is_work_related && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span>Work-related</span>
              </div>
            )}
            {form.is_pregnancy_related && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span>Pregnancy-related</span>
              </div>
            )}
            {form.has_underlying_cause && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span>Underlying cause</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Return Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Return Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.gp_clearance_received && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>GP clearance / fit note received</span>
            </div>
          )}
          {form.adjustments_needed && (
            <ReadOnlyField label="Adjustments Needed" value={form.adjustments_needed} />
          )}
          {form.phased_return_agreed && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Phased return agreed</span>
              </div>
              {form.phased_return_details && (
                <ReadOnlyField label="Phased Return Details" value={form.phased_return_details} />
              )}
            </>
          )}
          {form.follow_up_date && (
            <ReadOnlyField label="Follow-up Date" value={formatHRDate(form.follow_up_date)} />
          )}
        </CardContent>
      </Card>

      {/* Trigger Points */}
      {form.trigger_point_reached && (
        <Card className="border-amber-200">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Trigger Point Reached</p>
              {form.trigger_point_details && (
                <p className="text-sm mt-1">{form.trigger_point_details}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Notes */}
      {form.additional_notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{form.additional_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Employee Comments + Confirmation */}
      {canConfirm && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Your Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={employeeComments}
                onChange={(e) => setEmployeeComments(e.target.value)}
                placeholder="Add any comments before confirming (optional)"
                rows={3}
              />
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              By clicking &quot;I Confirm This Is Accurate&quot;, you confirm that the information in this form is accurate.
              You understand that giving false information regarding your absence from work may result in disciplinary action.
            </span>
          </div>
        </>
      )}

      {/* Error / Success */}
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

      {/* Action buttons */}
      {canConfirm && (
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isPending} size="lg">
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

      {/* Not the employee — read-only view */}
      {!isEmployee && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>Only the employee can confirm this form.</span>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}
