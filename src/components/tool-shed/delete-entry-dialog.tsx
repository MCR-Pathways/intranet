"use client";

import { useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { deleteEntry } from "@/app/(protected)/learning/tool-shed/actions";

interface DeleteEntryDialogProps {
  entryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteEntryDialog({
  entryId,
  open,
  onOpenChange,
}: DeleteEntryDialogProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!entryId) return;

    startTransition(async () => {
      const result = await deleteEntry(entryId)
        .catch(() => ({ success: false, error: "Failed to delete insight" }));

      if (result.success) {
        toast.success("Insight deleted");
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Failed to delete insight");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Insight</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this insight? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
