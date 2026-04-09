"use client";

import { createElement, useEffect, useState, useTransition } from "react";
import { ArrowUp, ArrowDown, Pencil, Trash2, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryFormDialog } from "./category-form-dialog";
import { DeleteResourceDialog } from "./delete-resource-dialog";
import { resolveIcon, resolveIconColour } from "@/lib/resource-icons";
import {
  fetchAllCategoriesAction,
  swapCategoryOrder,
  deleteCategory,
} from "@/app/(protected)/resources/actions";
import { toast } from "sonner";
import type { CategoryWithChildren, ResourceCategory } from "@/types/database.types";

export function SettingsCategories() {
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editCategory, setEditCategory] = useState<ResourceCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; articleCount: number } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function loadCategories() {
    const data = await fetchAllCategoriesAction();
    setCategories(data);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCategories();
  }, []);

  function handleReorder(categoryId: string, direction: "up" | "down") {
    startTransition(async () => {
      const result = await swapCategoryOrder(categoryId, direction);
      if (result.success) {
        await loadCategories();
      } else {
        toast.error(result.error ?? "Failed to reorder");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteCategory(deleteTarget.id);
      if (result.success) {
        toast.success("Category deleted");
        setDeleteTarget(null);
        await loadCategories();
      } else {
        toast.error(result.error ?? "Failed to delete category");
      }
    });
  }

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Loading categories...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage the category tree. Categories must be empty before they can be deleted.
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No categories"
          description="Create categories to organise your resources."
        />
      ) : (
        <div className="space-y-1">
          {categories.map((cat, index) => (
            <div key={cat.id}>
              <CategoryRow
                category={cat}
                isFirst={index === 0}
                isLast={index === categories.length - 1}
                isPending={isPending}
                onEdit={() => setEditCategory(cat)}
                onDelete={() =>
                  setDeleteTarget({
                    id: cat.id,
                    name: cat.name,
                    articleCount: cat.article_count,
                  })
                }
                onReorder={(dir) => handleReorder(cat.id, dir)}
              />
              {/* Subcategories */}
              {cat.children.length > 0 && (
                <div className="ml-8 space-y-1 mt-1">
                  {cat.children.map((sub, subIndex) => (
                    <CategoryRow
                      key={sub.id}
                      category={sub}
                      isFirst={subIndex === 0}
                      isLast={subIndex === cat.children.length - 1}
                      isPending={isPending}
                      isSubcategory
                      onEdit={() => setEditCategory(sub)}
                      onDelete={() =>
                        setDeleteTarget({
                          id: sub.id,
                          name: sub.name,
                          articleCount: sub.article_count,
                        })
                      }
                      onReorder={(dir) => handleReorder(sub.id, dir)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CategoryFormDialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            loadCategories();
          }
        }}
      />

      {/* Edit dialog */}
      {editCategory && (
        <CategoryFormDialog
          key={editCategory.id}
          category={editCategory}
          open={!!editCategory}
          onOpenChange={(open) => {
            if (!open) {
              setEditCategory(null);
              loadCategories();
            }
          }}
        />
      )}

      {/* Delete confirmation */}
      <DeleteResourceDialog
        itemName={deleteTarget?.name ?? ""}
        warningText={
          deleteTarget && deleteTarget.articleCount > 0
            ? `This category has ${deleteTarget.articleCount} ${deleteTarget.articleCount === 1 ? "article" : "articles"}. Move or delete them first.`
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

// ─── CategoryRow ─────────────────────────────────────────────────────────────

interface CategoryRowProps {
  category: ResourceCategory & { article_count: number };
  isFirst: boolean;
  isLast: boolean;
  isPending: boolean;
  isSubcategory?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReorder: (direction: "up" | "down") => void;
}

function CategoryRow({
  category,
  isFirst,
  isLast,
  isPending,
  isSubcategory,
  onEdit,
  onDelete,
  onReorder,
}: CategoryRowProps) {
  const colour = resolveIconColour(category.icon_colour);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
      {!isSubcategory && (
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colour.bg} ${colour.fg}`}
        >
          {createElement(resolveIcon(category.icon), { className: "h-4 w-4" })}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{category.name}</div>
        <div className="text-xs text-muted-foreground">
          {category.article_count} {category.article_count === 1 ? "article" : "articles"}
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isFirst || isPending}
          onClick={() => onReorder("up")}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isLast || isPending}
          onClick={() => onReorder("down")}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isPending}
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          disabled={isPending}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
