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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import { FWR_REJECTION_GROUNDS } from "@/lib/hr";
import { rejectFlexibleWorkingRequest } from "@/app/(protected)/hr/flexible-working/actions";
import { MAX_LONG_TEXT_LENGTH } from "@/lib/validation";
import { toast } from "sonner";

interface FlexibleWorkingRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  hasConsultation: boolean;
}

export function FlexibleWorkingRejectDialog({
  open,
  onOpenChange,
  requestId,
  hasConsultation,
}: FlexibleWorkingRejectDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedGrounds, setSelectedGrounds] = useState<string[]>([]);
  const [explanation, setExplanation] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setSelectedGrounds([]);
    setExplanation("");
    setNotes("");
  };

  const toggleGround = (ground: string) => {
    setSelectedGrounds((prev) =>
      prev.includes(ground) ? prev.filter((g) => g !== ground) : [...prev, ground],
    );
  };

  const canSubmit = selectedGrounds.length > 0 && explanation.trim() && hasConsultation && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;

    startTransition(async () => {
      const result = await rejectFlexibleWorkingRequest(requestId, {
        rejection_grounds: selectedGrounds,
        rejection_explanation: explanation,
        decision_notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast.success("Request rejected. The employee has been notified and informed of their right to appeal.");
        resetForm();
        onOpenChange(false);
        window.location.reload();
      } else {
        toast.error(result.error ?? "Failed to reject request.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetForm(); onOpenChange(next); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reject Request</DialogTitle>
          <DialogDescription>
            You must cite at least one statutory ground and explain why refusal is
            reasonable (Employment Rights Act 1996, s.80G).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!hasConsultation && (
            <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600 shrink-0" />
              <p className="text-sm text-red-800">
                You must record a consultation meeting before rejecting this request.
                Close this dialog and record the consultation first.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Label>Statutory Grounds for Refusal *</Label>
            <div className="space-y-2">
              {Object.entries(FWR_REJECTION_GROUNDS).map(([key, label]) => (
                <div key={key} className="flex items-start space-x-2">
                  <Checkbox
                    id={`ground-${key}`}
                    checked={selectedGrounds.includes(key)}
                    onCheckedChange={() => toggleGround(key)}
                    disabled={!hasConsultation}
                  />
                  <Label
                    htmlFor={`ground-${key}`}
                    className="text-sm font-normal leading-tight"
                  >
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reject-explanation">
              Why is refusal reasonable on these grounds? *
            </Label>
            <Textarea
              id="reject-explanation"
              placeholder="Explain why refusal is reasonable in the circumstances..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={4}
              disabled={!hasConsultation}
              maxLength={MAX_LONG_TEXT_LENGTH}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reject-notes">Additional Notes</Label>
            <Textarea
              id="reject-notes"
              placeholder="Any additional notes for the record..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={!hasConsultation}
              maxLength={MAX_LONG_TEXT_LENGTH}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isPending ? "Rejecting..." : "Reject Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
