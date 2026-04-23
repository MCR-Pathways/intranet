"use client";

import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Callout } from "@/lib/tiptap-callout";
import type { CalloutType } from "@/lib/tiptap-callout";
import { CALLOUT_CONFIG } from "@/lib/tiptap-callout";
import { TEXT_COLOURS, HIGHLIGHT_COLOURS } from "@/lib/editor-colours";
import type { EditorColour } from "@/lib/editor-colours";
import { isValidHttpUrl } from "@/lib/url";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  CodeSquare,
  Minus,
  Link as LinkIcon,
  ImageIcon,
  Table as TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Palette,
  Highlighter,
  Type,
  ChevronDown,
} from "lucide-react";
import { createElement, useState } from "react";
import type { TiptapDocument } from "@/lib/tiptap";
import type { Editor } from "@tiptap/react";

const lowlight = createLowlight(common);

interface LessonTiptapEditorProps {
  initialContent?: TiptapDocument | null;
  onChange?: (json: TiptapDocument) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

export function LessonTiptapEditor({
  initialContent,
  onChange,
  placeholder = "Start writing your lesson content...",
  editable = true,
  className,
}: LessonTiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight
        heading: { levels: [1, 2, 3, 4] },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right"],
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        validate: (href) => isValidHttpUrl(href),
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Callout,
    ],
    content: initialContent ?? undefined,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getJSON() as TiptapDocument);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[300px] px-4 py-3",
      },
    },
  });

  if (!editor) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "rounded-lg border border-input bg-card overflow-hidden",
          className
        )}
      >
        {editable && <EditorToolbar editor={editor} />}
        <EditorContent editor={editor} />
      </div>
    </TooltipProvider>
  );
}

// ─── Toolbar ────────────────────────────────────────────────────────

