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
import { returnAsset } from "@/app/(protected)/hr/assets/actions";
import { toast } from "sonner";

interface AssetReturnDialogProps {
  assignmentId: string;
  assetTag: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONDITIONS = ["New", "Good", "Fair", "Poor", "Damaged"];

export function AssetReturnDialog({
  assignmentId, assetTag, employeeName, open, onOpenChange,
}: AssetReturnDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState("Good");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setReturnDate(new Date().toISOString().slice(0, 10));
    setCondition("Good"); setNotes(""); setError(null);
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await returnAsset(assignmentId, {
        returned_date: returnDate,
        condition_on_return: condition,
        notes: notes || undefined,
      });
      if (result.success) { toast.success("Asset return recorded"); resetForm(); onOpenChange(false); }
      else { toast.error(result.error || "Something went wrong"); setError(result.error); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Return Asset</DialogTitle>
          <DialogDescription>
            Record the return of {assetTag} from {employeeName}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Return Date</Label>
              <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
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
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Returning..." : "Record Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
