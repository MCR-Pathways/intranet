"use client";

/**
 * Native Plate editor for resource articles.
 *
 * Plugin registration, toolbar, and editor wrapper. Element/leaf
 * components live in plate-elements.tsx. Media dialogs in media-dialogs.tsx.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PathApi, type Value } from "platejs";
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
import { IndentPlugin } from "@platejs/indent/react";
import { ImagePlugin, MediaEmbedPlugin, FilePlugin } from "@platejs/media/react";
import { toggleList, ListStyleType } from "@platejs/list";
import { ListContinuationPlugin } from "./plate-list-continuation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArticleLinkPopover } from "./article-link-popover";
import { uploadEditorMedia } from "@/app/(protected)/resources/media-actions";
import {
  ImageUploadDialog,
  VideoEmbedDialog,
  FileUploadDialog,
} from "./media-dialogs";
import { ImportHtmlDialog } from "./import-html-dialog";
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
  ImageElement,
  MediaEmbedElement,
  FileElement,
  BoldLeaf,
  ItalicLeaf,
  UnderlineLeaf,
  StrikethroughLeaf,
} from "./plate-elements";
import {
  BaseToggleV2Plugin,
  BaseToggleV2SummaryPlugin,
} from "./plate-toggle-v2";
import {
  ToggleV2Element,
  ToggleV2SummaryElement,
} from "./plate-toggle-v2-elements";
import {
  BaseGlossaryPlugin,
  BaseGlossaryEntryPlugin,
  BaseGlossaryTermPlugin,
  BaseGlossaryDefinitionPlugin,
  createEmptyGlossaryEntry,
} from "./plate-glossary";
import {
  GlossaryElement,
  GlossaryEntryElement,
  GlossaryTermElement,
  GlossaryDefinitionElement,
} from "./plate-glossary-elements";
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
  ChevronRight,
  BookA,
  ImageIcon,
  Video,
  Paperclip,
  ClipboardPaste,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// =============================================
// INSERT BLOCK DROPDOWN
// =============================================

interface InsertBlockDropdownProps {
  editor: NonNullable<ReturnType<typeof usePlateEditor>>;
  onOpenImageDialog: () => void;
  onOpenEmbedDialog: () => void;
  onOpenFileDialog: () => void;
  onOpenImportHtmlDialog: () => void;
}

function InsertBlockDropdown({
  editor,
  onOpenImageDialog,
  onOpenEmbedDialog,
  onOpenFileDialog,
  onOpenImportHtmlDialog,
}: InsertBlockDropdownProps) {
  // Layout is chosen at insert and fixed thereafter, so there are two entries
  // rather than one block + an in-editor layout control.
  const insertGlossary = (variant: "terms" | "acronyms") => {
    const node = {
      type: "glossary",
      variant,
      children: [createEmptyGlossaryEntry()],
    };
    // If the cursor is inside an existing glossary, insert the new one as a
    // sibling AFTER it — never a glossary nested in a glossary.
    const containing = editor.api.above({
      match: (n: { type?: string }) => n.type === "glossary",
    });
    let glossaryPath: number[] | undefined;
    if (containing) {
      const at = PathApi.next(containing[1]);
      editor.tf.insertNodes(node, { at });
      glossaryPath = at;
    } else {
      editor.tf.insertNodes(node, { select: true });
      glossaryPath = editor.api.above({
        match: (n: { type?: string }) => n.type === "glossary",
      })?.[1];
    }
    // Land the cursor in the first term (not the definition).
    if (glossaryPath) {
      const termStart = editor.api.start([...glossaryPath, 0, 0]);
      if (termStart) editor.tf.select(termStart);
    }
    editor.tf.focus();
  };

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
        <DropdownMenuItem
          onSelect={() => {
            editor.tf.insertNodes(
              {
                type: "toggle_v2",
                children: [
                  { type: "toggle_v2_summary", children: [{ text: "" }] },
                  { type: "p", children: [{ text: "" }] },
                ],
              },
              { select: true },
            );
            editor.tf.focus();
          }}
        >
          <ChevronRight className="h-4 w-4" />
          Toggle
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => insertGlossary("terms")}>
          <BookA className="h-4 w-4" />
          Glossary (terms list)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => insertGlossary("acronyms")}>
          <BookA className="h-4 w-4" />
          Glossary (acronyms table)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onOpenImageDialog}>
          <ImageIcon className="h-4 w-4" />
          Image
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenEmbedDialog}>
          <Video className="h-4 w-4" />
          Video embed
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenFileDialog}>
          <Paperclip className="h-4 w-4" />
          File attachment
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onOpenImportHtmlDialog}>
          <ClipboardPaste className="h-4 w-4" />
          Import HTML…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================
// TOOLBAR
// =============================================

interface EditorToolbarProps {
  editor: NonNullable<ReturnType<typeof usePlateEditor>>;
  rightSlot?: ReactNode;
  onOpenImageDialog: () => void;
  onOpenEmbedDialog: () => void;
  onOpenFileDialog: () => void;
  onOpenImportHtmlDialog: () => void;
}

function EditorToolbar({
  editor,
  rightSlot,
  onOpenImageDialog,
  onOpenEmbedDialog,
  onOpenFileDialog,
  onOpenImportHtmlDialog,
}: EditorToolbarProps) {
  const prevent = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
    editor.tf.focus();
  };

  return (
    <div className="sticky top-16 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-muted px-2 py-1.5">
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
        onInsertLink={(url, title, displayAsCard) => {
          editor.tf.insertNodes(
            {
              type: "a",
              url,
              children: [{ text: title }],
              ...(displayAsCard && { displayAsCard: true }),
            },
            { select: true }
          );
          editor.tf.focus();
        }}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Insert block */}
      <InsertBlockDropdown
        editor={editor}
        onOpenImageDialog={onOpenImageDialog}
        onOpenEmbedDialog={onOpenEmbedDialog}
        onOpenFileDialog={onOpenFileDialog}
        onOpenImportHtmlDialog={onOpenImportHtmlDialog}
      />

      {rightSlot && (
        <div className="ml-auto flex items-center gap-2">{rightSlot}</div>
      )}
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
  /** Article ID for media upload tracking (required — uploads need an article association) */
  articleId: string;
  /** Additional className for the editor container */
  className?: string;
  /** Rendered at the right end of the sticky toolbar (e.g. Save/Publish controls) */
  rightSlot?: ReactNode;
}

