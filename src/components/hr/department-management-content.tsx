"use client";

import { useState, useTransition } from "react";
import {
  createDepartment,
  updateDepartment,
  toggleDepartmentActive,
} from "@/app/(protected)/hr/departments/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Power } from "lucide-react";
import { toast } from "sonner";

// =============================================
// TYPES
// =============================================

interface DepartmentRow {
  id: string;
  slug: string;
  name: string;
  colour: string;
  sort_order: number;
  is_active: boolean;
  staff_count: number;
}

interface DepartmentManagementContentProps {
  departments: DepartmentRow[];
}

// =============================================
// SLUG GENERATOR
// =============================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/_+/g, "_");
}

// =============================================
// COLOUR SWATCH COMPONENT
// =============================================

function ColourSwatch({ colour }: { colour: string }) {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border border-border shrink-0"
      style={{ backgroundColor: colour }}
      aria-label={`Colour: ${colour}`}
    />
  );
}

// =============================================
// DEPARTMENT FORM DIALOG
// =============================================

interface DepartmentFormState {
  name: string;
  slug: string;
  colour: string;
  sort_order: string;
}

const DEFAULT_FORM_STATE: DepartmentFormState = {
  name: "",
  slug: "",
  colour: "#6b7280",
  sort_order: "0",
};

function DepartmentFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: DepartmentFormState;
  onSubmit: (data: DepartmentFormState) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<DepartmentFormState>(
    initialData ?? DEFAULT_FORM_STATE
  );
  const [autoSlug, setAutoSlug] = useState(mode === "create");

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      ...(autoSlug ? { slug: generateSlug(name) } : {}),
    }));
  };

  const handleSlugChange = (slug: string) => {
    setAutoSlug(false);
    setForm((prev) => ({ ...prev, slug }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Department" : "Edit Department"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new department to the organisation."
              : "Update department details."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Marketing & Communications"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dept-slug">Slug</Label>
            <Input
              id="dept-slug"
              value={form.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="e.g. marketing_communications"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Used internally. Auto-generated from name.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dept-colour">Colour</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="dept-colour"
                value={form.colour}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, colour: e.target.value }))
                }
                className="h-9 w-14 cursor-pointer rounded border border-border p-1"
              />
              <Input
                value={form.colour}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, colour: e.target.value }))
                }
                placeholder="#6b7280"
                className="font-mono text-sm flex-1"
              />
              <ColourSwatch colour={form.colour} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dept-sort">Sort Order</Label>
            <Input
              id="dept-sort"
              type="number"
              min="0"
              value={form.sort_order}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sort_order: e.target.value }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !form.name.trim() || !form.slug.trim()}
            onClick={() => onSubmit(form)}
          >
            {isPending
              ? "Saving..."
              : mode === "create"
                ? "Create"
                : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// MAIN COMPONENT
// =============================================

export function DepartmentManagementContent({
  departments,
}: DepartmentManagementContentProps) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRow | null>(null);
  const [toggleTarget, setToggleTarget] = useState<DepartmentRow | null>(null);

  const handleCreate = (data: DepartmentFormState) => {
    startTransition(async () => {
      const result = await createDepartment({
        name: data.name,
        slug: data.slug,
        colour: data.colour,
        sort_order: parseInt(data.sort_order) || 0,
      });

      if (result.success) {
        toast.success("Department created");
        setCreateOpen(false);
      } else {
        toast.error(result.error || "Failed to create department");
      }
    });
  };

  const handleUpdate = (data: DepartmentFormState) => {
    if (!editingDept) return;
    startTransition(async () => {
      const result = await updateDepartment(editingDept.id, {
        name: data.name,
        slug: data.slug,
        colour: data.colour,
        sort_order: parseInt(data.sort_order) || 0,
      });

      if (result.success) {
        toast.success("Department updated");
        setEditingDept(null);
      } else {
        toast.error(result.error || "Failed to update department");
      }
    });
  };

  const handleToggleActive = () => {
    if (!toggleTarget) return;
    startTransition(async () => {
      const result = await toggleDepartmentActive(toggleTarget.id);

      if (result.success) {
        toast.success(
          toggleTarget.is_active
            ? "Department deactivated"
            : "Department reactivated"
        );
        setToggleTarget(null);
      } else {
        toast.error(result.error || "Failed to update department");
      }
    });
  };

  return (
    <>
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {departments.length} department{departments.length !== 1 ? "s" : ""}
        </p>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Department
        </Button>
      </div>

      {/* Departments table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Colour
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Staff
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Order
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr
                  key={dept.id}
                  className="border-b last:border-0 hover:bg-muted/25"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ColourSwatch colour={dept.colour} />
                      <span className="font-medium">{dept.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {dept.slug}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">{dept.colour}</span>
                  </td>
                  <td className="px-4 py-3">{dept.staff_count}</td>
                  <td className="px-4 py-3">{dept.sort_order}</td>
                  <td className="px-4 py-3">
                    <Badge variant={dept.is_active ? "success" : "destructive"}>
                      {dept.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => setEditingDept(dept)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setToggleTarget(dept)}
                        >
                          <Power className="mr-2 h-4 w-4" />
                          {dept.is_active ? "Deactivate" : "Reactivate"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No departments yet. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create dialog */}
      {createOpen && (
        <DepartmentFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          onSubmit={handleCreate}
          isPending={isPending}
        />
      )}

      {/* Edit dialog */}
      {editingDept && (
        <DepartmentFormDialog
          open={!!editingDept}
          onOpenChange={(open) => {
            if (!open) setEditingDept(null);
          }}
          mode="edit"
          initialData={{
            name: editingDept.name,
            slug: editingDept.slug,
            colour: editingDept.colour,
            sort_order: String(editingDept.sort_order),
          }}
          onSubmit={handleUpdate}
          isPending={isPending}
        />
      )}

      {/* Toggle active confirmation */}
      <AlertDialog
        open={!!toggleTarget}
        onOpenChange={(open) => {
          if (!open) setToggleTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.is_active
                ? `Deactivate ${toggleTarget?.name}?`
                : `Reactivate ${toggleTarget?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.is_active
                ? toggleTarget?.staff_count > 0
                  ? `This department has ${toggleTarget.staff_count} active employee${toggleTarget.staff_count === 1 ? "" : "s"}. Reassign them before deactivating.`
                  : "This department will no longer appear in dropdown menus. You can reactivate it later."
                : "This department will appear in dropdown menus again."}
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
              variant={toggleTarget?.is_active ? "destructive" : "default"}
              disabled={isPending}
              onClick={handleToggleActive}
            >
              {isPending
                ? "Updating..."
                : toggleTarget?.is_active
                  ? "Deactivate"
                  : "Reactivate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
