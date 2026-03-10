"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Underline from "@tiptap/extension-underline";
import { common, createLowlight } from "lowlight";
import { cn } from "@/lib/utils";
import { isValidHttpUrl } from "@/lib/url";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  TableIcon,
  Underline as UnderlineIcon,
  Info,
  SquareCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinkEditPopover } from "./link-edit-popover";
import { Callout, CALLOUT_CONFIG, type CalloutType } from "@/lib/tiptap-callout";
import type { TiptapDocument } from "@/lib/tiptap";

// Import only common languages to keep bundle small (~50KB vs ~500KB for all)
const lowlight = createLowlight(common);

interface ArticleComposerProps {
  /** Called whenever the editor content changes */
  onChange?: (json: TiptapDocument, text: string) => void;
  /** Initial content as Tiptap JSON (for editing existing articles) */
  initialContent?: TiptapDocument | Record<string, unknown> | null;
  /** Disable the editor */
  disabled?: boolean;
  /** Additional CSS classes for the editor wrapper */
  className?: string;
}

/**
 * Rich text editor for long-form articles / resources.
 *
 * Full formatting suite: headings, inline styles, lists, blockquotes,
 * links, images, tables, callouts, code blocks, horizontal rules.
 * Fixed toolbar with grouped buttons (Confluence-style).
 */
export function ArticleComposer({
  onChange,
  initialContent,
  disabled = false,
  className,
}: ArticleComposerProps) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: {},
        horizontalRule: {},
        codeBlock: false, // Replaced by CodeBlockLowlight
      }),
      Placeholder.configure({
        placeholder: "Start writing your article...",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg my-4",
        },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: "border-collapse w-full my-4",
        },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: {
          class: "border border-border p-2",
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: "border border-border p-2 bg-muted font-semibold text-left",
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: "rounded-lg bg-muted p-4 my-4 overflow-x-auto text-sm font-mono",
        },
      }),
      Underline,
      Callout,
    ],
    []
  );

  const editor = useEditor({
    extensions,
    content: (initialContent as TiptapDocument) ?? "",
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none min-h-[300px]",
          "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2",
          "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1",
          "[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
          "[&_hr]:my-4 [&_hr]:border-muted",
          // Callout styles
          "[&_div[data-callout-type]]:my-4 [&_div[data-callout-type]]:rounded-lg [&_div[data-callout-type]]:border-l-4 [&_div[data-callout-type]]:p-4",
          "[&_div[data-callout-type='info']]:bg-blue-50 [&_div[data-callout-type='info']]:border-blue-400",
          "[&_div[data-callout-type='tip']]:bg-green-50 [&_div[data-callout-type='tip']]:border-green-400",
          "[&_div[data-callout-type='warning']]:bg-amber-50 [&_div[data-callout-type='warning']]:border-amber-400",
          "[&_div[data-callout-type='danger']]:bg-red-50 [&_div[data-callout-type='danger']]:border-red-400"
        ),
        // Tailwind v4's outline-none compiles to outline: 2px solid transparent,
        // which doesn't remove the outline on contenteditable elements.
        // Use inline style instead (same pattern as tiptap-composer.tsx).
        style: "outline: none",
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

  const focus = useCallback(() => {
    editor?.commands.focus();
  }, [editor]);

  // Image URL prompt
  const [imageUrl, setImageUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);

  function handleInsertImage() {
    const trimmed = imageUrl.trim();
    if (!trimmed || !editor) return;

    if (!isValidHttpUrl(trimmed)) return;

    editor.chain().focus().setImage({ src: trimmed }).run();
    setImageUrl("");
    setShowImageInput(false);
  }

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/50 p-1">
        {/* Text group */}
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          label="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          label="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Inline formatting group */}
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          label="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          label="Inline code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Block formatting group */}
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Ordered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Insert group */}
        <LinkEditPopover editor={editor} />

        <ToolbarButton
          active={false}
          onClick={() => setShowImageInput(!showImageInput)}
          label="Insert image"
        >
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={false}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          label="Insert table"
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>

        {/* Callout dropdown */}
        <CalloutDropdown
          editor={editor}
          isActive={editor.isActive("callout")}
        />

        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          label="Horizontal rule"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          label="Code block"
        >
          <SquareCode className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Image URL input (shown when image button clicked) */}
      {showImageInput && (
        <div className="flex items-center gap-2 border-b border-input bg-muted/30 px-3 py-2">
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleInsertImage();
              }
              if (e.key === "Escape") {
                setShowImageInput(false);
                setImageUrl("");
              }
            }}
            placeholder="https://example.com/image.jpg"
            className="flex-1 bg-card border border-input rounded px-2 py-1 text-sm"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handleInsertImage}
            disabled={!isValidHttpUrl(imageUrl)}
          >
            Insert
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowImageInput(false);
              setImageUrl("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Editor */}
      <div
        className={cn(
          "bg-card px-4 py-3 text-sm",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:float-left",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:h-0",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none"
        )}
        onClick={focus}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ─── Toolbar Subcomponents ───────────────────────────────────────────────────

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 w-8 p-0",
        active && "bg-accent text-accent-foreground"
      )}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

function CalloutDropdown({
  editor,
  isActive,
}: {
  editor: Editor;
  isActive: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0",
            isActive && "bg-accent text-accent-foreground"
          )}
          aria-label="Insert callout"
        >
          <Info className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(Object.entries(CALLOUT_CONFIG) as [CalloutType, (typeof CALLOUT_CONFIG)[CalloutType]][]).map(([type, { label, icon: Icon }]) => (
          <DropdownMenuItem
            key={type}
            onSelect={() => editor.chain().focus().toggleCallout(type).run()}
          >
            <Icon className="h-4 w-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
