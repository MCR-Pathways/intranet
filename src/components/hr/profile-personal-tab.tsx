"use client";

import { useState, useTransition } from "react";
import { updatePersonalDetails, deleteEmergencyContact } from "@/app/(protected)/hr/profile/actions";
import { EmergencyContactDialog } from "./emergency-contact-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { GENDER_CONFIG, COUNTRY_OPTIONS } from "@/lib/hr";
import type { EmployeeDetails, EmergencyContact } from "@/types/hr";
import { Pencil, Plus, Trash2, Phone, Mail, User } from "lucide-react";
import { toast } from "sonner";

interface ProfilePersonalTabProps {
  employeeDetails: EmployeeDetails | null;
  emergencyContacts: EmergencyContact[];
}

/** Mask NI number, showing only the last character. */
function maskNINumber(ni: string | null): string {
  if (!ni) return "—";
  return "XX XXX XXX " + ni.slice(-1).toUpperCase();
}

export function ProfilePersonalTab({
  employeeDetails,
  emergencyContacts,
}: ProfilePersonalTabProps) {
  // Personal details form state
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [pronouns, setPronouns] = useState(employeeDetails?.pronouns ?? "");
  const [gender, setGender] = useState(employeeDetails?.gender ?? "");
  const [nationality, setNationality] = useState(employeeDetails?.nationality ?? "");
  const [personalEmail, setPersonalEmail] = useState(employeeDetails?.personal_email ?? "");
  const [personalPhone, setPersonalPhone] = useState(employeeDetails?.personal_phone ?? "");
  const [addressLine1, setAddressLine1] = useState(employeeDetails?.address_line_1 ?? "");
  const [addressLine2, setAddressLine2] = useState(employeeDetails?.address_line_2 ?? "");
  const [city, setCity] = useState(employeeDetails?.city ?? "");
  const [postcode, setPostcode] = useState(employeeDetails?.postcode ?? "");
  const [country, setCountry] = useState(employeeDetails?.country ?? "United Kingdom");

  // Emergency contact state
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<EmergencyContact | null>(null);

  const resetForm = () => {
    setPronouns(employeeDetails?.pronouns ?? "");
    setGender(employeeDetails?.gender ?? "");
    setNationality(employeeDetails?.nationality ?? "");
    setPersonalEmail(employeeDetails?.personal_email ?? "");
    setPersonalPhone(employeeDetails?.personal_phone ?? "");
    setAddressLine1(employeeDetails?.address_line_1 ?? "");
    setAddressLine2(employeeDetails?.address_line_2 ?? "");
    setCity(employeeDetails?.city ?? "");
    setPostcode(employeeDetails?.postcode ?? "");
    setCountry(employeeDetails?.country ?? "United Kingdom");
    setIsEditing(false);
    setError(null);
  };

  const handleSavePersonalDetails = () => {
    setError(null);
    startTransition(async () => {
      const result = await updatePersonalDetails({
        pronouns: pronouns || null,
        gender: gender || null,
        nationality: nationality || null,
        personal_email: personalEmail || null,
        personal_phone: personalPhone || null,
        address_line_1: addressLine1 || null,
        address_line_2: addressLine2 || null,
        city: city || null,
        postcode: postcode || null,
        country: country || "United Kingdom",
      });

      if (result.success) {
        toast.success("Personal details updated");
        setIsEditing(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
        setError(result.error || "Failed to update personal details");
      }
    });
  };

  const handleDeleteContact = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteEmergencyContact(deleteTarget.id);
      if (result.success) {
        toast.success("Emergency contact removed");
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
      setDeleteTarget(null);
    });
  };

  const handleOpenAddContact = () => {
    setEditingContact(undefined);
    setContactDialogOpen(true);
  };

  const handleOpenEditContact = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setContactDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Personal Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Personal Details</CardTitle>
          {!isEditing ? (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSavePersonalDetails}
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {success && (
            <p className="text-sm text-green-600">Details updated successfully.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Read-only fields (DOB, NI) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Date of Birth</Label>
              <p className="text-sm font-medium mt-1">
                {employeeDetails?.date_of_birth
                  ? new Date(employeeDetails.date_of_birth + "T00:00:00").toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">National Insurance Number</Label>
              <p className="text-sm font-medium mt-1">
                {maskNINumber(employeeDetails?.ni_number ?? null)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Editable fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pronouns">Pronouns</Label>
              {isEditing ? (
                <Input
                  id="pronouns"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  placeholder="e.g. she/her, he/him, they/them"
                />
              ) : (
                <p className="text-sm">{pronouns || "—"}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gender">Gender</Label>
              {isEditing ? (
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENDER_CONFIG).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">
                  {gender && gender in GENDER_CONFIG
                    ? GENDER_CONFIG[gender as keyof typeof GENDER_CONFIG].label
                    : "—"}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nationality">Nationality</Label>
              {isEditing ? (
                <Input
                  id="nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="e.g. British"
                />
              ) : (
                <p className="text-sm">{nationality || "—"}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="personal_email">Personal Email</Label>
              {isEditing ? (
                <Input
                  id="personal_email"
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="your.email@example.com"
                />
              ) : (
                <p className="text-sm">{personalEmail || "—"}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="personal_phone">Personal Phone</Label>
              {isEditing ? (
                <Input
                  id="personal_phone"
                  type="tel"
                  value={personalPhone}
                  onChange={(e) => setPersonalPhone(e.target.value)}
                  placeholder="e.g. 07700 900123"
                />
              ) : (
                <p className="text-sm">{personalPhone || "—"}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Address */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Address</Label>
            {isEditing ? (
              <div className="grid gap-3">
                <Input
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Address line 1"
                />
                <Input
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Address line 2"
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                  />
                  <Input
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="Postcode"
                  />
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <p className="text-sm">
                {[addressLine1, addressLine2, city, postcode, country]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contacts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Emergency Contacts
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenAddContact}
            disabled={emergencyContacts.length >= 2}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Contact
          </Button>
        </CardHeader>
        <CardContent>
          {emergencyContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No emergency contacts added yet. Please add at least one.
            </p>
          ) : (
            <div className="space-y-4">
              {emergencyContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium text-sm">{contact.full_name}</p>
                      <span className="text-xs text-muted-foreground">
                        ({contact.relationship})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {contact.phone_primary}
                      {contact.phone_secondary && (
                        <span className="text-xs">/ {contact.phone_secondary}</span>
                      )}
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {contact.email}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenEditContact(contact)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(contact)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Contact Dialog */}
      <EmergencyContactDialog
        contact={editingContact}
        nextSortOrder={emergencyContacts.length}
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Emergency Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteTarget?.full_name} as an
              emergency contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteContact}
              disabled={isPending}
            >
              {isPending ? "Removing..." : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
