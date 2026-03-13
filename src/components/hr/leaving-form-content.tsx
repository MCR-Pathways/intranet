"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  LEAVING_STATUS_CONFIG,
  LEAVING_REASON_CONFIG,
  formatHRDate,
} from "@/lib/hr";
import type { LeavingReason } from "@/lib/hr";
import type { StaffLeavingForm } from "@/types/hr";
import {
  updateLeavingForm,
  submitLeavingForm,
  startProcessingForm,
  completeLeavingForm,
  cancelLeavingForm,
} from "@/app/(protected)/hr/leaving/actions";
import {
  Package,
  FileText,
  CalendarDays,
  Briefcase,
  CheckCircle2,
  XCircle,
  Send,
  PlayCircle,
  Save,
} from "lucide-react";
import { MAX_LONG_TEXT_LENGTH } from "@/lib/validation";
import { toast } from "sonner";
import Link from "next/link";

interface LeavingFormContentProps {
  form: StaffLeavingForm;
  employeeName: string;
  employeeJobTitle: string | null;
  employeeDepartment: string | null;
  lengthOfService: string | null;
  outstandingAssets: Array<{
    id: string;
    asset_tag: string;
    asset_type_name: string;
    make: string | null;
    model: string | null;
  }>;
  activeComplianceDocs: Array<{
    id: string;
    document_type_name: string;
    expiry_date: string | null;
    status: string;
  }>;
  leaveBalance: { entitlement: number; used: number; remaining: number } | null;
  isHRAdmin: boolean;
}

