"use client";

import { useState, useTransition } from "react";
import { FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryCard } from "./category-card";
import { CategoryFormDialog } from "./category-form-dialog";
import { DeleteResourceDialog } from "./delete-resource-dialog";
import { deleteCategory } from "@/app/(protected)/resources/actions";
import { toast } from "sonner";
import type { CategoryWithCount, ResourceCategory } from "@/types/database.types";

interface SubcategoryGridProps {
  subcategories: CategoryWithCount[];
  canEdit: boolean;
}

export function SubcategoryGrid({ subcategories, canEdit }: SubcategoryGridProps) {
  const [editCategory, setEditCategory] = useState<ResourceCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteCategory(deleteTarget.id);
      if (result.success) {
        toast.success("Subcategory moved to bin");
        setDeleteTarget(null);
      } else {
        toast.error(result.error ?? "Failed to delete subcategory");
      }
    });
  }

  if (subcategories.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No subcategories yet"
        description={
          canEdit
            ? "Create subcategories to organise articles within this category."
            : "Subcategories will appear here once created."
        }
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subcategories.map((sub) => (
          <CategoryCard
            key={sub.id}
            category={sub}
            canEdit={canEdit}
            onEdit={() => setEditCategory(sub)}
            onDelete={() => setDeleteTarget(sub)}
          />
        ))}
      </div>

      {/* Edit dialog */}
      {editCategory && (
        <CategoryFormDialog
          key={editCategory.id}
          category={editCategory}
          open={!!editCategory}
          onOpenChange={(open) => {
            if (!open) setEditCategory(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      <DeleteResourceDialog
        itemName={deleteTarget?.name ?? ""}
        warningText={
          deleteTarget && deleteTarget.article_count > 0
            ? `This subcategory has ${deleteTarget.article_count} ${deleteTarget.article_count === 1 ? "article" : "articles"}. Move or delete them first.`
            : undefined
        }
        onConfirm={handleDelete}
        disabled={isPending}
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </>
  );
}
