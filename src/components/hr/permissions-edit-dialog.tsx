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
  is_content_editor:
    "Granting Content Editor access will allow this person to create, edit, and delete resource articles and categories.",
  can_post_announcements:
    "Granting Announcement Author will allow this person to post Announcement-typed posts that pin to the top of the feed and notify every active staff member. Intended for senior leadership / internal comms.",
};

const PERMISSION_LABELS: Record<string, string> = {
  is_hr_admin: "HR Admin",
  is_ld_admin: "L&D Admin",
  is_systems_admin: "Systems Admin",
  is_content_editor: "Content Editor",
  can_post_announcements: "Announcement Author",
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
  /** Whether the current user is an HR admin (only HR admins can grant HR Admin) */
  isCurrentUserHRAdmin?: boolean;
  /** Whether the current user is a systems admin (can grant L&D Admin, Systems Admin, Announcement Author) */
  isCurrentUserSystemsAdmin?: boolean;
  isHRAdmin: boolean;
  isLDAdmin: boolean;
  isSystemsAdmin: boolean;
  isContentEditor: boolean;
  isLineManager: boolean;
  canPostAnnouncements: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PermissionsEditDialog({
  profileId,
  profileName,
  currentUserId,
  isCurrentUserHRAdmin = false,
  isCurrentUserSystemsAdmin = false,
  isHRAdmin: initialHRAdmin,
  isLDAdmin: initialLDAdmin,
  isSystemsAdmin: initialSystemsAdmin,
  isContentEditor: initialContentEditor,
  isLineManager: initialLineManager,
  canPostAnnouncements: initialCanPostAnnouncements,
  open,
  onOpenChange,
}: PermissionsEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isSelf = currentUserId === profileId;

  const [isHRAdmin, setIsHRAdmin] = useState(initialHRAdmin);
  const [isLDAdmin, setIsLDAdmin] = useState(initialLDAdmin);
  const [isSystemsAdmin, setIsSystemsAdmin] = useState(initialSystemsAdmin);
  const [isContentEditor, setIsContentEditor] = useState(initialContentEditor);
  const [isLineManager, setIsLineManager] = useState(initialLineManager);
  const [canPostAnnouncements, setCanPostAnnouncements] = useState(
    initialCanPostAnnouncements,
  );

  // Permission confirmation dialog state
  const [pendingPermission, setPendingPermission] = useState<{
    field: string;
    newValue: boolean;
  } | null>(null);

  const handlePermissionToggle = useCallback((field: string) => {
    const currentValue =
      field === "is_hr_admin" ? isHRAdmin :
      field === "is_ld_admin" ? isLDAdmin :
      field === "is_systems_admin" ? isSystemsAdmin :
      field === "is_content_editor" ? isContentEditor :
      canPostAnnouncements;
    setPendingPermission({ field, newValue: !currentValue });
  }, [isHRAdmin, isLDAdmin, isSystemsAdmin, isContentEditor, canPostAnnouncements]);

  const confirmPermission = useCallback(() => {
    if (!pendingPermission) return;
    const { field, newValue } = pendingPermission;
    if (field === "is_hr_admin") setIsHRAdmin(newValue);
    else if (field === "is_ld_admin") setIsLDAdmin(newValue);
    else if (field === "is_systems_admin") setIsSystemsAdmin(newValue);
    else if (field === "is_content_editor") setIsContentEditor(newValue);
    else if (field === "can_post_announcements") setCanPostAnnouncements(newValue);
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
        is_content_editor: isContentEditor,
        is_line_manager: isLineManager,
        can_post_announcements: canPostAnnouncements,
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
                disabled={isSelf || !isCurrentUserHRAdmin}
                disabledTooltip={isSelf ? "Ask another admin to change your permissions" : "Only HR admins can grant HR Admin"}
              />

              <PermissionRow
                id="perm_is_ld_admin"
                label="L&D Admin"
                checked={isLDAdmin}
                onCheckedChange={() => handlePermissionToggle("is_ld_admin")}
                disabled={isSelf || (!isCurrentUserHRAdmin && !isCurrentUserSystemsAdmin)}
                disabledTooltip={isSelf ? "Ask another admin to change your permissions" : "Only HR admins or systems admins can change this"}
              />

              <PermissionRow
                id="perm_is_systems_admin"
                label="Systems Admin"
                checked={isSystemsAdmin}
                onCheckedChange={() => handlePermissionToggle("is_systems_admin")}
                disabled={isSelf || (!isCurrentUserHRAdmin && !isCurrentUserSystemsAdmin)}
                disabledTooltip={isSelf ? "Ask another admin to change your permissions" : "Only HR admins or systems admins can change this"}
              />

              <PermissionRow
                id="perm_is_content_editor"
                label="Content Editor"
                checked={isContentEditor}
                onCheckedChange={() => handlePermissionToggle("is_content_editor")}
                disabled={isSelf || (!isCurrentUserHRAdmin && !isCurrentUserSystemsAdmin)}
                disabledTooltip={isSelf ? "Ask another admin to change your permissions" : "Only HR admins or systems admins can change this"}
              />

              {/* Announcement Author — systems-admin-only per W4b design.
                  Decoupled from is_hr_admin: comms authority is separate
                  from HR data access. An HR admin who isn't a systems
                  admin can see the toggle but can't move it. */}
              <PermissionRow
                id="perm_can_post_announcements"
                label="Announcement Author"
                checked={canPostAnnouncements}
                onCheckedChange={() =>
                  handlePermissionToggle("can_post_announcements")
                }
                disabled={isSelf || !isCurrentUserSystemsAdmin}
                disabledTooltip={
                  isSelf
                    ? "Ask another admin to change your permissions"
                    : "Only systems admins can change this"
                }
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