function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      return {
        isBold: e.isActive("bold"),
        isItalic: e.isActive("italic"),
        isUnderline: e.isActive("underline"),
        isStrike: e.isActive("strike"),
        isCode: e.isActive("code"),
        isBulletList: e.isActive("bulletList"),
        isOrderedList: e.isActive("orderedList"),
        isTaskList: e.isActive("taskList"),
        isBlockquote: e.isActive("blockquote"),
        isCodeBlock: e.isActive("codeBlock"),
        isAlignLeft: e.isActive({ textAlign: "left" }),
        isAlignCenter: e.isActive({ textAlign: "center" }),
        isAlignRight: e.isActive({ textAlign: "right" }),
        headingLevel: e.isActive("heading", { level: 1 })
          ? 1
          : e.isActive("heading", { level: 2 })
            ? 2
            : e.isActive("heading", { level: 3 })
              ? 3
              : e.isActive("heading", { level: 4 })
                ? 4
                : 0,
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  if (!state) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-2 py-1.5 bg-muted/30">
      {/* Undo / Redo */}
      <ToolbarButton
        icon={Undo2}
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!state.canUndo}
      />
      <ToolbarButton
        icon={Redo2}
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!state.canRedo}
      />

      <ToolbarSeparator />

      {/* Heading dropdown */}
      <HeadingDropdown editor={editor} level={state.headingLevel} />

      <ToolbarSeparator />

      {/* Text formatting */}
      <ToolbarButton icon={Bold} label="Bold" active={state.isBold} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton icon={Italic} label="Italic" active={state.isItalic} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarButton icon={UnderlineIcon} label="Underline" active={state.isUnderline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <ToolbarButton icon={Strikethrough} label="Strikethrough" active={state.isStrike} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <ToolbarButton icon={Code} label="Inline code" active={state.isCode} onClick={() => editor.chain().focus().toggleCode().run()} />

      <ToolbarSeparator />

      {/* Colours */}
      <ColourPicker
        icon={Palette}
        label="Text colour"
        colours={TEXT_COLOURS}
        onSelect={(colour) => {
          if (colour) {
            editor.chain().focus().setColor(colour).run();
          } else {
            editor.chain().focus().unsetColor().run();
          }
        }}
      />
      <ColourPicker
        icon={Highlighter}
        label="Highlight"
        colours={HIGHLIGHT_COLOURS}
        onSelect={(colour) => {
          if (colour) {
            editor.chain().focus().toggleHighlight({ color: colour }).run();
          } else {
            editor.chain().focus().unsetHighlight().run();
          }
        }}
      />

      <ToolbarSeparator />

      {/* Lists */}
      <ToolbarButton icon={List} label="Bullet list" active={state.isBulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolbarButton icon={ListOrdered} label="Ordered list" active={state.isOrderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolbarButton icon={ListChecks} label="Task list" active={state.isTaskList} onClick={() => editor.chain().focus().toggleTaskList().run()} />

      <ToolbarSeparator />

      {/* Block elements */}
      <ToolbarButton icon={Quote} label="Blockquote" active={state.isBlockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <ToolbarButton icon={CodeSquare} label="Code block" active={state.isCodeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      <ToolbarButton icon={Minus} label="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} />

      <ToolbarSeparator />

      {/* Insert */}
      <LinkPopover editor={editor} />
      <ImagePopover editor={editor} />
      <ToolbarButton icon={TableIcon} label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />

      <ToolbarSeparator />

      {/* Callout */}
      <CalloutDropdown editor={editor} />

      <ToolbarSeparator />

      {/* Alignment */}
      <ToolbarButton icon={AlignLeft} label="Align left" active={state.isAlignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
      <ToolbarButton icon={AlignCenter} label="Align centre" active={state.isAlignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
      <ToolbarButton icon={AlignRight} label="Align right" active={state.isAlignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
    </div>
  );
}

// ─── Toolbar primitives ─────────────────────────────────────────────

function ToolbarButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={cn(active && "bg-accent text-accent-foreground")}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
        >
          {createElement(icon)}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarSeparator() {
  return <Separator orientation="vertical" className="mx-1 h-5" />;
}

// ─── Heading dropdown ───────────────────────────────────────────────

function HeadingDropdown({
  editor,
  level,
}: {
  editor: Editor;
  level: number;
}) {
  const headingLabels: Record<number, string> = {
    0: "Paragraph",
    1: "Heading 1",
    2: "Heading 2",
    3: "Heading 3",
    4: "Heading 4",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 font-normal"
          aria-label="Heading level"
          title="Heading level"
        >
          <Type />
          {headingLabels[level]}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onSelect={() =>
            editor.chain().focus().setParagraph().run()
          }
        >
          Paragraph
        </DropdownMenuItem>
        {([1, 2, 3, 4] as const).map((h) => (
          <DropdownMenuItem
            key={h}
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: h }).run()
            }
          >
            {createElement([Heading1, Heading2, Heading3, Heading4][h - 1], {
              className: "h-4 w-4",
            })}
            Heading {h}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Colour picker ──────────────────────────────────────────────────

function ColourPicker({
  icon,
  label,
  colours,
  onSelect,
}: {
  icon: typeof Palette;
  label: string;
  colours: EditorColour[];
  onSelect: (colour: string | null) => void;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={label}
            >
              {createElement(icon)}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-6 gap-1">
          {colours.map((c) => (
            <button
              key={c.label}
              type="button"
              className={cn(
                "h-6 w-6 rounded border border-border hover:scale-110 transition-transform",
                !c.value && "bg-background relative after:content-[''] after:absolute after:inset-0 after:border-t after:border-destructive after:rotate-45 after:origin-center"
              )}
              style={c.value ? { backgroundColor: c.value } : undefined}
              title={c.label}
              onClick={() => onSelect(c.value)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Link popover ───────────────────────────────────────────────────

function LinkPopover({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = () => {
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
    } else if (isValidHttpUrl(url.trim())) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url.trim() })
        .run();
    }
    setUrl("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn(
                editor.isActive("link") && "bg-accent text-accent-foreground"
              )}
              aria-label="Link"
              aria-pressed={editor.isActive("link")}
            >
              <LinkIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Link
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button size="sm" onClick={handleSubmit}>
            Set
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Image popover ──────────────────────────────────────────────────

function ImagePopover({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = () => {
    if (url.trim() && isValidHttpUrl(url.trim())) {
      editor.chain().focus().setImage({ src: url.trim() }).run();
    }
    setUrl("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Image"
            >
              <ImageIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Image
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Image URL..."
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button size="sm" onClick={handleSubmit}>
            Add
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Callout dropdown ───────────────────────────────────────────────

function CalloutDropdown({ editor }: { editor: Editor }) {
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
                // `text-xs` is inherited from size="sm" (button.tsx sm) — no
                // need to duplicate it here.
                "gap-0.5",
                editor.isActive("callout") && "bg-accent text-accent-foreground"
              )}
              aria-label="Insert callout"
              aria-pressed={editor.isActive("callout")}
            >
              <span>Callout</span>
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Insert callout
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start">
        {(Object.entries(CALLOUT_CONFIG) as [CalloutType, typeof CALLOUT_CONFIG.info][]).map(
          ([type, config]) => (
            <DropdownMenuItem
              key={type}
              onSelect={() =>
                editor.chain().focus().toggleCallout(type).run()
              }
            >
              {createElement(config.icon, { className: "h-4 w-4" })}
              {config.label}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
