"use client";

import { useState, useTransition } from "react";
import { updateComplianceDocument } from "@/app/(protected)/hr/compliance/actions";
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
import { toast } from "sonner";

interface ComplianceEditDialogProps {
  document: {
    id: string;
    document_type_name: string;
    reference_number: string | null;
    issue_date: string | null;
    expiry_date: string | null;
    notes: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComplianceEditDialog({
  document: doc,
  open,
  onOpenChange,
}: ComplianceEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [referenceNumber, setReferenceNumber] = useState(doc.reference_number ?? "");
  const [issueDate, setIssueDate] = useState(doc.issue_date ?? "");
  const [expiryDate, setExpiryDate] = useState(doc.expiry_date ?? "");
  const [notes, setNotes] = useState(doc.notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateComplianceDocument(doc.id, {
        reference_number: referenceNumber || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        notes: notes || null,
      });

      if (result.success) {
        toast.success("Document updated");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Something went wrong");
        setError(result.error || "Failed to update document");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
          <DialogDescription>
            Update metadata for {doc.document_type_name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Reference Number */}
            <div className="grid gap-2">
              <Label htmlFor="ce_ref">Reference Number</Label>
              <Input
                id="ce_ref"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. PVG-123456"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ce_issue">Issue Date</Label>
                <Input
                  id="ce_issue"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ce_expiry">Expiry Date</Label>
                <Input
                  id="ce_expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="ce_notes">Notes</Label>
              <Textarea
                id="ce_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={3}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
