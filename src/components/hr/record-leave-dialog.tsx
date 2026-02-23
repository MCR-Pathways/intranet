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
  calculateWorkingDays,
  formatLeaveDays,
} from "@/lib/hr";
import { recordLeave } from "@/app/(protected)/hr/leave/actions";

interface RecordLeaveDialogProps {
  profileId: string;
  profileName: string;
  publicHolidays: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordLeaveDialog({
  profileId,
  profileName,
  publicHolidays,
  open,
  onOpenChange,
}: RecordLeaveDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [leaveType, setLeaveType] = useState("");
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
      const result = await recordLeave({
        profile_id: profileId,
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
          <DialogTitle>Record Leave</DialogTitle>
          <DialogDescription>
            Record leave on behalf of {profileName}. This will be automatically approved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Leave Type *</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
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
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>End Date *</Label>
              <Input
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
                id="rec-start-half"
                checked={startHalfDay}
                onCheckedChange={(c) => setStartHalfDay(c === true)}
              />
              <Label htmlFor="rec-start-half" className="text-sm font-normal">
                Start afternoon only
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="rec-end-half"
                checked={endHalfDay}
                onCheckedChange={(c) => setEndHalfDay(c === true)}
              />
              <Label htmlFor="rec-end-half" className="text-sm font-normal">
                End morning only
              </Label>
            </div>
          </div>

          {calculatedDays !== null && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="font-medium">{formatLeaveDays(calculatedDays)}</span>
              {" "}working {calculatedDays === 1 ? "day" : "days"}
            </div>
          )}

          <div className="grid gap-2">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for absence..."
              rows={3}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !leaveType || !startDate || !endDate}>
            {isPending ? "Recording..." : "Record Leave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
