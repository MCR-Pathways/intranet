"use client";

// DEPRECATED: Use RichTextEditor directly instead.
// This wrapper remains for backward compatibility in the news feed.

import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { MentionUser } from "./mention-list";
import type { TiptapDocument } from "@/lib/tiptap";

interface TiptapComposerProps {
  /** All active users for the @mention picker */
  mentionUsers: MentionUser[];
  /** Placeholder text when the editor is empty */
  placeholder?: string;
  /** Called whenever the editor content changes */
  onChange?: (json: TiptapDocument, text: string) => void;
  /** Called on Cmd+Enter (submit shortcut) */
  onSubmit?: () => void;
  /** External character count tracking */
  maxLength?: number;
  /** Disable the editor */
  disabled?: boolean;
  /** Additional CSS classes for the editor wrapper */
  className?: string;
  /** Initial content as Tiptap JSON (for editing existing posts) */
  initialContent?: TiptapDocument;
  /** When this value changes, reset the editor to empty */
  resetKey?: string | number;
  /** Minimal mode (no formatting toolbar, compact) — used for comments */
  minimal?: boolean;
  /** Remove border and focus ring — used inside dialogs where the editor is the main content area */
  borderless?: boolean;
}

export function TiptapComposer({
  mentionUsers,
  placeholder = "Write something...",
  onChange,
  onSubmit,
  maxLength,
  disabled = false,
  className,
  initialContent,
  resetKey,
  minimal = false,
  borderless = false,
}: TiptapComposerProps) {
  return (
    <RichTextEditor
      preset={minimal ? "minimal" : "standard"}
      initialContent={initialContent}
      onChange={onChange}
      onSubmit={onSubmit}
      placeholder={placeholder}
      mentionUsers={mentionUsers}
      maxLength={maxLength}
      disabled={disabled}
      className={className}
      resetKey={resetKey}
      borderless={borderless}
    />
  );
}
