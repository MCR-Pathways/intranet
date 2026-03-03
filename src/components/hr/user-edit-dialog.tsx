"use client";

import { useState, useTransition, useMemo } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CONTRACT_TYPE_CONFIG,
  DEPARTMENT_CONFIG,
  DEPARTMENT_ADMIN_MAP,
  REGION_CONFIG,
  WORK_PATTERN_CONFIG,
} from "@/lib/hr";
import type { Department } from "@/lib/hr";
import type { UserTableProfile } from "./user-table";
import { toast } from "sonner";

// =============================================
// HELPERS
// =============================================

/** Compute which admin role a department auto-grants (if any) */
function getDepartmentAdminRole(dept: string | null): "hr_admin" | "ld_admin" | "systems_admin" | null {
  if (!dept) return null;
  return DEPARTMENT_ADMIN_MAP[dept as Department] ?? null;
}

/** Check if a permission is auto-granted by the current department selection */
function isAutoGranted(dept: string | null, flag: "hr_admin" | "ld_admin" | "systems_admin"): boolean {
  return getDepartmentAdminRole(dept) === flag;
}

/** Get the department label for badge text */
function getDepartmentLabel(dept: string | null): string {
  if (!dept) return "";
  return DEPARTMENT_CONFIG[dept as Department]?.label ?? dept;
}

// =============================================
// PERMISSION ROW COMPONENT
// =============================================

interface PermissionRowProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  autoGranted: boolean;
  manualOverride: boolean;
  departmentLabel: string;
  disabled: boolean;
  disabledTooltip?: string;
}

function PermissionRow({
  id,
  label,
  checked,
  onCheckedChange,
  autoGranted,
  manualOverride,
  departmentLabel,
  disabled,
  disabledTooltip,
}: PermissionRowProps) {
  const switchElement = (
    <Switch
      id={id}
      checked={checked || autoGranted}
      onCheckedChange={onCheckedChange}
      disabled={disabled || autoGranted}
    />
  );

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Label htmlFor={id} className="shrink-0">{label}</Label>
        {autoGranted && (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            Via {departmentLabel}
          </span>
        )}
        {manualOverride && !autoGranted && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            Manual override
          </span>
        )}
      </div>
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

interface UserEditDialogProps {
  profile: UserTableProfile;
  currentUserId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserEditDialog({
  profile,
  currentUserId,
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
  const [department, setDepartment] = useState(profile.department ?? "");
  const [region, setRegion] = useState(profile.region ?? "");
  const [workPattern, setWorkPattern] = useState(profile.work_pattern ?? "standard");
  const [startDate, setStartDate] = useState(profile.start_date ?? "");
  const [isExternal, setIsExternal] = useState(profile.is_external ?? false);

  // Compute auto-granted permissions based on selected department
  const hrAutoGranted = useMemo(() => isAutoGranted(department || null, "hr_admin"), [department]);
  const ldAutoGranted = useMemo(() => isAutoGranted(department || null, "ld_admin"), [department]);
  const systemsAutoGranted = useMemo(() => isAutoGranted(department || null, "systems_admin"), [department]);

  const deptLabel = useMemo(() => getDepartmentLabel(department || null), [department]);

  // Whether admin flags differ from what the DB has (manual overrides)
  const hrManualOverride = isHRAdmin && !hrAutoGranted;
  const ldManualOverride = isLDAdmin && !ldAutoGranted;
  const systemsManualOverride = isSystemsAdmin && !systemsAutoGranted;

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
        department: department || null,
        region: region || null,
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

  return (
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
                      <SelectItem value="">None</SelectItem>
                      {Object.entries(DEPARTMENT_CONFIG).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>
                          {label}
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
                    <SelectItem value="">None</SelectItem>
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

            {(hrAutoGranted || ldAutoGranted || systemsAutoGranted) && (
              <p className="text-xs text-muted-foreground -mt-2">
                Some permissions are automatically granted based on department.
              </p>
            )}

            <PermissionRow
              id="is_hr_admin"
              label="HR Admin"
              checked={isHRAdmin}
              onCheckedChange={setIsHRAdmin}
              autoGranted={hrAutoGranted}
              manualOverride={hrManualOverride}
              departmentLabel={deptLabel}
              disabled={isSelf}
              disabledTooltip="Ask another admin to change your permissions"
            />

            <PermissionRow
              id="is_ld_admin"
              label="L&D Admin"
              checked={isLDAdmin}
              onCheckedChange={setIsLDAdmin}
              autoGranted={ldAutoGranted}
              manualOverride={ldManualOverride}
              departmentLabel={deptLabel}
              disabled={isSelf}
              disabledTooltip="Ask another admin to change your permissions"
            />

            <PermissionRow
              id="is_systems_admin"
              label="Systems Admin"
              checked={isSystemsAdmin}
              onCheckedChange={setIsSystemsAdmin}
              autoGranted={systemsAutoGranted}
              manualOverride={systemsManualOverride}
              departmentLabel={deptLabel}
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
  );
}
