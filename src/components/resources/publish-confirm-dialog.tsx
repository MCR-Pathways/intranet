"use client";

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

interface PublishConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Article title shown in the confirmation copy. */
  title: string;
  /** `publish` transitions draft→published; `unpublish` transitions published→draft. */
  mode: "publish" | "unpublish";
  /** Invoked when the user confirms. Parent owns the mutation. */
  onConfirm: () => void;
  /** Disable the confirm button while the mutation is in flight. */
  disabled?: boolean;
}

export function PublishConfirmDialog({
  open,
  onOpenChange,
  title,
  mode,
  onConfirm,
  disabled,
}: PublishConfirmDialogProps) {
  const isPublish = mode === "publish";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isPublish ? `Publish "${title}"?` : `Unpublish "${title}"?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isPublish
              ? "Readers will see this article immediately and it will appear in search."
              : "Readers will no longer see this article or find it in search. You can republish anytime."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={disabled}
            className={isPublish ? "bg-green-600 text-white hover:bg-green-700" : undefined}
          >
            {isPublish ? "Publish" : "Unpublish"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
