"use client";

import { useState, useTransition, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAVE_TYPE_CONFIG,
  REQUESTABLE_LEAVE_TYPES,
  calculateWorkingDays,
  formatLeaveDays,
} from "@/lib/hr";
import { requestLeave } from "@/app/(protected)/hr/leave/actions";

interface LeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicHolidays: string[];
}

export function LeaveRequestDialog({
  open,
  onOpenChange,
  publicHolidays,
}: LeaveRequestDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [leaveType, setLeaveType] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startHalfDay, setStartHalfDay] = useState(false);
  const [endHalfDay, setEndHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return null;
    return calculateWorkingDays(startDate, endDate, publicHolidays, startHalfDay, endHalfDay);
  }, [startDate, endDate, publicHolidays, startHalfDay, endHalfDay]);

  function resetForm() {
    setLeaveType("");
    setStartDate("");
    setEndDate("");
    setStartHalfDay(false);
    setEndHalfDay(false);
    setReason("");
    setError(null);
  }

  function handleSubmit() {
    if (!leaveType || !startDate || !endDate) {
      setError("Please fill in all required fields");
      return;
    }

    startTransition(async () => {
      const result = await requestLeave({
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        start_half_day: startHalfDay,
        end_half_day: endHalfDay,
        reason: reason || undefined,
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
          <DialogTitle>Request Leave</DialogTitle>
          <DialogDescription>
            Submit a leave request for approval by your line manager.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="leave-type">Leave Type *</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger id="leave-type">
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {REQUESTABLE_LEAVE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {LEAVE_TYPE_CONFIG[type].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start-date">Start Date *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-date">End Date *</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="start-half"
                checked={startHalfDay}
                onCheckedChange={(checked) => setStartHalfDay(checked === true)}
              />
              <Label htmlFor="start-half" className="text-sm font-normal">
                Start afternoon only
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="end-half"
                checked={endHalfDay}
                onCheckedChange={(checked) => setEndHalfDay(checked === true)}
              />
              <Label htmlFor="end-half" className="text-sm font-normal">
                End morning only
              </Label>
            </div>
          </div>

          {calculatedDays !== null && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="font-medium">{formatLeaveDays(calculatedDays)}</span>
              {" "}working {calculatedDays === 1 ? "day" : "days"} (excluding weekends and public holidays)
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add any notes for your manager..."
              rows={3}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !leaveType || !startDate || !endDate}>
            {isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
