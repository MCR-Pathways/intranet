"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { common, createLowlight } from "lowlight";
import { cn } from "@/lib/utils";
import { isValidHttpUrl } from "@/lib/url";
import { getTooltipLabel } from "@/lib/editor-shortcuts";
import { TEXT_COLOURS, HIGHLIGHT_COLOURS } from "@/lib/editor-colours";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  SquareCode,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  TableIcon,
  Underline as UnderlineIcon,
  Undo2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinkEditPopover } from "./link-edit-popover";
import { ColourPickerDropdown } from "./colour-picker-dropdown";
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
 * Full formatting suite: headings (H1-H4), inline styles, lists, checklists,
 * blockquotes, links, images, tables, callouts, code blocks, horizontal rules,
 * text alignment, text colour, highlight, undo/redo, clear formatting.
 *
 * Google Docs-style dark pill tooltips with keyboard shortcuts on all toolbar
 * buttons. Platform-aware shortcuts (⌘ on Mac, Ctrl on Windows).
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
        heading: { levels: [1, 2, 3, 4] },
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
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
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
          // Tighter paragraph spacing — prose-sm default ~16px each side is too generous for an editor.
          // Google Docs uses ~13px after, Notion ~10px. We use 4px top + 8px bottom ≈ 12px between paragraphs.
          "[&_p]:mt-1 [&_p]:mb-2",
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2",
          "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-1.5",
          "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1",
          "[&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1",
          "[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
          "[&_hr]:my-4 [&_hr]:border-muted",
          // Callout styles
          "[&_div[data-callout-type]]:my-4 [&_div[data-callout-type]]:rounded-lg [&_div[data-callout-type]]:border-l-4 [&_div[data-callout-type]]:p-4",
          "[&_div[data-callout-type='info']]:bg-blue-50 [&_div[data-callout-type='info']]:border-blue-400",
          "[&_div[data-callout-type='tip']]:bg-green-50 [&_div[data-callout-type='tip']]:border-green-400",
          "[&_div[data-callout-type='warning']]:bg-amber-50 [&_div[data-callout-type='warning']]:border-amber-400",
          "[&_div[data-callout-type='danger']]:bg-red-50 [&_div[data-callout-type='danger']]:border-red-400",
          // Task list styles — Tiptap v3 renders li with data-checked (not data-type="taskItem")
          // prose sets display:list-item on li, must override with !flex
          "[&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:pl-0 [&_ul[data-type='taskList']]:my-2 [&_ul[data-type='taskList']]:space-y-1",
          "[&_ul[data-type='taskList']>li]:!flex [&_ul[data-type='taskList']>li]:gap-2 [&_ul[data-type='taskList']>li]:items-start",
          "[&_ul[data-type='taskList']>li>label]:mt-0.5 [&_ul[data-type='taskList']>li>label]:shrink-0",
          "[&_ul[data-type='taskList']>li>div]:flex-1 [&_ul[data-type='taskList']>li>div]:min-w-0",
          // Remove paragraph margins inside task items so text sits inline with checkbox
          "[&_ul[data-type='taskList']_p]:mt-0 [&_ul[data-type='taskList']_p]:mb-0"
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

  // Subscribe to editor state for reactive toolbar updates (Tiptap v3 requirement).
  // In Tiptap v3, editor.isActive() is NOT automatically reactive — useEditorState
  // provides the subscription that triggers re-renders when the selected state changes.
  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      return {
      // Heading level (0 = paragraph)
      headingLevel: e.isActive("heading")
        ? (e.getAttributes("heading").level as number)
        : 0,
      // Inline formatting
      isBold: e.isActive("bold"),
      isItalic: e.isActive("italic"),
      isUnderline: e.isActive("underline"),
      isStrike: e.isActive("strike"),
      isCode: e.isActive("code"),
      isSuperscript: e.isActive("superscript"),
      isSubscript: e.isActive("subscript"),
      // Lists
      isBulletList: e.isActive("bulletList"),
      isOrderedList: e.isActive("orderedList"),
      isTaskList: e.isActive("taskList"),
      isBlockquote: e.isActive("blockquote"),
      // Alignment
      isAlignLeft: e.isActive({ textAlign: "left" }),
      isAlignCenter: e.isActive({ textAlign: "center" }),
      isAlignRight: e.isActive({ textAlign: "right" }),
      // Colours
      textColour: e.getAttributes("textStyle").color as string | undefined,
      highlightColour: e.getAttributes("highlight").color as string | undefined,
      // Inserts
      isCallout: e.isActive("callout"),
      isCodeBlock: e.isActive("codeBlock"),
      // Undo/redo
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }},
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
        "overflow-clip",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/50 p-1">
        {/* Heading / paragraph dropdown */}
        <HeadingDropdown
          editor={editor}
          activeLevel={editorState?.headingLevel ?? 0}
        />

        <ToolbarDivider />

        {/* Inline formatting group */}
        <ToolbarButton
          active={editorState?.isBold}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
          tooltip={getTooltipLabel("Bold", "bold")}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isItalic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
          tooltip={getTooltipLabel("Italic", "italic")}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isUnderline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          label="Underline"
          tooltip={getTooltipLabel("Underline", "underline")}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isStrike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="Strikethrough"
          tooltip={getTooltipLabel("Strikethrough", "strikethrough")}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isCode}
          onClick={() => editor.chain().focus().toggleCode().run()}
          label="Inline code"
          tooltip={getTooltipLabel("Inline code", "code")}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isSuperscript}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          label="Superscript"
          tooltip={getTooltipLabel("Superscript", "superscript")}
        >
          <SuperscriptIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isSubscript}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          label="Subscript"
          tooltip={getTooltipLabel("Subscript", "subscript")}
        >
          <SubscriptIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Block formatting group */}
        <ToolbarButton
          active={editorState?.isBulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
          tooltip={getTooltipLabel("Bullet list", "bulletList")}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isOrderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Ordered list"
          tooltip={getTooltipLabel("Ordered list", "orderedList")}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isTaskList}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          label="Checklist"
          tooltip="Checklist"
        >
          <ListTodo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isBlockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Blockquote"
          tooltip={getTooltipLabel("Blockquote", "blockquote")}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Alignment group */}
        <ToolbarButton
          active={editorState?.isAlignLeft}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          label="Align left"
          tooltip={getTooltipLabel("Align left", "alignLeft")}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isAlignCenter}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          label="Align centre"
          tooltip={getTooltipLabel("Align centre", "alignCentre")}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editorState?.isAlignRight}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          label="Align right"
          tooltip={getTooltipLabel("Align right", "alignRight")}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Indent / Outdent */}
        <ToolbarButton
          active={false}
          onClick={() => {
            if (editor.isActive("taskItem")) {
              editor.chain().focus().sinkListItem("taskItem").run();
            } else {
              editor.chain().focus().sinkListItem("listItem").run();
            }
          }}
          label="Indent"
          tooltip="Indent"
        >
          <IndentIncrease className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => {
            if (editor.isActive("taskItem")) {
              editor.chain().focus().liftListItem("taskItem").run();
            } else {
              editor.chain().focus().liftListItem("listItem").run();
            }
          }}
          label="Outdent"
          tooltip="Outdent"
        >
          <IndentDecrease className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Insert group */}
        <LinkEditPopover editor={editor} />

        <ToolbarButton
          active={false}
          onClick={() => setShowImageInput(!showImageInput)}
          label="Insert image"
          tooltip="Insert image"
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
          tooltip="Insert table"
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>

        {/* Callout dropdown */}
        <CalloutDropdown
          editor={editor}
          isActive={editorState?.isCallout}
        />

        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          label="Horizontal rule"
          tooltip="Horizontal rule"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={editorState?.isCodeBlock}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          label="Code block"
          tooltip="Code block"
        >
          <SquareCode className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Colour group */}
        <ColourPickerDropdown
          colours={TEXT_COLOURS}
          activeColour={editorState?.textColour}
          onSelect={(value) => {
            if (value) {
              editor.chain().focus().setColor(value).run();
            } else {
              editor.chain().focus().unsetColor().run();
            }
          }}
          icon={Palette}
          label="Text colour"
          tooltip="Text colour"
          isActive={!!editorState?.textColour}
        />
        <ColourPickerDropdown
          colours={HIGHLIGHT_COLOURS}
          activeColour={editorState?.highlightColour}
          onSelect={(value) => {
            if (value) {
              editor.chain().focus().toggleHighlight({ color: value }).run();
            } else {
              editor.chain().focus().unsetHighlight().run();
            }
          }}
          icon={Highlighter}
          label="Highlight colour"
          tooltip="Highlight colour"
          isActive={!!editorState?.highlightColour}
        />

        <ToolbarDivider />

        {/* Utility group */}
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
          label="Undo"
          tooltip={getTooltipLabel("Undo", "undo")}
          disabled={!editorState?.canUndo}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
          label="Redo"
          tooltip={getTooltipLabel("Redo", "redo")}
          disabled={!editorState?.canRedo}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          label="Clear formatting"
          tooltip={getTooltipLabel("Clear formatting", "clearFormatting")}
        >
          <RemoveFormatting className="h-4 w-4" />
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

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}

