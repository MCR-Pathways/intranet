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
  ABSENCE_TYPE_CONFIG,
  SICKNESS_CATEGORY_CONFIG,
  calculateWorkingDays,
  formatLeaveDays,
  FIT_NOTE_REQUIRED_AFTER_DAYS,
  validateHRDocument,
} from "@/lib/hr";
import { recordAbsence, uploadFitNote } from "@/app/(protected)/hr/absence/actions";
import { AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

interface RecordAbsenceDialogProps {
  profileId: string;
  profileName: string;
  publicHolidays: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordAbsenceDialog({
  profileId,
  profileName,
  publicHolidays,
  open,
  onOpenChange,
}: RecordAbsenceDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [absenceType, setAbsenceType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sicknessCategory, setSicknessCategory] = useState("");
  const [reason, setReason] = useState("");
  const [fitNoteFile, setFitNoteFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSickType = absenceType === "sick_self_certified" || absenceType === "sick_fit_note";

  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return null;
    return calculateWorkingDays(startDate, endDate, publicHolidays);
  }, [startDate, endDate, publicHolidays]);

  // Calculate calendar days for fit note warning
  const calendarDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const needsFitNote = calendarDays > FIT_NOTE_REQUIRED_AFTER_DAYS && isSickType;

  function resetForm() {
    setAbsenceType("");
    setStartDate("");
    setEndDate("");
    setSicknessCategory("");
    setReason("");
    setFitNoteFile(null);
    setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const validationError = validateHRDocument({ size: file.size, type: file.type });
      if (validationError) {
        setError(validationError);
        setFitNoteFile(null);
        return;
      }
    }
    setError(null);
    setFitNoteFile(file);
  }

  function handleSubmit() {
    if (!absenceType || !startDate || !endDate) {
      setError("Please fill in all required fields");
      return;
    }

    startTransition(async () => {
      const result = await recordAbsence({
        profile_id: profileId,
        absence_type: absenceType,
        start_date: startDate,
        end_date: endDate,
        reason: reason || undefined,
        sickness_category: isSickType && sicknessCategory ? sicknessCategory : undefined,
      });

      if (!result.success) {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
        setError(result.error);
        return;
      }

      // Upload fit note if provided
      if (fitNoteFile && result.absenceId) {
        const formData = new FormData();
        formData.append("absence_id", result.absenceId);
        formData.append("profile_id", profileId);
        formData.append("file", fitNoteFile);

        const uploadResult = await uploadFitNote(formData);
        if (!uploadResult.success) {
          // Absence was created but fit note upload failed — warn but close dialog
          toast.error(`Absence recorded but fit note upload failed: ${uploadResult.error}`);
          resetForm();
          onOpenChange(false);
          return;
        }
      }

      toast.success("Absence recorded");
      resetForm();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Absence</DialogTitle>
          <DialogDescription>
            Record an absence for {profileName}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Absence Type */}
          <div className="grid gap-2">
            <Label>Absence Type *</Label>
            <Select value={absenceType} onValueChange={setAbsenceType}>
              <SelectTrigger>
                <SelectValue placeholder="Select absence type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ABSENCE_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && e.target.value > endDate) setEndDate(e.target.value);
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

          {/* Working days preview */}
          {calculatedDays !== null && (
            <p className="text-sm text-muted-foreground">
              {formatLeaveDays(calculatedDays)} ({calendarDays} calendar day{calendarDays !== 1 ? "s" : ""})
            </p>
          )}

          {/* Fit note warning */}
          {needsFitNote && absenceType === "sick_self_certified" && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                This absence is {calendarDays} calendar days. A fit note is required after {FIT_NOTE_REQUIRED_AFTER_DAYS} consecutive calendar days.
                Consider changing to &quot;Sick (Fit Note)&quot;.
              </span>
            </div>
          )}

          {/* Sickness Category — only for sick types */}
          {isSickType && (
            <div className="grid gap-2">
              <Label>Sickness Category</Label>
              <Select value={sicknessCategory} onValueChange={setSicknessCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SICKNESS_CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reason */}
          <div className="grid gap-2">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for absence (optional)"
              rows={2}
            />
          </div>

          {/* Fit note upload — only for sick_fit_note type */}
          {absenceType === "sick_fit_note" && (
            <div className="grid gap-2">
              <Label>Fit Note</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                PDF, JPEG, PNG, or DOCX. Max 10MB.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { resetForm(); onOpenChange(false); }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !absenceType || !startDate || !endDate}
          >
            {isPending ? "Recording..." : "Record Absence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