export function PlateRichEditor({
  initialValue,
  onChange,
  articleId,
  className,
  rightSlot,
}: PlateEditorProps) {
  const onChangeRef = useRef(onChange);
  const articleIdRef = useRef(articleId);
  const pendingDimensionsMap = useRef(new Map<string, { width: number; height: number }>());

  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [showImportHtmlDialog, setShowImportHtmlDialog] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    articleIdRef.current = articleId;
  }, [articleId]);

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
        IndentPlugin.configure({
          inject: {
            // Void blocks (img/file/media_embed) stay in this list because
            // editors may indent them as part of regular document layout
            // (right-aligned figures, etc). With container-shape toggles
            // the indent-on-void workaround for legacy toggle scope is no
            // longer needed; this entry now exists solely to preserve any
            // user-applied indent on the void block itself. Empirically
            // no current content has indented voids, but `withIndent`
            // strips indent from any type absent here on the next
            // normalisation pass — keeping the entries avoids silent loss
            // of any future user-applied indent.
            targetPlugins: ["p", "h1", "h2", "h3", "h4", "blockquote", "img", "file", "media_embed"],
          },
        }),
        BaseToggleV2Plugin,
        BaseToggleV2SummaryPlugin,
        BaseGlossaryPlugin,
        BaseGlossaryEntryPlugin,
        BaseGlossaryTermPlugin,
        BaseGlossaryDefinitionPlugin,
        ImagePlugin.configure({
          options: {
            uploadImage: async (input) => {
              const toastId = toast.loading("Uploading image...");
              try {
                const blob = input instanceof ArrayBuffer
                  ? new Blob([input])
                  : await fetch(input as string).then((r) => r.blob());

                const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" } as Record<string, string>)[blob.type] ?? "png";
                const file = new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type });

                // Read dimensions before upload for CLS prevention
                let dims: { width: number; height: number } | null = null;
                try {
                  const bitmap = await createImageBitmap(blob);
                  dims = { width: bitmap.width, height: bitmap.height };
                  bitmap.close();
                } catch {
                  // Proceed without dimensions
                }

                const fd = new FormData();
                fd.append("file", file);
                if (articleIdRef.current) fd.append("articleId", articleIdRef.current);

                const result = await uploadEditorMedia(fd);
                if (!result.success) throw new Error(result.error ?? "Upload failed");
                // Store dimensions keyed by URL so concurrent pastes don't collide
                if (dims && result.url) {
                  pendingDimensionsMap.current.set(result.url, dims);
                }
                toast.success("Image inserted", { id: toastId });
                return result.url!;
              } catch (err) {
                toast.error("Failed to upload image", { id: toastId });
                throw err;
              }
            },
          },
        }),
        MediaEmbedPlugin,
        FilePlugin,
        // ListContinuationPlugin overrides insertBreak so pressing Enter on
        // a void block (img/file/media_embed) continues the surrounding
        // list — Google Docs / MS Word behaviour. Must register AFTER the
        // void-block plugins (Image/MediaEmbed/File) so their default
        // insertBreak is the one we wrap.
        ListContinuationPlugin,
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
          toggle_v2: ToggleV2Element,
          toggle_v2_summary: ToggleV2SummaryElement,
          glossary: GlossaryElement,
          glossary_entry: GlossaryEntryElement,
          glossary_term: GlossaryTermElement,
          glossary_definition: GlossaryDefinitionElement,
          img: ImageElement,
          media_embed: MediaEmbedElement,
          file: FileElement,
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
      // Apply pending dimensions from paste-uploaded images (keyed by URL)
      if (pendingDimensionsMap.current.size > 0) {
        const entries = Array.from(
          editor.api.nodes({
            match: (n: Record<string, unknown>) =>
              n.type === "img" && !n.width && pendingDimensionsMap.current.has(n.url as string),
          })
        );
        for (const [node, path] of entries) {
          const url = (node as Record<string, unknown>).url as string;
          const dims = pendingDimensionsMap.current.get(url);
          if (dims) {
            pendingDimensionsMap.current.delete(url);
            editor.tf.setNodes(
              { width: dims.width, height: dims.height } as Record<string, unknown>,
              { at: path }
            );
          }
        }
      }
      onChangeRef.current?.(value);
    },
    [editor],
  );

  const handleImageInsert = useCallback(
    (url: string, width: number, height: number) => {
      editor.tf.insertNodes(
        {
          type: "img",
          url,
          ...(width && height ? { width, height } : {}),
          children: [{ text: "" }],
        } as unknown as Value[number],
        { select: true }
      );
      editor.tf.focus();
    },
    [editor],
  );

  const handleEmbed = useCallback(
    (embedUrl: string, sourceUrl: string) => {
      editor.tf.insertNodes(
        {
          type: "media_embed",
          url: embedUrl,
          sourceUrl,
          children: [{ text: "" }],
        } as unknown as Value[number],
        { select: true }
      );
      editor.tf.focus();
    },
    [editor],
  );

  const handleFileInsert = useCallback(
    (url: string, name: string, size: number) => {
      editor.tf.insertNodes(
        {
          type: "file",
          url,
          name,
          size,
          children: [{ text: "" }],
        } as unknown as Value[number],
        { select: true }
      );
      editor.tf.focus();
    },
    [editor],
  );

  const handleHtmlImport = useCallback(
    (
      value: Record<string, unknown>[],
      mode: "append" | "replace",
    ) => {
      const nodes = value as unknown as Value;
      if (mode === "replace") {
        // Remove existing top-level nodes back-to-front so paths stay valid.
        for (let i = editor.children.length - 1; i >= 0; i--) {
          editor.tf.removeNodes({ at: [i] });
        }
        editor.tf.insertNodes(nodes, { at: [0] });
      } else {
        editor.tf.insertNodes(nodes, { at: [editor.children.length] });
      }
      editor.tf.focus();
    },
    [editor],
  );

  return (
    <div className={cn("rounded-lg border border-input bg-card overflow-clip", className)}>
      <Plate editor={editor} onValueChange={handleValueChange}>
        <EditorToolbar
          editor={editor}
          rightSlot={rightSlot}
          onOpenImageDialog={() => setShowImageDialog(true)}
          onOpenEmbedDialog={() => setShowEmbedDialog(true)}
          onOpenFileDialog={() => setShowFileDialog(true)}
          onOpenImportHtmlDialog={() => setShowImportHtmlDialog(true)}
        />
        <PlateContent
          placeholder="Start writing..."
          className="min-h-[400px] px-6 py-4 outline-none text-foreground/85 leading-relaxed"
        />
      </Plate>

      {/* Media dialogs */}
      <ImageUploadDialog
        open={showImageDialog}
        onOpenChange={setShowImageDialog}
        articleId={articleId}
        onInsert={handleImageInsert}
      />
      <VideoEmbedDialog
        open={showEmbedDialog}
        onOpenChange={setShowEmbedDialog}
        onEmbed={handleEmbed}
      />
      <FileUploadDialog
        open={showFileDialog}
        onOpenChange={setShowFileDialog}
        articleId={articleId}
        onInsert={handleFileInsert}
      />
      <ImportHtmlDialog
        open={showImportHtmlDialog}
        onOpenChange={setShowImportHtmlDialog}
        onImport={handleHtmlImport}
      />
    </div>
  );
}
