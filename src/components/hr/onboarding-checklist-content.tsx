"use client";

import { useState, useMemo, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  ONBOARDING_SECTION_CONFIG,
  ONBOARDING_ASSIGNEE_CONFIG,
  ONBOARDING_STATUS_CONFIG,
  ONBOARDING_SECTIONS,
  formatHRDate,
} from "@/lib/hr";
import type {
  OnboardingChecklistWithProgress,
  OnboardingChecklistItem,
  OnboardingSection,
  OnboardingAssigneeRole,
} from "@/types/hr";
import {
  toggleChecklistItem,
  completeOnboardingChecklist,
  cancelOnboardingChecklist,
  addChecklistItem,
} from "@/app/(protected)/hr/onboarding/actions";
import { OnboardingProgressBar } from "@/components/hr/onboarding-progress-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/loading-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Plus, Ban } from "lucide-react";
import { getInitials, getAvatarColour, filterAvatarUrl } from "@/lib/utils";
import { MAX_SHORT_TEXT_LENGTH, MAX_MEDIUM_TEXT_LENGTH } from "@/lib/validation";
import { toast } from "sonner";

// =============================================
// TYPES
// =============================================

interface OnboardingChecklistContentProps {
  checklist: OnboardingChecklistWithProgress;
  items: OnboardingChecklistItem[];
}

// =============================================
// COMPONENT
// =============================================

