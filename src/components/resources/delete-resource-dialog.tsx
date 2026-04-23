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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteResourceDialogProps {
  /** Button or element that triggers the dialog */
  trigger?: React.ReactNode;
  /** Name of the item being deleted */
  itemName: string;
  /** Optional warning text (e.g. "This will also delete 5 articles") */
  warningText?: string;
  /** Called when the user confirms deletion */
  onConfirm: () => void;
  /** Disable the confirm button */
  disabled?: boolean;
  /** Controlled open state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteResourceDialog({
  trigger,
  itemName,
  warningText,
  onConfirm,
  disabled,
  open,
  onOpenChange,
}: DeleteResourceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will be moved to the bin. You can restore it within 30 days.
            {warningText && (
              <>
                {" "}
                {warningText}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={disabled}
            aria-busy={disabled}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
