"use client";

import { Button } from "@/components/ui/button";
import {
  ImagePlus,
  Paperclip,
  BarChart3,
  Award,
  Megaphone,
} from "lucide-react";

interface ComposerActionBarProps {
  onPhotoClick: () => void;
  onDocumentClick: () => void;
  onPollClick: () => void;
  /** Optional handler for the Kudos chip. Omit on surfaces that don't
   * compose kudos (e.g. the in-dialog action bar — kudos is its own
   * dialog, not a sub-mode of the post create dialog). */
  onKudosClick?: () => void;
  /** Optional handler for the Announcement toggle. Only rendered for
   * authors with `can_post_announcements`; the toggle flips the
   * dialog between regular-post and announcement modes (W4b). */
  onAnnouncementClick?: () => void;
  /** Whether announcement-mode is currently on. Affects chip styling
   * (filled / outlined) so the author always knows which mode
   * they're in mid-compose. */
  announcementActive?: boolean;
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
  onKudosClick,
  onAnnouncementClick,
  announcementActive = false,
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
      {onKudosClick && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onKudosClick}
          disabled={disabled}
          className="text-muted-foreground hover:text-yellow-700 hover:bg-yellow-50"
        >
          <Award className="mr-1.5 h-5 w-5 text-yellow-600" />
          Kudos
        </Button>
      )}
      {onAnnouncementClick && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAnnouncementClick}
          disabled={disabled}
          aria-pressed={announcementActive}
          className={
            announcementActive
              ? "text-mcr-dark-blue bg-mcr-light-blue/20 hover:bg-mcr-light-blue/30"
              : "text-muted-foreground hover:text-mcr-dark-blue hover:bg-mcr-light-blue/10"
          }
        >
          <Megaphone className="mr-1.5 h-5 w-5 text-mcr-dark-blue" />
          Announcement
        </Button>
      )}
      {actionButton && <div className="ml-auto">{actionButton}</div>}
    </div>
  );
}
