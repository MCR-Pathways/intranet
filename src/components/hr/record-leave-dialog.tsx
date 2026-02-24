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
  const [startDayType, setStartDayType] = useState<"full" | "pm">("full");
  const [endDayType, setEndDayType] = useState<"full" | "am">("full");
  const [singleDayType, setSingleDayType] = useState<"full" | "am" | "pm">("full");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSingleDay = startDate !== "" && startDate === endDate;

  const startHalfDay = isSingleDay
    ? singleDayType === "pm"
    : startDayType === "pm";
  const endHalfDay = isSingleDay
    ? singleDayType === "am"
    : endDayType === "am";

  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return null;
    return calculateWorkingDays(startDate, endDate, publicHolidays, startHalfDay, endHalfDay);
  }, [startDate, endDate, publicHolidays, startHalfDay, endHalfDay]);

  function resetForm() {
    setLeaveType("");
    setStartDate("");
    setEndDate("");
    setStartDayType("full");
    setEndDayType("full");
    setSingleDayType("full");
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
                  setStartDayType("full");
                  setEndDayType("full");
                  setSingleDayType("full");
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>End Date *</Label>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setEndDayType("full");
                  setSingleDayType("full");
                }}
              />
            </div>
          </div>

          {/* Half-day selectors */}
          {startDate && endDate && (
            isSingleDay ? (
              <div className="grid gap-2">
                <Label>Duration</Label>
                <Select
                  value={singleDayType}
                  onValueChange={(val) => setSingleDayType(val as "full" | "am" | "pm")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Day</SelectItem>
                    <SelectItem value="am">Morning only (AM)</SelectItem>
                    <SelectItem value="pm">Afternoon only (PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>First Day</Label>
                  <Select
                    value={startDayType}
                    onValueChange={(val) => setStartDayType(val as "full" | "pm")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Day</SelectItem>
                      <SelectItem value="pm">Afternoon only (PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Last Day</Label>
                  <Select
                    value={endDayType}
                    onValueChange={(val) => setEndDayType(val as "full" | "am")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Day</SelectItem>
                      <SelectItem value="am">Morning only (AM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          )}

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
