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
import { LEAVE_TYPE_CONFIG, getLeaveYearForDate } from "@/lib/hr";
import { upsertLeaveEntitlement } from "@/app/(protected)/hr/leave/actions";

interface LeaveEntitlementDialogProps {
  profileId: string;
  profileName: string;
  fte: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: {
    leave_type: string;
    base_entitlement_days: number;
    adjustments_days: number;
    notes: string | null;
  } | null;
}

export function LeaveEntitlementDialog({
  profileId,
  profileName,
  fte,
  open,
  onOpenChange,
  existing,
}: LeaveEntitlementDialogProps) {
  const [isPending, startTransition] = useTransition();
  const leaveYear = getLeaveYearForDate();

  const [leaveType, setLeaveType] = useState(existing?.leave_type ?? "");
  const [baseDays, setBaseDays] = useState(String(existing?.base_entitlement_days ?? ""));
  const [fteAtCalc, setFteAtCalc] = useState(String(fte));
  const [adjustments, setAdjustments] = useState(String(existing?.adjustments_days ?? "0"));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setLeaveType(existing?.leave_type ?? "");
    setBaseDays(String(existing?.base_entitlement_days ?? ""));
    setFteAtCalc(String(fte));
    setAdjustments(String(existing?.adjustments_days ?? "0"));
    setNotes(existing?.notes ?? "");
    setError(null);
  }

  function handleSubmit() {
    if (!leaveType || !baseDays) {
      setError("Leave type and base entitlement are required");
      return;
    }

    startTransition(async () => {
      const result = await upsertLeaveEntitlement({
        profile_id: profileId,
        leave_type: leaveType,
        leave_year_start: leaveYear.start,
        leave_year_end: leaveYear.end,
        base_entitlement_days: parseFloat(baseDays),
        fte_at_calculation: parseFloat(fteAtCalc),
        adjustments_days: parseFloat(adjustments) || 0,
        notes: notes || undefined,
      });

      if (result.success) {
        resetForm();
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit" : "Set"} Leave Entitlement
          </DialogTitle>
          <DialogDescription>
            {existing ? "Update" : "Set"} leave entitlement for {profileName} ({leaveYear.year}).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Leave Type *</Label>
            <Select value={leaveType} onValueChange={setLeaveType} disabled={!!existing}>
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LEAVE_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Base Entitlement (days) *</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={baseDays}
                onChange={(e) => setBaseDays(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>FTE at Calculation</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={fteAtCalc}
                onChange={(e) => setFteAtCalc(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Adjustments (days)</Label>
            <Input
              type="number"
              step="0.5"
              value={adjustments}
              onChange={(e) => setAdjustments(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Positive for carry-over or bought leave; negative for deductions
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this entitlement..."
              rows={2}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !leaveType || !baseDays}>
            {isPending ? "Saving..." : "Save Entitlement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
