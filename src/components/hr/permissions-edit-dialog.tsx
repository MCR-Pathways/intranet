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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

interface PermissionsEditDialogProps {
  profileId: string;
  profileName: string;
  currentUserId?: string;
  isHRAdmin: boolean;
  isLDAdmin: boolean;
  isSystemsAdmin: boolean;
  isLineManager: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PermissionsEditDialog({
  profileId,
  profileName,
  currentUserId,
  isHRAdmin: initialHRAdmin,
  isLDAdmin: initialLDAdmin,
  isSystemsAdmin: initialSystemsAdmin,
  isLineManager: initialLineManager,
  open,
  onOpenChange,
}: PermissionsEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isSelf = currentUserId === profileId;

  const [isHRAdmin, setIsHRAdmin] = useState(initialHRAdmin);
  const [isLDAdmin, setIsLDAdmin] = useState(initialLDAdmin);
  const [isSystemsAdmin, setIsSystemsAdmin] = useState(initialSystemsAdmin);
  const [isLineManager, setIsLineManager] = useState(initialLineManager);

  // Permission confirmation dialog state
  const [pendingPermission, setPendingPermission] = useState<{
    field: string;
    newValue: boolean;
  } | null>(null);

  const handlePermissionToggle = useCallback((field: string) => {
    const currentValue =
      field === "is_hr_admin" ? isHRAdmin :
      field === "is_ld_admin" ? isLDAdmin :
      isSystemsAdmin;
    setPendingPermission({ field, newValue: !currentValue });
  }, [isHRAdmin, isLDAdmin, isSystemsAdmin]);

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

    startTransition(async () => {
      const result = await updateUserProfile(profileId, {
        is_hr_admin: isHRAdmin,
        is_ld_admin: isLDAdmin,
        is_systems_admin: isSystemsAdmin,
        is_line_manager: isLineManager,
      });

      if (result.success) {
        toast.success("Permissions updated");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
        setError(result.error || "Failed to update permissions");
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
      : `Removing ${PERMISSION_LABELS[pendingPermission.field]} access from ${profileName} will take effect immediately.`
    : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Permissions</DialogTitle>
            <DialogDescription>
              Manage system permissions for {profileName}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <PermissionRow
                id="perm_is_hr_admin"
                label="HR Admin"
                checked={isHRAdmin}
                onCheckedChange={() => handlePermissionToggle("is_hr_admin")}
                disabled={isSelf}
                disabledTooltip="Ask another admin to change your permissions"
              />

              <PermissionRow
                id="perm_is_ld_admin"
                label="L&D Admin"
                checked={isLDAdmin}
                onCheckedChange={() => handlePermissionToggle("is_ld_admin")}
                disabled={isSelf}
                disabledTooltip="Ask another admin to change your permissions"
              />

              <PermissionRow
                id="perm_is_systems_admin"
                label="Systems Admin"
                checked={isSystemsAdmin}
                onCheckedChange={() => handlePermissionToggle("is_systems_admin")}
                disabled={isSelf}
                disabledTooltip="Ask another admin to change your permissions"
              />

              <div className="flex items-center justify-between">
                <Label htmlFor="perm_is_line_manager">Line Manager</Label>
                <Switch
                  id="perm_is_line_manager"
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

      {/* Permission confirmation dialog */}
      <AlertDialog
        open={!!pendingPermission}
        onOpenChange={(alertOpen) => {
          if (!alertOpen) setPendingPermission(null);
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
