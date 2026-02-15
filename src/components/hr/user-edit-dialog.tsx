"use client";

import { useState, useTransition } from "react";
import { updateUserProfile } from "@/app/(protected)/hr/users/actions";
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
import { Switch } from "@/components/ui/switch";
import type { Profile } from "@/types/database.types";

interface UserEditDialogProps {
  profile: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserEditDialog({
  profile,
  open,
  onOpenChange,
}: UserEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(profile.full_name);
  const [jobTitle, setJobTitle] = useState(profile.job_title || "");
  const [userType, setUserType] = useState<string>(profile.user_type);
  const [status, setStatus] = useState<string>(profile.status);
  const [isHRAdmin, setIsHRAdmin] = useState(profile.is_hr_admin);
  const [isLDAdmin, setIsLDAdmin] = useState(profile.is_ld_admin);
  const [isLineManager, setIsLineManager] = useState(profile.is_line_manager);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateUserProfile(profile.id, {
        full_name: fullName,
        job_title: jobTitle || null,
        user_type: userType,
        status,
        is_hr_admin: isHRAdmin,
        is_ld_admin: isLDAdmin,
        is_line_manager: isLineManager,
      });

      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to update user");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update {profile.full_name}&apos;s profile and permissions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile.email} disabled />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="job_title">Job Title</Label>
              <Input
                id="job_title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Programme Coordinator"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user_type">Role</Label>
              <Select value={userType} onValueChange={setUserType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="pathways_coordinator">
                    Pathways Coordinator
                  </SelectItem>
                  <SelectItem value="new_user">New User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending_induction">
                    Pending Induction
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_hr_admin">HR Admin</Label>
              <Switch
                id="is_hr_admin"
                checked={isHRAdmin}
                onCheckedChange={setIsHRAdmin}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_ld_admin">L&D Admin</Label>
              <Switch
                id="is_ld_admin"
                checked={isLDAdmin}
                onCheckedChange={setIsLDAdmin}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_line_manager">Line Manager</Label>
              <Switch
                id="is_line_manager"
                checked={isLineManager}
                onCheckedChange={setIsLineManager}
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
