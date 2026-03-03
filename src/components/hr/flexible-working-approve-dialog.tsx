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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { approveFlexibleWorkingRequest } from "@/app/(protected)/hr/flexible-working/actions";
import { toast } from "sonner";

interface FlexibleWorkingApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
}

export function FlexibleWorkingApproveDialog({
  open,
  onOpenChange,
  requestId,
}: FlexibleWorkingApproveDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [trialEnabled, setTrialEnabled] = useState(false);
  const [trialDuration, setTrialDuration] = useState<"3" | "6" | "custom">("3");
  const [customEndDate, setCustomEndDate] = useState("");

  const resetForm = () => {
    setNotes("");
    setTrialEnabled(false);
    setTrialDuration("3");
    setCustomEndDate("");
  };

  const getTrialEndDate = (): string | undefined => {
    if (!trialEnabled) return undefined;
    if (trialDuration === "custom") return customEndDate || undefined;

    const months = parseInt(trialDuration);
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split("T")[0];
  };

  const handleSubmit = () => {
    const trialEndDate = getTrialEndDate();
    if (trialEnabled && !trialEndDate) return;

    startTransition(async () => {
      const result = await approveFlexibleWorkingRequest(requestId, {
        decision_notes: notes.trim() || undefined,
        trial_period: trialEnabled,
        trial_end_date: trialEndDate,
      });

      if (result.success) {
        toast.success(
          trialEnabled
            ? "Request approved with trial period."
            : "Request approved. Employee's work pattern has been updated.",
        );
        resetForm();
        onOpenChange(false);
        window.location.reload();
      } else {
        toast.error(result.error ?? "Failed to approve request.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetForm(); onOpenChange(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Request</DialogTitle>
          <DialogDescription>
            Approve this flexible working request. You can optionally set a trial period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="trial-toggle">Trial Period</Label>
              <p className="text-sm text-muted-foreground">
                Approve for a trial period before making permanent
              </p>
            </div>
            <Switch
              id="trial-toggle"
              checked={trialEnabled}
              onCheckedChange={setTrialEnabled}
            />
          </div>

          {trialEnabled && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Trial Duration</Label>
                <Select value={trialDuration} onValueChange={(v) => setTrialDuration(v as "3" | "6" | "custom")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Months</SelectItem>
                    <SelectItem value="6">6 Months</SelectItem>
                    <SelectItem value="custom">Custom Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {trialDuration === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="custom-trial-date">Trial End Date</Label>
                  <Input
                    id="custom-trial-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="approve-notes">Decision Notes</Label>
            <Textarea
              id="approve-notes"
              placeholder="Add any notes about this decision..."
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
            disabled={isPending || (trialEnabled && trialDuration === "custom" && !customEndDate)}
          >
            {isPending ? "Approving..." : trialEnabled ? "Approve with Trial" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
