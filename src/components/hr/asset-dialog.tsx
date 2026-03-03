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
import { createAsset, updateAsset } from "@/app/(protected)/hr/assets/actions";
import { toast } from "sonner";

interface AssetType {
  id: string;
  name: string;
}

interface AssetDialogProps {
  assetTypes: AssetType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: {
    id: string;
    asset_type_id: string;
    asset_tag: string;
    make: string | null;
    model: string | null;
    serial_number: string | null;
    purchase_date: string | null;
    purchase_cost: number | null;
    warranty_expiry_date: string | null;
    status: string;
    notes: string | null;
  } | null;
}

export function AssetDialog({ assetTypes, open, onOpenChange, existing }: AssetDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = !!existing;

  const [typeId, setTypeId] = useState(existing?.asset_type_id ?? "");
  const [tag, setTag] = useState(existing?.asset_tag ?? "");
  const [make, setMake] = useState(existing?.make ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [serial, setSerial] = useState(existing?.serial_number ?? "");
  const [purchaseDate, setPurchaseDate] = useState(existing?.purchase_date ?? "");
  const [cost, setCost] = useState(existing?.purchase_cost != null ? String(existing.purchase_cost) : "");
  const [status, setStatus] = useState(existing?.status ?? "available");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    if (!existing) {
      setTypeId(""); setTag(""); setMake(""); setModel(""); setSerial("");
      setPurchaseDate(""); setCost(""); setStatus("available"); setNotes("");
    }
    setError(null);
  }

  function handleSubmit() {
    if (!typeId || !tag.trim()) {
      setError("Asset type and tag are required");
      return;
    }

    startTransition(async () => {
      const payload = {
        asset_type_id: typeId,
        asset_tag: tag.trim(),
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        serial_number: serial.trim() || undefined,
        purchase_date: purchaseDate || undefined,
        purchase_cost: cost ? parseFloat(cost) : undefined,
        notes: notes.trim() || undefined,
      };

      const result = isEditing
        ? await updateAsset(existing!.id, { ...payload, status })
        : await createAsset(payload);

      if (result.success) {
        toast.success(isEditing ? "Asset updated successfully" : "Asset created successfully");
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "Add"} Asset</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update asset details." : "Register a new asset in the catalogue."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Asset Type *</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {assetTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Asset Tag *</Label>
              <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. MCR-LAP-042" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Make</Label>
              <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="e.g. Apple" />
            </div>
            <div className="grid gap-2">
              <Label>Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. MacBook Pro 14" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Serial Number</Label>
            <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Purchase Date</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Purchase Cost (GBP)</Label>
              <Input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
          </div>

          {isEditing && (
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_repair">In Repair</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !typeId || !tag.trim()}>
            {isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
