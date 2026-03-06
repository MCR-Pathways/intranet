"use client";

import { useState, useTransition, useMemo } from "react";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
} from "@/app/(protected)/hr/onboarding/actions";
import { ONBOARDING_SECTION_CONFIG, ONBOARDING_ASSIGNEE_CONFIG, ONBOARDING_SECTIONS } from "@/lib/hr";
import type {
  OnboardingTemplate,
  OnboardingTemplateItem,
  OnboardingSection,
  OnboardingAssigneeRole,
} from "@/types/hr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
  ClipboardList,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "sonner";

// =============================================
// TYPES
// =============================================

interface OnboardingTemplateManagementProps {
  templates: OnboardingTemplate[];
  templateItemsMap: Record<string, OnboardingTemplateItem[]>;
}

// =============================================
// TEMPLATE MANAGEMENT
// =============================================

export function OnboardingTemplateManagement({
  templates,
  templateItemsMap,
}: OnboardingTemplateManagementProps) {
  const [isPending, startTransition] = useTransition();
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  // Create template dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");

  // Edit template dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OnboardingTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<OnboardingTemplate | null>(null);

  // Add item dialog
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [addItemTemplateId, setAddItemTemplateId] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemSection, setNewItemSection] = useState<OnboardingSection>("general");
  const [newItemRole, setNewItemRole] = useState<OnboardingAssigneeRole>("hr_admin");
  const [newItemDueOffset, setNewItemDueOffset] = useState("0");

  // Edit item dialog
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OnboardingTemplateItem | null>(null);
  const [editItemTitle, setEditItemTitle] = useState("");
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editItemSection, setEditItemSection] = useState<OnboardingSection>("general");
  const [editItemRole, setEditItemRole] = useState<OnboardingAssigneeRole>("hr_admin");
  const [editItemDueOffset, setEditItemDueOffset] = useState("0");

  // Delete item confirmation
  const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<OnboardingTemplateItem | null>(null);

  // =============================================
  // HANDLERS — Template
  // =============================================

  function handleCreateTemplate() {
    if (!newTemplateName.trim()) return;
    startTransition(async () => {
      const result = await createTemplate({
        name: newTemplateName,
        description: newTemplateDescription || undefined,
      });
      if (result.success) {
        toast.success("Template created");
        setCreateDialogOpen(false);
        setNewTemplateName("");
        setNewTemplateDescription("");
      } else {
        toast.error(result.error ?? "Failed to create template");
      }
    });
  }

  function handleEditTemplate() {
    if (!editingTemplate || !editName.trim()) return;
    startTransition(async () => {
      const result = await updateTemplate(editingTemplate.id, {
        name: editName,
        description: editDescription || undefined,
      });
      if (result.success) {
        toast.success("Template updated");
        setEditDialogOpen(false);
      } else {
        toast.error(result.error ?? "Failed to update template");
      }
    });
  }

  function handleDeleteTemplate() {
    if (!deletingTemplate) return;
    startTransition(async () => {
      const result = await deleteTemplate(deletingTemplate.id);
      if (result.success) {
        toast.success("Template deleted");
        setDeleteDialogOpen(false);
      } else {
        toast.error(result.error ?? "Failed to delete template");
      }
    });
  }

  function handleToggleActive(template: OnboardingTemplate) {
    startTransition(async () => {
      const result = await updateTemplate(template.id, {
        is_active: !template.is_active,
      });
      if (result.success) {
        toast.success(template.is_active ? "Template deactivated" : "Template activated");
      } else {
        toast.error(result.error ?? "Failed to update template");
      }
    });
  }

  // =============================================
  // HANDLERS — Items
  // =============================================

  function handleAddItem() {
    if (!addItemTemplateId || !newItemTitle.trim()) return;
    startTransition(async () => {
      const result = await addTemplateItem(addItemTemplateId, {
        title: newItemTitle,
        description: newItemDescription || undefined,
        section: newItemSection,
        assignee_role: newItemRole,
        due_day_offset: parseInt(newItemDueOffset, 10) || 0,
      });
      if (result.success) {
        toast.success("Item added");
        setAddItemDialogOpen(false);
        resetItemForm();
      } else {
        toast.error(result.error ?? "Failed to add item");
      }
    });
  }

  function handleEditItem() {
    if (!editingItem || !editItemTitle.trim()) return;
    startTransition(async () => {
      const result = await updateTemplateItem(editingItem.id, {
        title: editItemTitle,
        description: editItemDescription || undefined,
        section: editItemSection,
        assignee_role: editItemRole,
        due_day_offset: parseInt(editItemDueOffset, 10) || 0,
      });
      if (result.success) {
        toast.success("Item updated");
        setEditItemDialogOpen(false);
      } else {
        toast.error(result.error ?? "Failed to update item");
      }
    });
  }

  function handleDeleteItem() {
    if (!deletingItem) return;
    startTransition(async () => {
      const result = await deleteTemplateItem(deletingItem.id);
      if (result.success) {
        toast.success("Item deleted");
        setDeleteItemDialogOpen(false);
      } else {
        toast.error(result.error ?? "Failed to delete item");
      }
    });
  }

  function resetItemForm() {
    setNewItemTitle("");
    setNewItemDescription("");
    setNewItemSection("general");
    setNewItemRole("hr_admin");
    setNewItemDueOffset("0");
  }

  function openEditItem(item: OnboardingTemplateItem) {
    setEditingItem(item);
    setEditItemTitle(item.title);
    setEditItemDescription(item.description ?? "");
    setEditItemSection(item.section);
    setEditItemRole(item.assignee_role);
    setEditItemDueOffset(String(item.due_day_offset));
    setEditItemDialogOpen(true);
  }

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex justify-end">
        <Button type="button" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Templates list */}
      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create your first onboarding template to get started."
          icon={ClipboardList}
        />
      ) : (
        <div className="space-y-3">
          {templates.map((template) => {
            const isExpanded = expandedTemplateId === template.id;
            const items = templateItemsMap[template.id] ?? [];

            return (
              <Card key={template.id} className="overflow-hidden">
                {/* Template header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() =>
                    setExpandedTemplateId(isExpanded ? null : template.id)
                  }
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{template.name}</span>
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {template.description}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {template.item_count ?? items.length} item{(template.item_count ?? items.length) !== 1 ? "s" : ""}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditingTemplate(template);
                          setEditName(template.name);
                          setEditDescription(template.description ?? "");
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleToggleActive(template)}
                      >
                        <Power className="h-4 w-4 mr-2" />
                        {template.is_active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setDeletingTemplate(template);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Expanded: template items */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-muted/30">
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No items yet. Add items to this template.
                      </p>
                    ) : (
                      <TemplateItemsList
                        items={items}
                        onEdit={openEditItem}
                        onDelete={(item) => {
                          setDeletingItem(item);
                          setDeleteItemDialogOpen(true);
                        }}
                      />
                    )}
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddItemTemplateId(template.id);
                          resetItemForm();
                          setAddItemDialogOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Item
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* =============================================
          DIALOGS
          ============================================= */}

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Template</DialogTitle>
            <DialogDescription>
              Create a reusable onboarding checklist template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g. Standard Staff Onboarding"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Description (optional)</Label>
              <Textarea
                id="template-description"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Brief description of when to use this template"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              loading={isPending}
              onClick={handleCreateTemplate}
              disabled={!newTemplateName.trim()}
            >
              Create
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the template name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-template-name">Name</Label>
              <Input
                id="edit-template-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-description">Description (optional)</Label>
              <Textarea
                id="edit-template-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              loading={isPending}
              onClick={handleEditTemplate}
              disabled={!editName.trim()}
            >
              Save
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingTemplate?.name}&quot;?
              This will also delete all template items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </AlertDialogClose>
            <LoadingButton
              type="button"
              variant="destructive"
              loading={isPending}
              onClick={handleDeleteTemplate}
            >
              Delete
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Item Dialog */}
      <ItemFormDialog
        open={addItemDialogOpen}
        onOpenChange={setAddItemDialogOpen}
        title="Add Item"
        description="Add a new item to this template."
        itemTitle={newItemTitle}
        onItemTitleChange={setNewItemTitle}
        itemDescription={newItemDescription}
        onItemDescriptionChange={setNewItemDescription}
        section={newItemSection}
        onSectionChange={setNewItemSection}
        assigneeRole={newItemRole}
        onAssigneeRoleChange={setNewItemRole}
        dueOffset={newItemDueOffset}
        onDueOffsetChange={setNewItemDueOffset}
        isPending={isPending}
        onSubmit={handleAddItem}
        submitLabel="Add"
      />

      {/* Edit Item Dialog */}
      <ItemFormDialog
        open={editItemDialogOpen}
        onOpenChange={setEditItemDialogOpen}
        title="Edit Item"
        description="Update this template item."
        itemTitle={editItemTitle}
        onItemTitleChange={setEditItemTitle}
        itemDescription={editItemDescription}
        onItemDescriptionChange={setEditItemDescription}
        section={editItemSection}
        onSectionChange={setEditItemSection}
        assigneeRole={editItemRole}
        onAssigneeRoleChange={setEditItemRole}
        dueOffset={editItemDueOffset}
        onDueOffsetChange={setEditItemDueOffset}
        isPending={isPending}
        onSubmit={handleEditItem}
        submitLabel="Save"
      />

      {/* Delete Item Confirmation */}
      <AlertDialog open={deleteItemDialogOpen} onOpenChange={setDeleteItemDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingItem?.title}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </AlertDialogClose>
            <LoadingButton
              type="button"
              variant="destructive"
              loading={isPending}
              onClick={handleDeleteItem}
            >
              Delete
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================
// TEMPLATE ITEMS LIST (grouped by section)
// =============================================

function TemplateItemsList({
  items,
  onEdit,
  onDelete,
}: {
  items: OnboardingTemplateItem[];
  onEdit: (item: OnboardingTemplateItem) => void;
  onDelete: (item: OnboardingTemplateItem) => void;
}) {
  // Group items by section
  const groupedItems = useMemo(() => {
    const groups: Record<string, OnboardingTemplateItem[]> = {};
    for (const section of ONBOARDING_SECTIONS) {
      const sectionItems = items.filter((i) => i.section === section);
      if (sectionItems.length > 0) {
        groups[section] = sectionItems;
      }
    }
    return groups;
  }, [items]);

  return (
    <div className="space-y-4">
      {Object.entries(groupedItems).map(([section, sectionItems]) => (
        <div key={section}>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {ONBOARDING_SECTION_CONFIG[section as OnboardingSection].label}
          </h4>
          <div className="space-y-1">
            {sectionItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-md px-3 py-2 bg-background"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </p>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className={`text-xs ${ONBOARDING_ASSIGNEE_CONFIG[item.assignee_role].colour} ${ONBOARDING_ASSIGNEE_CONFIG[item.assignee_role].bgColour} border-0 shrink-0`}
                >
                  {ONBOARDING_ASSIGNEE_CONFIG[item.assignee_role].label}
                </Badge>
                {item.due_day_offset !== 0 && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    Day {item.due_day_offset > 0 ? `+${item.due_day_offset}` : item.due_day_offset}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(item)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onDelete(item)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================
// SHARED ITEM FORM DIALOG
// =============================================

function ItemFormDialog({
  open,
  onOpenChange,
  title,
  description,
  itemTitle,
  onItemTitleChange,
  itemDescription,
  onItemDescriptionChange,
  section,
  onSectionChange,
  assigneeRole,
  onAssigneeRoleChange,
  dueOffset,
  onDueOffsetChange,
  isPending,
  onSubmit,
  submitLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemTitle: string;
  onItemTitleChange: (v: string) => void;
  itemDescription: string;
  onItemDescriptionChange: (v: string) => void;
  section: OnboardingSection;
  onSectionChange: (v: OnboardingSection) => void;
  assigneeRole: OnboardingAssigneeRole;
  onAssigneeRoleChange: (v: OnboardingAssigneeRole) => void;
  dueOffset: string;
  onDueOffsetChange: (v: string) => void;
  isPending: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="item-title">Title</Label>
            <Input
              id="item-title"
              value={itemTitle}
              onChange={(e) => onItemTitleChange(e.target.value)}
              placeholder="e.g. Collect signed contract"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-desc">Description (optional)</Label>
            <Textarea
              id="item-desc"
              value={itemDescription}
              onChange={(e) => onItemDescriptionChange(e.target.value)}
              placeholder="Additional details or instructions"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={section} onValueChange={(v) => onSectionChange(v as OnboardingSection)}>
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
                value={assigneeRole}
                onValueChange={(v) => onAssigneeRoleChange(v as OnboardingAssigneeRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ONBOARDING_ASSIGNEE_CONFIG) as OnboardingAssigneeRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ONBOARDING_ASSIGNEE_CONFIG[role].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="due-offset">Due Day Offset</Label>
            <div className="flex items-center gap-2">
              <Input
                id="due-offset"
                type="number"
                value={dueOffset}
                onChange={(e) => onDueOffsetChange(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                days from start date (0 = start date, negative = before)
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            type="button"
            loading={isPending}
            onClick={onSubmit}
            disabled={!itemTitle.trim()}
          >
            {submitLabel}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
