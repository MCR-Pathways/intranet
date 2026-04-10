"use client";

/**
 * Native Plate editor for resource articles.
 *
 * Basic rich text: headings, bold, italic, underline, strikethrough,
 * ordered/unordered lists, links, blockquote, horizontal rule.
 * Block plugins (accordion, tabs, etc.) added in WS3.
 * Media plugins (images, files, embeds) added in WS4.
 */

import { useCallback, useEffect, useRef } from "react";
import type { Value } from "platejs";
import {
  Plate,
  PlateContent,
  PlateElement,
  PlateLeaf,
  usePlateEditor,
} from "platejs/react";
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  BlockquotePlugin,
  HeadingPlugin,
  HorizontalRulePlugin,
} from "@platejs/basic-nodes/react";
import { LinkPlugin } from "@platejs/link/react";
import { ListPlugin } from "@platejs/list/react";
import { CalloutPlugin } from "@platejs/callout/react";
import { toggleList, ListStyleType } from "@platejs/list";
import { cn } from "@/lib/utils";
import { ArticleLinkPopover } from "./article-link-popover";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Quote,
  List,
  ListOrdered,
  Minus,
  Plus,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { PlateElementProps, PlateLeafProps } from "platejs/react";

// =============================================
// ELEMENT COMPONENTS
// =============================================

function ParagraphElement(props: PlateElementProps) {
  return <PlateElement {...props} as="p" />;
}

function BlockquoteElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      as="blockquote"
      className="border-l-2 border-border pl-6 italic"
    />
  );
}

function H1Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h1" className="text-3xl font-bold tracking-tight" />;
}

function H2Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h2" className="text-2xl font-semibold tracking-tight" />;
}

function H3Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h3" className="text-xl font-semibold tracking-tight" />;
}

function H4Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h4" className="text-lg font-semibold tracking-tight" />;
}

function HrElement(props: PlateElementProps) {
  return (
    <PlateElement {...props}>
      <hr className="my-4 border-border" />
      {props.children}
    </PlateElement>
  );
}

function LinkElement({ children, element, ...props }: PlateElementProps) {
  const url = (element as Record<string, unknown>).url as string;
  return (
    <PlateElement element={element} {...props}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-link underline underline-offset-4 hover:text-link/80"
      >
        {children}
      </a>
    </PlateElement>
  );
}

// =============================================
// CALLOUT
// =============================================

const CALLOUT_VARIANTS = {
  info: {
    container: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200",
    dot: "bg-blue-500",
    Icon: Info,
  },
  success: {
    container: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200",
    dot: "bg-green-500",
    Icon: CheckCircle,
  },
  warning: {
    container: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200",
    dot: "bg-amber-500",
    Icon: AlertTriangle,
  },
  error: {
    container: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200",
    dot: "bg-red-500",
    Icon: XCircle,
  },
} as const;

type CalloutVariant = keyof typeof CALLOUT_VARIANTS;

function CalloutElement({ children, element, editor, ...props }: PlateElementProps) {
  const variant = ((element as Record<string, unknown>).variant as CalloutVariant) || "info";
  const config = CALLOUT_VARIANTS[variant] ?? CALLOUT_VARIANTS.info;

  return (
    <PlateElement element={element} editor={editor} {...props}>
      <div className={cn("rounded-lg border p-4 flex gap-3 relative group my-2", config.container)}>
        <div contentEditable={false} className="flex-shrink-0 pt-0.5 select-none">
          <config.Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">{children}</div>
        {/* Variant switcher — visible on hover */}
        <div
          contentEditable={false}
          className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
        >
          {(Object.keys(CALLOUT_VARIANTS) as CalloutVariant[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-label={`Switch to ${v} callout`}
              className={cn(
                "h-4 w-4 rounded-full border-2 border-white dark:border-gray-800 transition-transform hover:scale-110",
                CALLOUT_VARIANTS[v].dot,
                v === variant && "ring-2 ring-offset-1 ring-current"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                editor.tf.setNodes(
                  { variant: v } as Record<string, unknown>,
                  { at: props.path }
                );
              }}
            />
          ))}
        </div>
      </div>
    </PlateElement>
  );
}

// =============================================
// LEAF COMPONENTS
// =============================================

function BoldLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="strong" />;
}

function ItalicLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="em" />;
}

function UnderlineLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="u" />;
}

function StrikethroughLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="s" />;
}

// =============================================
// INSERT BLOCK DROPDOWN
// =============================================

