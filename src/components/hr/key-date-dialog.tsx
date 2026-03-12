"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createKeyDate, updateKeyDate } from "@/app/(protected)/hr/key-dates/actions";
import { MAX_SHORT_TEXT_LENGTH, MAX_MEDIUM_TEXT_LENGTH } from "@/lib/validation";
import { toast } from "sonner";

const DATE_TYPE_OPTIONS = [
  { value: "probation_end", label: "Probation End" },
  { value: "appraisal_due", label: "Appraisal Due" },
  { value: "contract_end", label: "Contract End" },
  { value: "course_renewal", label: "Course Renewal" },
  { value: "custom", label: "Custom" },
];

interface Employee {
  id: string;
  full_name: string;
}

interface KeyDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId?: string;
  profileName?: string;
  employees?: Employee[];
  existing?: {
    id: string;
    date_type: string;
    due_date: string;
    title: string;
    description: string | null;
  } | null;
}

export function KeyDateDialog({
  open, onOpenChange, profileId, profileName, employees, existing,
}: KeyDateDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = !!existing;

  const [selectedEmployee, setSelectedEmployee] = useState(profileId ?? "");
  const [dateType, setDateType] = useState(existing?.date_type ?? "");
  const [dueDate, setDueDate] = useState(existing?.due_date ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  // Auto-populate title based on date type
  function handleTypeChange(type: string) {
    setDateType(type);
    if (!existing && !title) {
      const opt = DATE_TYPE_OPTIONS.find((o) => o.value === type);
      if (opt && type !== "custom") setTitle(opt.label);
    }
  }

  function resetForm() {
    if (!existing) {
      setSelectedEmployee(profileId ?? ""); setDateType(""); setDueDate(""); setTitle(""); setDescription("");
    }
    setError(null);
  }

  function handleSubmit() {
    const targetId = profileId ?? selectedEmployee;
    if (!targetId || !dateType || !dueDate || !title.trim()) {
      setError("All required fields must be filled");
      return;
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateKeyDate(existing!.id, {
            due_date: dueDate,
            title: title.trim(),
            description: description.trim() || null,
          })
        : await createKeyDate({
            profile_id: targetId,
            date_type: dateType,
            due_date: dueDate,
            title: title.trim(),
            description: description.trim() || undefined,
          });

      if (result.success) {
        toast.success(isEditing ? "Key date updated" : "Key date created");
        resetForm();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "Add"} Key Date</DialogTitle>
          <DialogDescription>
            {profileName
              ? `${isEditing ? "Update" : "Add a"} key date for ${profileName}.`
              : `${isEditing ? "Update" : "Add a"} key date for an employee.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!profileId && employees && (
            <div className="grid gap-2">
              <Label>Employee *</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Date Type *</Label>
              <Select value={dateType} onValueChange={handleTypeChange} disabled={isEditing}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {DATE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Due Date *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Probation review" maxLength={MAX_SHORT_TEXT_LENGTH} />
          </div>

          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={MAX_MEDIUM_TEXT_LENGTH} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !dateType || !dueDate || !title.trim()}>
            {isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Key Date"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
