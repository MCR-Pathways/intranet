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
import { Info } from "lucide-react";
import { FWR_REQUEST_TYPE_CONFIG } from "@/lib/hr";
import { createFlexibleWorkingRequest } from "@/app/(protected)/hr/flexible-working/actions";
import { MAX_LONG_TEXT_LENGTH } from "@/lib/validation";
import { toast } from "sonner";

interface FlexibleWorkingRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestsInLast12Months: number;
}

export function FlexibleWorkingRequestDialog({
  open,
  onOpenChange,
  requestsInLast12Months,
}: FlexibleWorkingRequestDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [requestType, setRequestType] = useState("");
  const [currentPattern, setCurrentPattern] = useState("");
  const [requestedPattern, setRequestedPattern] = useState("");
  const [startDate, setStartDate] = useState("");
  const [reason, setReason] = useState("");

  const resetForm = () => {
    setRequestType("");
    setCurrentPattern("");
    setRequestedPattern("");
    setStartDate("");
    setReason("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const canSubmit =
    requestType && currentPattern.trim() && requestedPattern.trim() && startDate && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;

    startTransition(async () => {
      const result = await createFlexibleWorkingRequest({
        request_type: requestType,
        current_working_pattern: currentPattern,
        requested_working_pattern: requestedPattern,
        proposed_start_date: startDate,
        reason: reason || undefined,
      });

      if (result.success) {
        toast.success("Flexible working request submitted successfully.");
        handleOpenChange(false);
        if (result.requestId) {
          window.location.href = `/hr/flexible-working/${result.requestId}`;
        }
      } else {
        toast.error(result.error ?? "Failed to submit request.");
      }
    });
  };

  const remaining = 2 - requestsInLast12Months;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Flexible Working Request</DialogTitle>
          <DialogDescription>
            This is a statutory request under s.80F Employment Rights Act 1996.
            Your employer must respond within 2 months.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800">
              You have {remaining} of 2 request{remaining !== 1 ? "s" : ""} remaining this year.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fwr-type">Type of change requested *</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger id="fwr-type">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FWR_REQUEST_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fwr-current">
              Current working pattern *
            </Label>
            <Textarea
              id="fwr-current"
              placeholder="Describe your current days, hours, times, and place of work..."
              value={currentPattern}
              onChange={(e) => setCurrentPattern(e.target.value)}
              rows={3}
              maxLength={MAX_LONG_TEXT_LENGTH}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fwr-requested">
              Requested working pattern *
            </Label>
            <Textarea
              id="fwr-requested"
              placeholder="Describe the working pattern you would like in future..."
              value={requestedPattern}
              onChange={(e) => setRequestedPattern(e.target.value)}
              rows={3}
              maxLength={MAX_LONG_TEXT_LENGTH}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fwr-start-date">
              Proposed start date *
            </Label>
            <Input
              id="fwr-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fwr-reason">
              Reason for request <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="fwr-reason"
              placeholder="You are not required to provide a reason, but it may help your manager consider your request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={MAX_LONG_TEXT_LENGTH}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
