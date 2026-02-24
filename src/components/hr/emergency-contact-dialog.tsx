"use client";

import { useState, useTransition } from "react";
import { upsertEmergencyContact } from "@/app/(protected)/hr/profile/actions";
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
import type { EmergencyContact } from "@/types/hr";
import { toast } from "sonner";

interface EmergencyContactDialogProps {
  /** If provided, edit mode; if absent, create mode. */
  contact?: EmergencyContact;
  /** Sort order for new contacts. */
  nextSortOrder: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmergencyContactDialog({
  contact,
  nextSortOrder,
  open,
  onOpenChange,
}: EmergencyContactDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(contact?.full_name ?? "");
  const [relationship, setRelationship] = useState(contact?.relationship ?? "");
  const [phonePrimary, setPhonePrimary] = useState(contact?.phone_primary ?? "");
  const [phoneSecondary, setPhoneSecondary] = useState(contact?.phone_secondary ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");

  const isEditing = !!contact;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await upsertEmergencyContact({
        ...(contact?.id ? { id: contact.id } : {}),
        full_name: fullName.trim(),
        relationship: relationship.trim(),
        phone_primary: phonePrimary.trim(),
        phone_secondary: phoneSecondary.trim() || null,
        email: email.trim() || null,
        sort_order: contact?.sort_order ?? nextSortOrder,
      });

      if (result.success) {
        toast.success(isEditing ? "Emergency contact saved" : "Emergency contact added");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Something went wrong");
        setError(result.error || "Failed to save emergency contact");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Emergency Contact" : "Add Emergency Contact"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details for this emergency contact."
              : "Add a new emergency contact. You can have up to 2 contacts."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ec_full_name">Full Name *</Label>
              <Input
                id="ec_full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Smith"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ec_relationship">Relationship *</Label>
              <Input
                id="ec_relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g. Spouse, Parent, Sibling"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ec_phone_primary">Primary Phone *</Label>
              <Input
                id="ec_phone_primary"
                type="tel"
                value={phonePrimary}
                onChange={(e) => setPhonePrimary(e.target.value)}
                placeholder="e.g. 07700 900123"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ec_phone_secondary">Secondary Phone</Label>
              <Input
                id="ec_phone_secondary"
                type="tel"
                value={phoneSecondary}
                onChange={(e) => setPhoneSecondary(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ec_email">Email</Label>
              <Input
                id="ec_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optional"
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
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
