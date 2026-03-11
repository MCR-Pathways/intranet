"use client";

import { useState, useTransition } from "react";
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
import { LoadingButton } from "@/components/ui/loading-button";
import { IconPickerPopover } from "./icon-picker-popover";
import { createCategory, updateCategory } from "@/app/(protected)/intranet/resources/actions";
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

  const isEdit = !!category;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      const payload = {
        name,
        description,
        icon,
        icon_colour: iconColour === "default" ? null : iconColour,
      };
      const result = isEdit
        ? await updateCategory(category!.id, payload)
        : await createCategory(payload);

      if (result.success) {
        toast.success(isEdit ? "Category updated" : "Category created");
        setOpen(false);
        if (!isEdit) {
          setName("");
          setDescription("");
          setIcon("Folder");
          setIconColour("default");
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
