"use client";

import { useState, useEffect, useTransition } from "react";
import { Globe, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/loading-button";
import { IconPickerPopover } from "./icon-picker-popover";
import {
  createCategory,
  updateCategory,
  fetchTopLevelCategories,
} from "@/app/(protected)/intranet/resources/actions";
import { toast } from "sonner";
import type { ResourceCategory } from "@/types/database.types";

interface CategoryFormDialogProps {
  trigger?: React.ReactNode;
  /** Pass existing category for edit mode; omit for create mode */
  category?: ResourceCategory;
  /** Controlled open state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CategoryFormDialog({
  trigger,
  category,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CategoryFormDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen;

  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "Folder");
  const [iconColour, setIconColour] = useState(
    category?.icon_colour ?? "default"
  );
  const [parentId, setParentId] = useState<string>(
    category?.parent_id ?? "none"
  );
  const [visibility, setVisibility] = useState<"all" | "internal">(
    category?.visibility ?? "internal"
  );
  const [parentOptions, setParentOptions] = useState<
    { id: string; name: string }[]
  >([]);

  const isEdit = !!category;

  // Fetch top-level categories for the parent dropdown when the dialog opens
  useEffect(() => {
    if (!open) return;
    fetchTopLevelCategories(isEdit ? category?.id : undefined).then(
      setParentOptions
    );
  }, [open, isEdit, category?.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      const parentValue = parentId === "none" ? null : parentId;
      const payload = {
        name,
        description,
        icon,
        icon_colour: iconColour === "default" ? null : iconColour,
        visibility,
      };
      const result = isEdit
        ? await updateCategory(category!.id, payload)
        : await createCategory({ ...payload, parent_id: parentValue });

      if (result.success) {
        toast.success(isEdit ? "Category updated" : "Category created");
        setOpen(false);
        if (!isEdit) {
          setName("");
          setDescription("");
          setIcon("Folder");
          setIconColour("default");
          setParentId("none");
          setVisibility("internal");
        }
      } else {
        toast.error(result.error ?? "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Category" : "New Category"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Icon + Name row */}
          <div className="flex items-end gap-4">
            <div className="flex flex-col items-center space-y-2">
              <Label>Icon</Label>
              <IconPickerPopover
                icon={icon}
                colour={iconColour}
                onIconChange={setIcon}
                onColourChange={setIconColour}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Policies"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-description">Description</Label>
            <Textarea
              id="cat-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this category"
              rows={3}
            />
          </div>

          {/* Parent category — only show for new categories (not editable after creation) */}
          {!isEdit && parentOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="cat-parent">Parent Category</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger id="cat-parent" className="bg-card">
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Subcategories appear nested under their parent.
              </p>
            </div>
          )}

          {/* Visibility */}
          <div className="space-y-2">
            <Label>Visibility</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility("internal")}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  visibility === "internal"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Lock className="h-4 w-4" />
                Internal only
              </button>
              <button
                type="button"
                onClick={() => setVisibility("all")}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  visibility === "all"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Globe className="h-4 w-4" />
                All users
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {visibility === "internal"
                ? "Only staff members can see this category."
                : "All users (including Pathways Coordinators) can see this category."}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <LoadingButton type="submit" loading={isPending}>
              {isEdit ? "Save Changes" : "Create Category"}
            </LoadingButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