function InsertBlockDropdown({ editor }: { editor: NonNullable<ReturnType<typeof usePlateEditor>> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-2 hover:bg-muted transition-colors"
          onMouseDown={(e) => e.preventDefault()}
          aria-label="Insert block"
        >
          <Plus className="h-4 w-4 mr-1" />
          <span className="text-xs">Insert</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onSelect={() => {
            editor.tf.insert.callout({ variant: "info" });
            editor.tf.focus();
          }}
        >
          <Info className="h-4 w-4" />
          Callout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================
// TOOLBAR
// =============================================

function EditorToolbar({ editor }: { editor: NonNullable<ReturnType<typeof usePlateEditor>> }) {
  const prevent = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
    editor.tf.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1.5">
      {/* Marks */}
      <Toggle size="sm" onMouseDown={prevent(() => editor.tf.bold.toggle())} aria-label="Bold">
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={prevent(() => editor.tf.italic.toggle())} aria-label="Italic">
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={prevent(() => editor.tf.underline.toggle())} aria-label="Underline">
        <Underline className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={prevent(() => editor.tf.strikethrough.toggle())} aria-label="Strikethrough">
        <Strikethrough className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Headings */}
      <Toggle size="sm" onMouseDown={prevent(() => editor.tf.h1.toggle())} aria-label="Heading 1">
        <Heading1 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={prevent(() => editor.tf.h2.toggle())} aria-label="Heading 2">
        <Heading2 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={prevent(() => editor.tf.h3.toggle())} aria-label="Heading 3">
        <Heading3 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={prevent(() => editor.tf.h4.toggle())} aria-label="Heading 4">
        <Heading4 className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Blocks */}
      <Toggle size="sm" onMouseDown={prevent(() => editor.tf.blockquote.toggle())} aria-label="Quote">
        <Quote className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={prevent(() => toggleList(editor, { listStyleType: ListStyleType.Disc }))} aria-label="Bullet list">
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={prevent(() => toggleList(editor, { listStyleType: ListStyleType.Decimal }))} aria-label="Numbered list">
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={prevent(() => editor.tf.hr.toggle())} aria-label="Horizontal rule">
        <Minus className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Article link */}
      <ArticleLinkPopover
        onInsertLink={(url, title) => {
          editor.tf.insert.nodes(
            {
              type: "a",
              url,
              children: [{ text: title }],
            },
            { select: true }
          );
          editor.tf.focus();
        }}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Insert block */}
      <InsertBlockDropdown editor={editor} />
    </div>
  );
}

// =============================================
// EDITOR
// =============================================

/** Default empty document for new native articles */
export const EMPTY_PLATE_VALUE: Value = [
  { type: "p", children: [{ text: "" }] },
];

interface PlateEditorProps {
  /** Initial Plate JSON (from content_json in DB) */
  initialValue?: Value;
  /** Called with new value on each change (debounce externally) */
  onChange?: (value: Value) => void;
  /** Additional className for the editor container */
  className?: string;
}

export function PlateRichEditor({
  initialValue,
  onChange,
  className,
}: PlateEditorProps) {
  const onChangeRef = useRef(onChange);

  // Update ref in an effect (React Compiler disallows ref writes during render)
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = usePlateEditor(
    {
      value: initialValue ?? EMPTY_PLATE_VALUE,
      plugins: [
        HeadingPlugin.configure({ options: { levels: [1, 2, 3, 4] } }),
        BlockquotePlugin,
        HorizontalRulePlugin,
        BoldPlugin,
        ItalicPlugin,
        UnderlinePlugin,
        StrikethroughPlugin,
        LinkPlugin,
        ListPlugin,
        CalloutPlugin,
      ],
      override: {
        components: {
          p: ParagraphElement,
          blockquote: BlockquoteElement,
          h1: H1Element,
          h2: H2Element,
          h3: H3Element,
          h4: H4Element,
          hr: HrElement,
          a: LinkElement,
          callout: CalloutElement,
          bold: BoldLeaf,
          italic: ItalicLeaf,
          underline: UnderlineLeaf,
          strikethrough: StrikethroughLeaf,
        },
      },
    },
    [],
  );

  const handleValueChange = useCallback(
    ({ value }: { editor: unknown; value: Value }) => {
      onChangeRef.current?.(value);
    },
    [],
  );

  return (
    <div className={cn("rounded-lg border border-input bg-card overflow-hidden", className)}>
      <Plate editor={editor} onValueChange={handleValueChange}>
        <EditorToolbar editor={editor} />
        <PlateContent
          placeholder="Start writing..."
          className="min-h-[400px] px-6 py-4 outline-none text-foreground/85 leading-relaxed"
        />
      </Plate>
    </div>
  );
}
