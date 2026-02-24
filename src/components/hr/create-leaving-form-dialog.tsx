"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { LEAVING_REASON_CONFIG } from "@/lib/hr";
import { createLeavingForm } from "@/app/(protected)/hr/leaving/actions";
import { toast } from "sonner";

interface Employee {
  id: string;
  full_name: string;
  job_title: string | null;
}

interface CreateLeavingFormDialogProps {
  /** Pre-selected employee (when opened from employee detail tab). */
  employee?: Employee;
  /** List of active employees to choose from (when opened from dashboard). */
  employees?: Employee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLeavingFormDialog({
  employee,
  employees = [],
  open,
  onOpenChange,
}: CreateLeavingFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employee?.id ?? "");
  const [leavingDate, setLeavingDate] = useState("");
  const [reason, setReason] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");

  function resetForm() {
    if (!employee) setSelectedEmployeeId("");
    setLeavingDate("");
    setReason("");
    setReasonDetails("");
  }

  function handleSubmit() {
    const profileId = employee?.id ?? selectedEmployeeId;
    if (!profileId || !leavingDate || !reason) {
      toast.error("Please fill in all required fields");
      return;
    }

    startTransition(async () => {
      const result = await createLeavingForm({
        profile_id: profileId,
        leaving_date: leavingDate,
        reason_for_leaving: reason,
        reason_details: reasonDetails.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? "Failed to create leaving form");
        return;
      }

      toast.success("Leaving form created");
      resetForm();
      onOpenChange(false);

      // Navigate to the full form page
      if (result.formId) {
        window.location.href = `/hr/leaving/${result.formId}`;
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start Leaving Process</DialogTitle>
          <DialogDescription>
            {employee
              ? `Create a leaving form for ${employee.full_name}.`
              : "Select an employee and enter the leaving details."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee selector (only when no pre-selected employee) */}
          {!employee && (
            <div className="space-y-2">
              <Label htmlFor="employee">Employee *</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}{emp.job_title ? ` — ${emp.job_title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Leaving date */}
          <div className="space-y-2">
            <Label htmlFor="leaving-date">Leaving Date *</Label>
            <Input
              id="leaving-date"
              type="date"
              value={leavingDate}
              onChange={(e) => setLeavingDate(e.target.value)}
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Leaving *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LEAVING_REASON_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason details */}
          {(reason === "other" || reason === "mutual_agreement") && (
            <div className="space-y-2">
              <Label htmlFor="reason-details">Details</Label>
              <Textarea
                id="reason-details"
                value={reasonDetails}
                onChange={(e) => setReasonDetails(e.target.value)}
                placeholder="Provide additional details..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !(employee?.id ?? selectedEmployeeId) || !leavingDate || !reason}
          >
            {isPending ? "Creating..." : "Create Leaving Form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
