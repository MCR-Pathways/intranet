"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createOnboardingChecklist } from "@/app/(protected)/hr/onboarding/actions";
import { PersonCombobox, type PersonOption } from "@/components/hr/person-combobox";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_MEDIUM_TEXT_LENGTH } from "@/lib/validation";
import { toast } from "sonner";

interface CreateOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Array<{ id: string; name: string; description: string | null; item_count: number }>;
  employees: PersonOption[];
  /** Pre-fill with a specific employee (e.g. from employee detail page) */
  prefilledEmployeeId?: string;
}

export function CreateOnboardingDialog({
  open,
  onOpenChange,
  templates,
  employees,
  prefilledEmployeeId,
}: CreateOnboardingDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [employeeId, setEmployeeId] = useState<string | null>(prefilledEmployeeId ?? null);
  const [templateId, setTemplateId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [notes, setNotes] = useState("");

  function handleClose() {
    onOpenChange(false);
    // Reset form
    if (!prefilledEmployeeId) setEmployeeId(null);
    setTemplateId("");
    setStartDate("");
    setNotes("");
  }

  function handleSubmit() {
    if (!employeeId || !templateId || !startDate) return;

    startTransition(async () => {
      const result = await createOnboardingChecklist({
        profile_id: employeeId,
        template_id: templateId,
        start_date: startDate,
        notes: notes || undefined,
      });

      if (result.success) {
        toast.success("Onboarding checklist created");
        handleClose();
        // Navigate to the new checklist
        window.location.href = `/hr/onboarding/${result.checklistId}`;
      } else {
        toast.error(result.error ?? "Failed to create onboarding checklist");
      }
    });
  }

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Onboarding</DialogTitle>
          <DialogDescription>
            Start an onboarding checklist for a new employee.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Employee picker */}
          <div className="space-y-2">
            <Label>Employee</Label>
            {prefilledEmployeeId ? (
              <p className="text-sm font-medium">
                {employees.find((e) => e.id === prefilledEmployeeId)?.full_name ?? "Selected employee"}
              </p>
            ) : (
              <PersonCombobox
                people={employees}
                value={employeeId}
                onChange={setEmployeeId}
                placeholder="Select employee..."
              />
            )}
          </div>

          {/* Template selector */}
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.item_count} items)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate?.description && (
              <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
            )}
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No active templates available.{" "}
                <Link href="/hr/onboarding/templates" className="text-link underline">
                  Create a template
                </Link>{" "}
                first.
              </p>
            )}
          </div>

          {/* Start date */}
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="onboarding-notes">Notes (optional)</Label>
            <Textarea
              id="onboarding-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context for this onboarding"
              rows={2}
              maxLength={MAX_MEDIUM_TEXT_LENGTH}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <LoadingButton
            type="button"
            loading={isPending}
            onClick={handleSubmit}
            disabled={!employeeId || !templateId || !startDate}
          >
            Start Onboarding
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
