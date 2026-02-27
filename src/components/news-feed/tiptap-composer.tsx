"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "@/lib/utils";
import { createMentionSuggestion } from "./mention-suggestion";
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
}

/**
 * Rich text editor based on Tiptap.
 *
 * Features:
 * - Bold (Cmd+B), Italic (Cmd+I), lists, links (auto-detected)
 * - @mention with inline suggestion dropdown
 * - Cmd+Enter to submit
 * - Placeholder text
 * - Character limit enforcement via maxLength
 */
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
}: TiptapComposerProps) {
  // Stable suggestion config — only recreate when user list changes
  const suggestion = useMemo(
    () => createMentionSuggestion(mentionUsers),
    [mentionUsers]
  );

  // Custom extension: Cmd+Enter to submit
  const SubmitShortcut = useMemo(
    () =>
      Extension.create({
        name: "submitShortcut",
        addKeyboardShortcuts() {
          return {
            "Mod-Enter": () => {
              onSubmit?.();
              return true;
            },
          };
        },
      }),
    [onSubmit]
  );

  // Custom extension: maxLength enforcement
  const CharacterLimit = useMemo(() => {
    if (!maxLength) return null;
    return Extension.create({
      name: "characterLimit",
      addKeyboardShortcuts() {
        return {};
      },
      // ProseMirror plugin to prevent typing beyond maxLength
      addProseMirrorPlugins() {
        const max = maxLength;
        return [
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            props: {} as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spec: {} as any,
            filterTransaction: (transaction: { docChanged: boolean; doc: { textContent: string } }) => {
              if (!transaction.docChanged) return true;
              const newText = transaction.doc.textContent;
              return newText.length <= max;
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            getState: () => null as any,
          },
        ];
      },
    });
  }, [maxLength]);

  const extensions = useMemo(() => {
    const exts = [
      StarterKit.configure({
        // Keep it simple — no code blocks, blockquotes for a social feed
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        heading: false,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "text-primary font-medium",
        },
        suggestion,
        renderText({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      SubmitShortcut,
    ];
    if (CharacterLimit) {
      exts.push(CharacterLimit);
    }
    return exts;
  }, [suggestion, placeholder, SubmitShortcut, CharacterLimit]);

  const editor = useEditor({
    extensions,
    content: initialContent ?? "",
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none",
          // Remove default prose margins for a compact social feed feel
          "[&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1",
          minimal ? "min-h-[36px]" : "min-h-[80px]"
        ),
      },
    },
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON() as TiptapDocument;
      const text = e.getText();
      onChange?.(json, text);
    },
  });

  // Sync disabled state
  useEffect(() => {
    if (editor && editor.isEditable !== !disabled) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  // Reset editor when resetKey changes
  useEffect(() => {
    if (editor && resetKey !== undefined) {
      editor.commands.clearContent(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Public method for parent to check emptiness
  const isEmpty = editor ? editor.isEmpty : true;

  // Focus the editor
  const focus = useCallback(() => {
    editor?.commands.focus();
  }, [editor]);

  // Expose focus and isEmpty via data attributes for parent access
  useEffect(() => {
    if (editor) {
      // Store references on the editor instance for parent component access
      (editor as unknown as Record<string, unknown>).__isEmpty = isEmpty;
      (editor as unknown as Record<string, unknown>).__focus = focus;
    }
  }, [editor, isEmpty, focus]);

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-background px-3 py-2 text-sm",
        "focus-within:ring-2 focus-within:ring-ring",
        disabled && "opacity-50 cursor-not-allowed",
        // Tiptap placeholder styling
        "[&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground",
        "[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        "[&_.tiptap_p.is-editor-empty:first-child::before]:float-left",
        "[&_.tiptap_p.is-editor-empty:first-child::before]:h-0",
        "[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none",
        className
      )}
      onClick={() => editor?.commands.focus()}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
