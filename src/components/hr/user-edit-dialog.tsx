"use client";

import { useState, useTransition, useCallback } from "react";
import { updateUserProfile } from "@/app/(protected)/hr/users/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CONTRACT_TYPE_CONFIG,
  REGION_CONFIG,
  WORK_PATTERN_CONFIG,
} from "@/lib/hr";
import type { UserTableProfile } from "./user-table";
import { toast } from "sonner";

// =============================================
// PERMISSION CONFIRMATION MESSAGES
// =============================================

const PERMISSION_WARNINGS: Record<string, string> = {
  is_hr_admin:
    "Granting HR Admin access will allow this person to view and manage all employee records, leave requests, absence data, compliance documents, and grant admin permissions to others.",
  is_ld_admin:
    "Granting L&D Admin access will allow this person to create, edit, and publish learning courses and manage all learner enrolments.",
  is_systems_admin:
    "Granting Systems Admin access will allow this person to manage company assets, user accounts, and system configuration.",
};

const PERMISSION_LABELS: Record<string, string> = {
  is_hr_admin: "HR Admin",
  is_ld_admin: "L&D Admin",
  is_systems_admin: "Systems Admin",
};

// =============================================
// PERMISSION ROW COMPONENT
// =============================================

interface PermissionRowProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  disabledTooltip?: string;
}

function PermissionRow({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
  disabledTooltip,
}: PermissionRowProps) {
  const switchElement = (
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
    />
  );

  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="shrink-0">{label}</Label>
      {disabled && disabledTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{switchElement}</TooltipTrigger>
          <TooltipContent>{disabledTooltip}</TooltipContent>
        </Tooltip>
      ) : (
        switchElement
      )}
    </div>
  );
}

// =============================================
// DIALOG COMPONENT
// =============================================

/** Department option from DB */
export interface DepartmentOption {
  slug: string;
  name: string;
}

interface UserEditDialogProps {
  profile: UserTableProfile;
  currentUserId?: string;
  departments?: DepartmentOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserEditDialog({
  profile,
  currentUserId,
  departments = [],
  open,
  onOpenChange,
}: UserEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isSelf = currentUserId === profile.id;

  // Existing fields
  const [fullName, setFullName] = useState(profile.full_name);
  const [jobTitle, setJobTitle] = useState(profile.job_title || "");
  const [userType, setUserType] = useState<string>(profile.user_type);
  const [status, setStatus] = useState<string>(profile.status);
  const [isHRAdmin, setIsHRAdmin] = useState(profile.is_hr_admin);
  const [isLDAdmin, setIsLDAdmin] = useState(profile.is_ld_admin);
  const [isSystemsAdmin, setIsSystemsAdmin] = useState(profile.is_systems_admin ?? false);
  const [isLineManager, setIsLineManager] = useState(profile.is_line_manager);

  // Employment fields
  const [fte, setFte] = useState(String(profile.fte ?? 1));
  const [contractType, setContractType] = useState(profile.contract_type ?? "permanent");
  const [department, setDepartment] = useState(profile.department || "__none__");
  const [region, setRegion] = useState(profile.region || "__none__");
  const [workPattern, setWorkPattern] = useState(profile.work_pattern ?? "standard");
  const [startDate, setStartDate] = useState(profile.start_date ?? "");
  const [isExternal, setIsExternal] = useState(profile.is_external ?? false);

  // Permission confirmation dialog state
  const [pendingPermission, setPendingPermission] = useState<{
    field: string;
    newValue: boolean;
  } | null>(null);

  const handlePermissionToggle = useCallback((field: string, currentValue: boolean, setter: (v: boolean) => void) => {
    const newValue = !currentValue;
    // Show confirmation for both granting and revoking
    setPendingPermission({ field, newValue });
  }, []);

  const confirmPermission = useCallback(() => {
    if (!pendingPermission) return;
    const { field, newValue } = pendingPermission;
    if (field === "is_hr_admin") setIsHRAdmin(newValue);
    else if (field === "is_ld_admin") setIsLDAdmin(newValue);
    else if (field === "is_systems_admin") setIsSystemsAdmin(newValue);
    setPendingPermission(null);
  }, [pendingPermission]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fteNum = parseFloat(fte);
    if (isNaN(fteNum) || fteNum < 0 || fteNum > 1) {
      setError("FTE must be between 0 and 1");
      return;
    }

    startTransition(async () => {
      const result = await updateUserProfile(profile.id, {
        full_name: fullName,
        job_title: jobTitle || null,
        user_type: userType,
        status,
        is_hr_admin: isHRAdmin,
        is_ld_admin: isLDAdmin,
        is_systems_admin: isSystemsAdmin,
        is_line_manager: isLineManager,
        fte: fteNum,
        contract_type: contractType,
        department: department === "__none__" ? null : department,
        region: region === "__none__" ? null : region,
        work_pattern: workPattern,
        start_date: startDate || null,
        is_external: isExternal,
      });

      if (result.success) {
        toast.success("Profile updated");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
        setError(result.error || "Failed to update user");
      }
    });
  };

  const permissionConfirmTitle = pendingPermission
    ? pendingPermission.newValue
      ? `Grant ${PERMISSION_LABELS[pendingPermission.field]} Access`
      : `Remove ${PERMISSION_LABELS[pendingPermission.field]} Access`
    : "";

  const permissionConfirmDescription = pendingPermission
    ? pendingPermission.newValue
      ? PERMISSION_WARNINGS[pendingPermission.field]
      : `Removing ${PERMISSION_LABELS[pendingPermission.field]} access from ${profile.full_name} will take effect immediately.`
    : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update {profile.full_name}&apos;s profile and permissions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Core fields */}
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

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <Separator />

