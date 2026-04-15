"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { CardActionsKebab } from "./card-actions-kebab";
import { CategoryFormDialog } from "./category-form-dialog";
import { DeleteResourceDialog } from "./delete-resource-dialog";
import { deleteCategory } from "@/app/(protected)/resources/actions";
import type { ResourceCategory } from "@/types/database.types";

interface CategoryCardActionsProps {
  /**
   * Accepts any ResourceCategory shape. Callers passing CategoryTreeNode or
   * CategoryWithCount work via structural typing — both extend ResourceCategory.
   * Only id + name are accessed here, so the narrower type is sufficient.
   */
  category: ResourceCategory;
  canEdit: boolean;
}

/**
 * Kebab actions for category and subcategory cards. Rename (edit in place),
 * + New subcategory, Delete. Renders nothing for non-editors.
 */
export function CategoryCardActions({ category, canEdit }: CategoryCardActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [newSubOpen, setNewSubOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!canEdit) return null;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (result.success) {
        toast.success(`"${category.name}" deleted`);
        setDeleteOpen(false);
      } else {
        toast.error(result.error ?? "Failed to delete category");
      }
    });
  }

  return (
    <>
      <CardActionsKebab triggerLabel={`Actions for ${category.name}`}>
        <DropdownMenuItem onSelect={() => setEditOpen(true)}>
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setNewSubOpen(true)}>
          + New subcategory
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setDeleteOpen(true)}
          className="text-destructive focus:text-destructive"
        >
          Delete
        </DropdownMenuItem>
      </CardActionsKebab>

      <CategoryFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        category={category}
      />
      <CategoryFormDialog
        open={newSubOpen}
        onOpenChange={setNewSubOpen}
        defaultParentId={category.id}
      />
      <DeleteResourceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={category.name}
        disabled={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
