"use client";

import { Button } from "@/components/ui/button";
import { ImagePlus, Paperclip, BarChart3 } from "lucide-react";

interface ComposerActionBarProps {
  onPhotoClick: () => void;
  onDocumentClick: () => void;
  onPollClick: () => void;
  /** Whether a poll is already active (disables the poll button) */
  pollActive?: boolean;
  disabled?: boolean;
  /** Optional slot for a right-aligned action button (e.g. Post / Save) */
  actionButton?: React.ReactNode;
}

export function ComposerActionBar({
  onPhotoClick,
  onDocumentClick,
  onPollClick,
  pollActive = false,
  disabled = false,
  actionButton,
}: ComposerActionBarProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onPhotoClick}
        disabled={disabled}
        className="text-muted-foreground hover:text-green-600 hover:bg-green-50"
      >
        <ImagePlus className="mr-1.5 h-5 w-5 text-green-500" />
        Photo
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDocumentClick}
        disabled={disabled}
        className="text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
      >
        <Paperclip className="mr-1.5 h-5 w-5 text-blue-500" />
        Document
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onPollClick}
        disabled={disabled || pollActive}
        className="text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
      >
        <BarChart3 className="mr-1.5 h-5 w-5 text-amber-500" />
        Poll
      </Button>
      {actionButton && <div className="ml-auto">{actionButton}</div>}
    </div>
  );
}