export function LeavingFormContent({
  form,
  employeeName,
  employeeJobTitle,
  employeeDepartment,
  lengthOfService,
  outstandingAssets,
  activeComplianceDocs,
  leaveBalance,
  isHRAdmin,
}: LeavingFormContentProps) {
  const [isPending, startTransition] = useTransition();
  const isEditable = ["draft", "submitted", "in_progress"].includes(form.status);
  const isChecklistEditable = ["draft", "submitted", "in_progress"].includes(form.status);

  // Local state for editable fields
  const [leavingDate, setLeavingDate] = useState(form.leaving_date);
  const [lastWorkingDate, setLastWorkingDate] = useState(form.last_working_date ?? "");
  const [reason, setReason] = useState(form.reason_for_leaving);
  const [reasonDetails, setReasonDetails] = useState(form.reason_details ?? "");
  const [noticePeriodStart, setNoticePeriodStart] = useState(form.notice_period_start ?? "");
  const [noticePeriodEnd, setNoticePeriodEnd] = useState(form.notice_period_end ?? "");

  // Checklist state
  const [exitInterviewCompleted, setExitInterviewCompleted] = useState(form.exit_interview_completed);
  const [exitInterviewNotes, setExitInterviewNotes] = useState(form.exit_interview_notes ?? "");
  const [knowledgeTransferCompleted, setKnowledgeTransferCompleted] = useState(form.knowledge_transfer_completed);
  const [knowledgeTransferNotes, setKnowledgeTransferNotes] = useState(form.knowledge_transfer_notes ?? "");
  const [equipmentReturned, setEquipmentReturned] = useState(form.equipment_returned);
  const [equipmentNotes, setEquipmentNotes] = useState(form.equipment_notes ?? "");
  const [accessRevoked, setAccessRevoked] = useState(form.access_revoked);
  const [accessRevokedDate, setAccessRevokedDate] = useState(form.access_revoked_date ?? "");
  const [rehireEligible, setRehireEligible] = useState<boolean | null>(form.rehire_eligible);
  const [additionalNotes, setAdditionalNotes] = useState(form.additional_notes ?? "");

  const statusConfig = LEAVING_STATUS_CONFIG[form.status];

  function handleSave() {
    startTransition(async () => {
      const result = await updateLeavingForm(form.id, {
        leaving_date: leavingDate,
        last_working_date: lastWorkingDate || null,
        reason_for_leaving: reason,
        reason_details: reasonDetails.trim() || null,
        notice_period_start: noticePeriodStart || null,
        notice_period_end: noticePeriodEnd || null,
        exit_interview_completed: exitInterviewCompleted,
        exit_interview_notes: exitInterviewNotes.trim() || null,
        knowledge_transfer_completed: knowledgeTransferCompleted,
        knowledge_transfer_notes: knowledgeTransferNotes.trim() || null,
        equipment_returned: equipmentReturned,
        equipment_notes: equipmentNotes.trim() || null,
        access_revoked: accessRevoked,
        access_revoked_date: accessRevokedDate || null,
        rehire_eligible: rehireEligible,
        additional_notes: additionalNotes.trim() || null,
      });

      if (!result.success) {
        toast.error(result.error ?? "Failed to save");
      } else {
        toast.success("Form saved");
      }
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitLeavingForm(form.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to submit");
      } else {
        toast.success("Form submitted to HR");
      }
    });
  }

  function handleStartProcessing() {
    startTransition(async () => {
      const result = await startProcessingForm(form.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to start processing");
      } else {
        toast.success("Processing started");
      }
    });
  }

  function handleComplete() {
    startTransition(async () => {
      const result = await completeLeavingForm(form.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to complete");
      } else {
        toast.success("Offboarding completed. Profile set to inactive.");
      }
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelLeavingForm(form.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to cancel");
      } else {
        toast.success("Leaving form cancelled");
        window.location.href = "/hr/leaving";
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Badge variant={statusConfig.badgeVariant} className="text-sm">
              {statusConfig.label}
            </Badge>
            {form.completed_at && (
              <span className="text-sm text-muted-foreground">
                Completed {formatHRDate(form.completed_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditable && (
              <Button onClick={handleSave} disabled={isPending} variant="outline" size="sm">
                <Save className="mr-2 h-4 w-4" />
                {isPending ? "Saving..." : "Save"}
              </Button>
            )}
            {form.status === "draft" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isPending} size="sm">
                    <Send className="mr-2 h-4 w-4" />
                    Submit to HR
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit leaving form?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will notify HR administrators that {employeeName} is leaving. You can still edit the form after submission.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit}>Submit</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {form.status === "submitted" && isHRAdmin && (
              <Button onClick={handleStartProcessing} disabled={isPending} size="sm">
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Processing
              </Button>
            )}
            {form.status === "in_progress" && isHRAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isPending} size="sm">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Complete Offboarding
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Complete offboarding?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will mark {employeeName}&apos;s profile as inactive, record a &quot;Left Organisation&quot; event in their employment history, and lock this form. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleComplete}>Complete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {form.status !== "completed" && form.status !== "cancelled" && isHRAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isPending}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel leaving form?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel the leaving form for {employeeName}. A new form can be created afterwards if needed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Form</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Cancel Form
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Employee Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Employee Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium">{employeeName}</p>
            </div>
            {employeeJobTitle && (
              <div>
                <p className="text-muted-foreground">Job Title</p>
                <p className="font-medium">{employeeJobTitle}</p>
              </div>
            )}
            {employeeDepartment && (
              <div>
                <p className="text-muted-foreground">Department</p>
                <p className="font-medium">{employeeDepartment}</p>
              </div>
            )}
            {lengthOfService && (
              <div>
                <p className="text-muted-foreground">Length of Service</p>
                <p className="font-medium">{lengthOfService}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Core Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Leaving Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Leaving Date *</Label>
              <Input
                type="date"
                value={leavingDate}
                onChange={(e) => setLeavingDate(e.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div className="space-y-2">
              <Label>Last Working Date</Label>
              <Input
                type="date"
                value={lastWorkingDate}
                onChange={(e) => setLastWorkingDate(e.target.value)}
                disabled={!isEditable}
              />
              <p className="text-xs text-muted-foreground">May differ from leaving date (e.g. garden leave)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reason for Leaving *</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as LeavingReason)} disabled={!isEditable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAVING_REASON_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason Details</Label>
              <Textarea
                value={reasonDetails}
                onChange={(e) => setReasonDetails(e.target.value)}
                disabled={!isEditable}
                placeholder="Additional details..."
                rows={2}
                maxLength={MAX_LONG_TEXT_LENGTH}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Notice Period Start</Label>
              <Input
                type="date"
                value={noticePeriodStart}
                onChange={(e) => setNoticePeriodStart(e.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div className="space-y-2">
              <Label>Notice Period End</Label>
              <Input
                type="date"
                value={noticePeriodEnd}
                onChange={(e) => setNoticePeriodEnd(e.target.value)}
                disabled={!isEditable}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-calculated Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Outstanding Assets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Outstanding Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {outstandingAssets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outstanding assets</p>
            ) : (
              <div className="space-y-2">
                {outstandingAssets.map((asset) => (
                  <div key={asset.id} className="text-sm">
                    <p className="font-medium">{asset.asset_tag}</p>
                    <p className="text-muted-foreground">{asset.asset_type_name}{asset.make ? ` — ${asset.make}` : ""}{asset.model ? ` ${asset.model}` : ""}</p>
                  </div>
                ))}
                <Button variant="link" size="sm" className="px-0 h-auto" asChild>
                  <Link href={`/hr/users/${form.profile_id}?tab=assets`}>
                    Manage assets →
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Compliance Docs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Active Compliance Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeComplianceDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active documents</p>
            ) : (
              <div className="space-y-1">
                {activeComplianceDocs.map((doc) => (
                  <p key={doc.id} className="text-sm">
                    {doc.document_type_name}
                    {doc.expiry_date && (
                      <span className="text-muted-foreground"> — expires {formatHRDate(doc.expiry_date)}</span>
                    )}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave Balance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Annual Leave Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaveBalance ? (
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Remaining: </span>
                  <span className="font-medium">{leaveBalance.remaining} days</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No leave entitlement data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Offboarding Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Offboarding Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Exit Interview */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="exit-interview"
                checked={exitInterviewCompleted}
                onCheckedChange={(checked) => setExitInterviewCompleted(checked === true)}
                disabled={!isChecklistEditable}
              />
              <Label htmlFor="exit-interview" className="font-medium">Exit interview completed</Label>
            </div>
            <Textarea
              value={exitInterviewNotes}
              onChange={(e) => setExitInterviewNotes(e.target.value)}
              disabled={!isChecklistEditable}
              placeholder="Exit interview notes..."
              rows={2}
              className="ml-6"
              maxLength={MAX_LONG_TEXT_LENGTH}
            />
          </div>

          {/* Knowledge Transfer */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="knowledge-transfer"
                checked={knowledgeTransferCompleted}
                onCheckedChange={(checked) => setKnowledgeTransferCompleted(checked === true)}
                disabled={!isChecklistEditable}
              />
              <Label htmlFor="knowledge-transfer" className="font-medium">Knowledge transfer completed</Label>
            </div>
            <Textarea
              value={knowledgeTransferNotes}
              onChange={(e) => setKnowledgeTransferNotes(e.target.value)}
              disabled={!isChecklistEditable}
              placeholder="Knowledge transfer notes..."
              rows={2}
              className="ml-6"
              maxLength={MAX_LONG_TEXT_LENGTH}
            />
          </div>

          {/* Equipment Returned */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="equipment-returned"
                checked={equipmentReturned}
                onCheckedChange={(checked) => setEquipmentReturned(checked === true)}
                disabled={!isChecklistEditable}
              />
              <Label htmlFor="equipment-returned" className="font-medium">Equipment returned</Label>
              {outstandingAssets.length > 0 && !equipmentReturned && (
                <Badge variant="warning" className="text-xs">
                  {outstandingAssets.length} outstanding
                </Badge>
              )}
            </div>
            <Textarea
              value={equipmentNotes}
              onChange={(e) => setEquipmentNotes(e.target.value)}
              disabled={!isChecklistEditable}
              placeholder="Equipment return notes..."
              rows={2}
              className="ml-6"
              maxLength={MAX_LONG_TEXT_LENGTH}
            />
          </div>

          {/* Access Revoked */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="access-revoked"
                checked={accessRevoked}
                onCheckedChange={(checked) => setAccessRevoked(checked === true)}
                disabled={!isChecklistEditable}
              />
              <Label htmlFor="access-revoked" className="font-medium">Systems access revoked</Label>
            </div>
            <div className="ml-6">
              <Input
                type="date"
                value={accessRevokedDate}
                onChange={(e) => setAccessRevokedDate(e.target.value)}
                disabled={!isChecklistEditable}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">Date access was revoked</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Rehire Eligible</Label>
            <Select
              value={rehireEligible === null ? "not_set" : rehireEligible ? "yes" : "no"}
              onValueChange={(val) => {
                if (val === "not_set") setRehireEligible(null);
                else setRehireEligible(val === "yes");
              }}
              disabled={!isEditable}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_set">Not set</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              disabled={!isEditable}
              placeholder="Any additional notes about the departure..."
              rows={3}
              maxLength={MAX_LONG_TEXT_LENGTH}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
