"use client";

import { useState, useTransition } from "react";
import { updateEmployeePersonalDetails } from "@/app/(protected)/hr/users/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GENDER_CONFIG, COUNTRY_OPTIONS } from "@/lib/hr";
import type { EmployeeDetails } from "@/types/hr";
import { toast } from "sonner";

interface PersonalDetailsEditDialogProps {
  userId: string;
  employeeDetails: EmployeeDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PersonalDetailsEditDialog({
  userId,
  employeeDetails,
  open,
  onOpenChange,
}: PersonalDetailsEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [dateOfBirth, setDateOfBirth] = useState(employeeDetails?.date_of_birth ?? "");
  const [gender, setGender] = useState(employeeDetails?.gender ?? "");
  const [pronouns, setPronouns] = useState(employeeDetails?.pronouns ?? "");
  const [nationality, setNationality] = useState(employeeDetails?.nationality ?? "");
  const [personalEmail, setPersonalEmail] = useState(employeeDetails?.personal_email ?? "");
  const [personalPhone, setPersonalPhone] = useState(employeeDetails?.personal_phone ?? "");
  const [niNumber, setNiNumber] = useState(employeeDetails?.ni_number ?? "");
  const [addressLine1, setAddressLine1] = useState(employeeDetails?.address_line_1 ?? "");
  const [addressLine2, setAddressLine2] = useState(employeeDetails?.address_line_2 ?? "");
  const [city, setCity] = useState(employeeDetails?.city ?? "");
  const [postcode, setPostcode] = useState(employeeDetails?.postcode ?? "");
  const [country, setCountry] = useState(employeeDetails?.country ?? "United Kingdom");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateEmployeePersonalDetails(userId, {
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        pronouns: pronouns || null,
        nationality: nationality || null,
        personal_email: personalEmail || null,
        personal_phone: personalPhone || null,
        ni_number: niNumber || null,
        address_line_1: addressLine1 || null,
        address_line_2: addressLine2 || null,
        city: city || null,
        postcode: postcode || null,
        country: country || "United Kingdom",
      });

      if (result.success) {
        toast.success("Personal details updated");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Something went wrong");
        setError(result.error || "Failed to update personal details");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Personal Details</DialogTitle>
          <DialogDescription>
            Update personal information. These details are sensitive and
            only visible to HR administrators.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pd_dob">Date of Birth</Label>
                <Input
                  id="pd_dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pd_ni">NI Number</Label>
                <Input
                  id="pd_ni"
                  value={niNumber}
                  onChange={(e) => setNiNumber(e.target.value)}
                  placeholder="e.g. QQ 12 34 56 C"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pd_gender">Gender</Label>
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
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pd_pronouns">Pronouns</Label>
                <Input
                  id="pd_pronouns"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  placeholder="e.g. she/her"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pd_nationality">Nationality</Label>
                <Input
                  id="pd_nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="e.g. British"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pd_personal_email">Personal Email</Label>
                <Input
                  id="pd_personal_email"
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pd_personal_phone">Personal Phone</Label>
              <Input
                id="pd_personal_phone"
                type="tel"
                value={personalPhone}
                onChange={(e) => setPersonalPhone(e.target.value)}
                placeholder="e.g. 07700 900123"
              />
            </div>

            <div className="grid gap-2">
              <Label>Address</Label>
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
              <div className="grid grid-cols-3 gap-3">
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
