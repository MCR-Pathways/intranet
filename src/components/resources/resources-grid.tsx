"use client";

import { useState, useMemo, useTransition } from "react";
import { Plus, Search, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryCard } from "./category-card";
import { CategoryFormDialog } from "./category-form-dialog";
import { DeleteResourceDialog } from "./delete-resource-dialog";
import { deleteCategory, reorderCategories } from "@/app/(protected)/intranet/resources/actions";
import { toast } from "sonner";
import type { CategoryWithCount, ResourceCategory } from "@/types/database.types";

interface ResourcesGridProps {
  categories: CategoryWithCount[];
  canEdit: boolean;
}

export function ResourcesGrid({ categories, canEdit }: ResourcesGridProps) {
  const [search, setSearch] = useState("");
  const [editCategory, setEditCategory] = useState<ResourceCategory | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    );
  }, [categories, search]);

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteCategory(deleteTarget.id);
      if (result.success) {
        toast.success("Category moved to bin");
        setDeleteTarget(null);
      } else {
        toast.error(result.error ?? "Failed to delete category");
      }
    });
  }

  function handleReorder(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    // Swap the two categories and send the full ordered list
    const reordered = [...categories];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];

    startTransition(async () => {
      const result = await reorderCategories(reordered.map((c) => c.id));
      if (!result.success) {
        toast.error(result.error ?? "Failed to reorder categories");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canEdit && (
          <CategoryFormDialog
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Category
              </Button>
            }
          />
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={search ? "No categories match your search" : "No categories yet"}
          description={
            canEdit
              ? "Create a category to start organising your resources."
              : "Resources will appear here once added by an administrator."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((category, index) => (
            <CategoryCard
              key={category.id}
              category={category}
              canEdit={canEdit}
              isFirst={index === 0}
              isLast={index === filtered.length - 1}
              onEdit={() => setEditCategory(category)}
              onDelete={() => setDeleteTarget(category)}
              onMoveUp={() => handleReorder(index, "up")}
              onMoveDown={() => handleReorder(index, "down")}
            />
          ))}
        </div>
      )}

      {/* Edit dialog — controlled, keyed by category id to remount with fresh state */}
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

      {/* Delete confirmation — controlled */}
      <DeleteResourceDialog
        itemName={deleteTarget?.name ?? ""}
        warningText={
          deleteTarget && deleteTarget.article_count > 0
            ? `This category has ${deleteTarget.article_count} ${deleteTarget.article_count === 1 ? "article" : "articles"}. Move or delete them first.`
            : undefined
        }
        onConfirm={handleDelete}
        disabled={isPending}
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
