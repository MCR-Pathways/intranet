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

interface UnlinkDialogProps {
  articleTitle: string;
  onConfirm: () => void;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnlinkDialog({
  articleTitle,
  onConfirm,
  disabled,
  open,
  onOpenChange,
}: UnlinkDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Unlink &ldquo;{articleTitle}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove the article from Resources. The Google Doc itself
            will not be affected — it will remain in Google Drive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={disabled}
            aria-busy={disabled}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Unlink
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