export function OnboardingChecklistContent({
  checklist,
  items,
}: OnboardingChecklistContentProps) {
  const [isPending, startTransition] = useTransition();
  const isActive = checklist.status === "active";
  const statusConfig = ONBOARDING_STATUS_CONFIG[checklist.status];

  // Complete/cancel confirmation dialogs
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Add item dialog
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemSection, setNewItemSection] = useState<OnboardingSection>("general");
  const [newItemRole, setNewItemRole] = useState<OnboardingAssigneeRole>("hr_admin");
  const [newItemDueDate, setNewItemDueDate] = useState("");

  // Group items by section
  const groupedItems = useMemo(() => {
    const groups: Record<string, OnboardingChecklistItem[]> = {};
    for (const section of ONBOARDING_SECTIONS) {
      const sectionItems = items.filter((i) => i.section === section);
      if (sectionItems.length > 0) {
        groups[section] = sectionItems;
      }
    }
    return groups;
  }, [items]);

  // Progress
  const completedCount = items.filter((i) => i.is_completed).length;
  const totalCount = items.length;
  const allComplete = completedCount === totalCount && totalCount > 0;

  const today = new Date().toISOString().split("T")[0];

  // =============================================
  // HANDLERS
  // =============================================

  function handleToggleItem(itemId: string, completed: boolean) {
    startTransition(async () => {
      const result = await toggleChecklistItem(itemId, completed);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update item");
      }
    });
  }

  function handleComplete() {
    startTransition(async () => {
      const result = await completeOnboardingChecklist(checklist.id);
      if (result.success) {
        toast.success("Onboarding marked as complete");
        setCompleteDialogOpen(false);
      } else {
        toast.error(result.error ?? "Failed to complete onboarding");
      }
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelOnboardingChecklist(checklist.id);
      if (result.success) {
        toast.success("Onboarding cancelled");
        setCancelDialogOpen(false);
      } else {
        toast.error(result.error ?? "Failed to cancel onboarding");
      }
    });
  }

  function handleAddItem() {
    if (!newItemTitle.trim()) return;
    startTransition(async () => {
      const result = await addChecklistItem(checklist.id, {
        title: newItemTitle,
        description: newItemDescription || undefined,
        section: newItemSection,
        assignee_role: newItemRole,
        due_date: newItemDueDate || undefined,
      });
      if (result.success) {
        toast.success("Item added");
        setAddItemDialogOpen(false);
        setNewItemTitle("");
        setNewItemDescription("");
        setNewItemSection("general");
        setNewItemRole("hr_admin");
        setNewItemDueDate("");
      } else {
        toast.error(result.error ?? "Failed to add item");
      }
    });
  }

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={filterAvatarUrl(checklist.employee_avatar)} />
              <AvatarFallback className={cn(getAvatarColour(checklist.employee_name).bg, getAvatarColour(checklist.employee_name).fg)}>
                {getInitials(checklist.employee_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold">{checklist.employee_name}</h2>
                <Badge
                  variant="secondary"
                  className={cn("border-0", statusConfig?.colour, statusConfig?.bgColour)}
                >
                  {statusConfig?.label ?? checklist.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                {checklist.employee_job_title && (
                  <span>{checklist.employee_job_title}</span>
                )}
                {checklist.employee_department && (
                  <span>· {checklist.employee_department}</span>
                )}
                <span>· Start: {formatHRDate(checklist.start_date)}</span>
                {checklist.template_name && (
                  <span>· Template: {checklist.template_name}</span>
                )}
              </div>
              {checklist.notes && (
                <p className="text-sm text-muted-foreground mt-2">{checklist.notes}</p>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4">
            <OnboardingProgressBar
              completed={completedCount}
              total={totalCount}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      {isActive && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddItemDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCancelDialogOpen(true)}
          >
            <Ban className="h-4 w-4 mr-1" />
            Cancel Onboarding
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!allComplete}
            onClick={() => setCompleteDialogOpen(true)}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Complete Onboarding
          </Button>
        </div>
      )}

      {/* Items grouped by section */}
      {Object.entries(groupedItems).map(([section, sectionItems]) => (
        <div key={section}>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {ONBOARDING_SECTION_CONFIG[section as OnboardingSection].label}
            <span className="ml-2 text-xs font-normal">
              ({sectionItems.filter((i) => i.is_completed).length}/{sectionItems.length})
            </span>
          </h3>
          <Card>
            <div className="divide-y">
              {sectionItems.map((item) => {
                const isOverdue = !item.is_completed && item.due_date && item.due_date < today;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3",
                      item.is_completed && "opacity-60",
                    )}
                  >
                    {/* Checkbox */}
                    <Checkbox
                      checked={item.is_completed}
                      onCheckedChange={(checked) =>
                        handleToggleItem(item.id, !!checked)
                      }
                      disabled={!isActive || isPending}
                      className="mt-0.5"
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          item.is_completed && "line-through text-muted-foreground",
                        )}
                      >
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      )}
                      {item.is_completed && item.completed_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Completed {formatHRDate(item.completed_at)}
                        </p>
                      )}
                    </div>

                    {/* Assignee role badge */}
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs border-0 shrink-0",
                        ONBOARDING_ASSIGNEE_CONFIG[item.assignee_role].colour,
                        ONBOARDING_ASSIGNEE_CONFIG[item.assignee_role].bgColour,
                      )}
                    >
                      {ONBOARDING_ASSIGNEE_CONFIG[item.assignee_role].label}
                    </Badge>

                    {/* Due date */}
                    {item.due_date && (
                      <span
                        className={cn(
                          "text-xs shrink-0",
                          isOverdue ? "text-red-600 font-medium" : "text-muted-foreground",
                        )}
                      >
                        {isOverdue && "⚠ "}
                        {formatHRDate(item.due_date)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ))}

      {/* =============================================
          DIALOGS
          ============================================= */}

      {/* Complete confirmation */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Onboarding</AlertDialogTitle>
            <AlertDialogDescription>
              Mark {checklist.employee_name}&apos;s onboarding as complete? This will notify the employee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </AlertDialogClose>
            <LoadingButton
              type="button"
              loading={isPending}
              onClick={handleComplete}
            >
              Complete
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Onboarding</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel {checklist.employee_name}&apos;s onboarding?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button type="button" variant="outline">Keep Active</Button>
            </AlertDialogClose>
            <LoadingButton
              type="button"
              variant="destructive"
              loading={isPending}
              onClick={handleCancel}
            >
              Cancel Onboarding
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add item dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
            <DialogDescription>
              Add an ad-hoc task to this onboarding checklist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-item-title">Title</Label>
              <Input
                id="new-item-title"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="e.g. Order additional monitor"
                maxLength={MAX_SHORT_TEXT_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-item-desc">Description (optional)</Label>
              <Textarea
                id="new-item-desc"
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                rows={2}
                maxLength={MAX_MEDIUM_TEXT_LENGTH}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={newItemSection}
                  onValueChange={(v) => setNewItemSection(v as OnboardingSection)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ONBOARDING_SECTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ONBOARDING_SECTION_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignee Role</Label>
                <Select
                  value={newItemRole}
                  onValueChange={(v) => setNewItemRole(v as OnboardingAssigneeRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ONBOARDING_ASSIGNEE_CONFIG) as OnboardingAssigneeRole[]).map(
                      (role) => (
                        <SelectItem key={role} value={role}>
                          {ONBOARDING_ASSIGNEE_CONFIG[role].label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-item-due">Due Date (optional)</Label>
              <Input
                id="new-item-due"
                type="date"
                value={newItemDueDate}
                onChange={(e) => setNewItemDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddItemDialogOpen(false)}
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              loading={isPending}
              onClick={handleAddItem}
              disabled={!newItemTitle.trim()}
            >
              Add
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
