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
import { assignAsset } from "@/app/(protected)/hr/assets/actions";

interface Employee {
  id: string;
  full_name: string;
}

interface AssetAssignDialogProps {
  assetId: string;
  assetTag: string;
  employees: Employee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONDITIONS = ["New", "Good", "Fair", "Poor"];

export function AssetAssignDialog({
  assetId, assetTag, employees, open, onOpenChange,
}: AssetAssignDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [employeeId, setEmployeeId] = useState("");
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState("Good");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setEmployeeId(""); setAssignedDate(new Date().toISOString().slice(0, 10));
    setCondition("Good"); setNotes(""); setError(null);
  }

  function handleSubmit() {
    if (!employeeId) { setError("Please select an employee"); return; }

    startTransition(async () => {
      const result = await assignAsset(assetId, employeeId, {
        assigned_date: assignedDate,
        condition_on_assignment: condition,
        notes: notes || undefined,
      });
      if (result.success) { resetForm(); onOpenChange(false); }
      else { setError(result.error); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Asset</DialogTitle>
          <DialogDescription>Assign {assetTag} to an employee.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Employee *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Assigned Date</Label>
              <Input type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !employeeId}>
            {isPending ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
