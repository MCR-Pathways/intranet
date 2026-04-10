"use client";

/**
 * Native Plate editor for resource articles.
 *
 * Plugin registration, toolbar, and editor wrapper. Element/leaf
 * components live in plate-elements.tsx.
 */

import { useCallback, useEffect, useRef } from "react";
import type { Value } from "platejs";
import {
  Plate,
  PlateContent,
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
import {
  TablePlugin,
  TableRowPlugin,
  TableCellPlugin,
  TableCellHeaderPlugin,
} from "@platejs/table/react";
import { ColumnPlugin, ColumnItemPlugin } from "@platejs/layout/react";
import { insertColumnGroup } from "@platejs/layout";
import { toggleList, ListStyleType } from "@platejs/list";
import { cn } from "@/lib/utils";
import { ArticleLinkPopover } from "./article-link-popover";
import {
  ParagraphElement,
  BlockquoteElement,
  H1Element,
  H2Element,
  H3Element,
  H4Element,
  HrElement,
  LinkElement,
  CalloutElement,
  TableElement,
  TableRowElement,
  TableCellElement,
  TableCellHeaderElement,
  ColumnGroupElement,
  ColumnItemElement,
  BoldLeaf,
  ItalicLeaf,
  UnderlineLeaf,
  StrikethroughLeaf,
} from "./plate-elements";
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
  Table,
  Columns2,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

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
        <DropdownMenuItem
          onSelect={() => {
            editor.tf.insert.table({ colCount: 3, rowCount: 3, header: true });
            editor.tf.focus();
          }}
        >
          <Table className="h-4 w-4" />
          Table
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            insertColumnGroup(editor, { columns: 2 });
            editor.tf.focus();
          }}
        >
          <Columns2 className="h-4 w-4" />
          Columns
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
        TablePlugin.configure({ options: { disableMerge: true } }),
        TableRowPlugin,
        TableCellPlugin,
        TableCellHeaderPlugin,
        ColumnPlugin,
        ColumnItemPlugin,
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
          table: TableElement,
          tr: TableRowElement,
          td: TableCellElement,
          th: TableCellHeaderElement,
          column_group: ColumnGroupElement,
          column: ColumnItemElement,
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