function ToolbarButton({
  active,
  onClick,
  label,
  tooltip,
  disabled: isDisabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  tooltip: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0",
            active && "bg-accent text-accent-foreground",
            isDisabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={onClick}
          disabled={isDisabled}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Heading / paragraph dropdown — Google Docs style.
 * Options: Normal text, Heading 1, Heading 2, Heading 3, Heading 4.
 */
function HeadingDropdown({
  editor,
  activeLevel,
}: {
  editor: Editor;
  /** 0 = paragraph, 1-4 = heading level. Passed as primitive to defeat React Compiler memoisation. */
  activeLevel: number;
}) {
  // Determine current block type label + icon from the primitive prop
  const HEADING_OPTIONS: Record<number, { label: string; icon: typeof Pilcrow }> = {
    0: { label: "Normal text", icon: Pilcrow },
    1: { label: "Heading 1", icon: Heading1 },
    2: { label: "Heading 2", icon: Heading2 },
    3: { label: "Heading 3", icon: Heading3 },
    4: { label: "Heading 4", icon: Heading4 },
  };

  const current = HEADING_OPTIONS[activeLevel] ?? HEADING_OPTIONS[0];
  const currentLabel = current.label;
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs font-medium"
              aria-label="Text style"
            >
              <CurrentIcon className="h-4 w-4" />
              <span className="hidden sm:inline max-w-[80px] truncate">{currentLabel}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Text style
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().setParagraph().run()}
          className={cn(!editor.isActive("heading") && "bg-accent")}
        >
          <Pilcrow className="h-4 w-4" />
          Normal text
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn(
            "text-2xl font-bold",
            editor.isActive("heading", { level: 1 }) && "bg-accent"
          )}
        >
          <Heading1 className="h-4 w-4" />
          Heading 1
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            "text-xl font-bold",
            editor.isActive("heading", { level: 2 }) && "bg-accent"
          )}
        >
          <Heading2 className="h-4 w-4" />
          Heading 2
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            "text-lg font-semibold",
            editor.isActive("heading", { level: 3 }) && "bg-accent"
          )}
        >
          <Heading3 className="h-4 w-4" />
          Heading 3
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          className={cn(
            "text-base font-semibold",
            editor.isActive("heading", { level: 4 }) && "bg-accent"
          )}
        >
          <Heading4 className="h-4 w-4" />
          Heading 4
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CalloutDropdown({
  editor,
  isActive,
}: {
  editor: Editor;
  isActive?: boolean;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Insert callout
        </TooltipContent>
      </Tooltip>

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
