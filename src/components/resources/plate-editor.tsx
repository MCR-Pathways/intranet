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
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
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

function LinkElement(props: PlateElementProps) {
  const url = (props.element as Record<string, unknown>).url as string;
  return (
    <PlateElement
      {...props}
      as="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-link underline underline-offset-4 hover:text-link/80"
    />
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
// TOOLBAR
// =============================================

function EditorToolbar({ editor }: { editor: ReturnType<typeof usePlateEditor> }) {
  const toggleMark = (key: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    (editor.tf as Record<string, { toggle: () => void }>)[key]?.toggle();
    editor.tf.focus();
  };

  const toggleBlock = (key: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    (editor.tf as Record<string, { toggle: () => void }>)[key]?.toggle();
    editor.tf.focus();
  };

  const handleToggleList = (type: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    toggleList(editor, { listStyleType: type as ListStyleType });
    editor.tf.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1.5">
      {/* Marks */}
      <Toggle size="sm" onMouseDown={toggleMark("bold")} aria-label="Bold">
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={toggleMark("italic")} aria-label="Italic">
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={toggleMark("underline")} aria-label="Underline">
        <Underline className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={toggleMark("strikethrough")} aria-label="Strikethrough">
        <Strikethrough className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Headings */}
      <Toggle size="sm" onMouseDown={toggleBlock("h1")} aria-label="Heading 1">
        <Heading1 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={toggleBlock("h2")} aria-label="Heading 2">
        <Heading2 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={toggleBlock("h3")} aria-label="Heading 3">
        <Heading3 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={toggleBlock("h4")} aria-label="Heading 4">
        <Heading4 className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Blocks */}
      <Toggle size="sm" onMouseDown={toggleBlock("blockquote")} aria-label="Quote">
        <Quote className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={handleToggleList(ListStyleType.Disc)} aria-label="Bullet list">
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={handleToggleList(ListStyleType.Decimal)} aria-label="Numbered list">
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" onMouseDown={toggleBlock("hr")} aria-label="Horizontal rule">
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