              {/* Employment fields */}
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Employment
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="department">Department</Label>
                  {isSelf ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Select value={department} disabled>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </Select>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Ask another admin to change your department</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.slug} value={dept.slug}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="region">Region</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {Object.entries(REGION_CONFIG).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="fte">FTE</Label>
                  <Input
                    id="fte"
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={fte}
                    onChange={(e) => setFte(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="contract_type">Contract</Label>
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTRACT_TYPE_CONFIG).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="work_pattern">Pattern</Label>
                  <Select value={workPattern} onValueChange={setWorkPattern}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(WORK_PATTERN_CONFIG).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <Separator />

              {/* Permission toggles */}
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Permissions
              </p>

              <PermissionRow
                id="is_hr_admin"
                label="HR Admin"
                checked={isHRAdmin}
                onCheckedChange={() => handlePermissionToggle("is_hr_admin", isHRAdmin, setIsHRAdmin)}
                disabled={isSelf}
                disabledTooltip="Ask another admin to change your permissions"
              />

              <PermissionRow
                id="is_ld_admin"
                label="L&D Admin"
                checked={isLDAdmin}
                onCheckedChange={() => handlePermissionToggle("is_ld_admin", isLDAdmin, setIsLDAdmin)}
                disabled={isSelf}
                disabledTooltip="Ask another admin to change your permissions"
              />

              <PermissionRow
                id="is_systems_admin"
                label="Systems Admin"
                checked={isSystemsAdmin}
                onCheckedChange={() => handlePermissionToggle("is_systems_admin", isSystemsAdmin, setIsSystemsAdmin)}
                disabled={isSelf}
                disabledTooltip="Ask another admin to change your permissions"
              />

              <div className="flex items-center justify-between">
                <Label htmlFor="is_line_manager">Line Manager</Label>
                <Switch
                  id="is_line_manager"
                  checked={isLineManager}
                  onCheckedChange={setIsLineManager}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_external">External Employee</Label>
                <Switch
                  id="is_external"
                  checked={isExternal}
                  onCheckedChange={setIsExternal}
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

      {/* Permission confirmation dialog */}
      <AlertDialog
        open={!!pendingPermission}
        onOpenChange={(open) => {
          if (!open) setPendingPermission(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{permissionConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {permissionConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </AlertDialogClose>
            <Button
              type="button"
              variant={pendingPermission?.newValue ? "default" : "destructive"}
              onClick={confirmPermission}
            >
              {pendingPermission?.newValue ? "Grant Access" : "Remove Access"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
