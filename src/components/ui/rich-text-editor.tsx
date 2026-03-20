"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

import { Video } from "@/lib/tiptap-extensions/video";
import { cn } from "@/lib/utils";
import { createMentionSuggestion } from "@/components/news-feed/mention-suggestion";
import type { MentionUser } from "@/components/news-feed/mention-list";
import type { TiptapDocument } from "@/lib/tiptap";
import { RichTextToolbar } from "./rich-text-toolbar";

import "./rich-text-editor.css";

export type RichTextEditorPreset = "minimal" | "standard" | "full";

export interface RichTextEditorProps {
  /** Visual preset enabling different extension sets and toolbars */
  preset: RichTextEditorPreset;
  /** Initial content as Tiptap JSON (for editing existing content) */
  initialContent?: TiptapDocument | Record<string, unknown> | null;
  /** Called whenever the editor content changes */
  onChange?: (json: TiptapDocument, text: string) => void;
  /** Called on Cmd+Enter (submit shortcut) */
  onSubmit?: () => void;
  /** Placeholder text when the editor is empty */
  placeholder?: string;
  /** All active users for the @mention picker (optional) */
  mentionUsers?: MentionUser[];
  /** External character count tracking */
  maxLength?: number;
  /** Disable the editor */
  disabled?: boolean;
  /** Additional CSS classes for the editor wrapper */
  className?: string;
  /** When this value changes, reset the editor to empty */
  resetKey?: string | number;
  /** Remove border and focus ring — used inside dialogs or standalone */
  borderless?: boolean;
  /** Optional handler for inline image uploads. Should return a URL string. */
  onImageUpload?: (file: File) => Promise<string | null>;
}

/**
 * Shared rich text editor component.
 */
export function RichTextEditor({
  preset,
  initialContent,
  onChange,
  onSubmit,
  placeholder = "Write something...",
  mentionUsers = [],
  maxLength,
  disabled = false,
  className,
  resetKey,
  borderless = false,
  onImageUpload,
}: RichTextEditorProps) {
  // Stable suggestion config — only recreate when user list changes
  const suggestion = useMemo(
    () => (mentionUsers.length > 0 ? createMentionSuggestion(mentionUsers) : undefined),
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
      addProseMirrorPlugins() {
        const max = maxLength;
        return [
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            props: {} as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spec: {} as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            filterTransaction: (transaction: any) => {
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
    const isFull = preset === "full";
    const isStandard = preset === "standard" || isFull;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exts: any[] = [
      StarterKit.configure({
        // Minimal: just bold/italic/lists inside paragraphs
        // Standard: add heading, blockquote, hr
        codeBlock: isStandard ? undefined : false,
        blockquote: isStandard ? undefined : false,
        horizontalRule: isStandard ? undefined : false,
        heading: isStandard ? { levels: [1, 2, 3, 4] } : false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      SubmitShortcut,
      Underline,
    ];

    if (isStandard) {
      exts.push(
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "text-link underline hover:text-link/80",
          },
        })
      );
    }

    if (isFull) {
      exts.push(
        Image.configure({
          HTMLAttributes: {
            class: "rounded-lg border border-border w-full object-contain my-4",
          },
        }),
        Video,
        TaskList,
        TaskItem.configure({ nested: true }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        Subscript,
        Superscript,
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell
      );
    }

    // Always support mentions if user list provided
    if (suggestion) {
      exts.push(
        Mention.configure({
          HTMLAttributes: {
            class: "text-primary font-medium",
          },
          suggestion,
          renderText({ node }) {
            return `@\${node.attrs.label ?? node.attrs.id}`;
          },
        })
      );
    }

    if (CharacterLimit) {
      exts.push(CharacterLimit);
    }
    return exts;
  }, [preset, suggestion, placeholder, SubmitShortcut, CharacterLimit]);

  const editor = useEditor({
    extensions,
    content: initialContent ?? "",
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none tiptap p-3",
          // Reduce prose margins for minimal/standard presets
          preset !== "full" && "[&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1",
          preset === "minimal" && "min-h-[36px]",
          preset === "standard" && "min-h-[80px]",
          preset === "full" && "min-h-[200px]"
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
      if (initialContent) {
        editor.commands.setContent(initialContent);
      } else {
        editor.commands.clearContent(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Expose methods for parent via data attributes (like in TiptapComposer)
  const isEmpty = editor ? editor.isEmpty : true;
  const focus = useCallback(() => {
    editor?.commands.focus();
  }, [editor]);

  useEffect(() => {
    if (editor) {
      (editor as unknown as Record<string, unknown>).__isEmpty = isEmpty;
      (editor as unknown as Record<string, unknown>).__focus = focus;
    }
  }, [editor, isEmpty, focus]);

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
        borderless && "border-0 shadow-none focus-within:ring-0",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {editor && preset !== "minimal" && (
        <RichTextToolbar editor={editor} preset={preset} onImageUpload={onImageUpload} />
      )}
      <div
        className="cursor-text"
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
