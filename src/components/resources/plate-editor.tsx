"use client";

/**
 * Native Plate editor for resource articles.
 *
 * Plugin registration, toolbar, and editor wrapper. Element/leaf
 * components live in plate-elements.tsx. Media dialogs in media-dialogs.tsx.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
import { TogglePlugin } from "@platejs/toggle/react";
import { IndentPlugin } from "@platejs/indent/react";
import { ImagePlugin, MediaEmbedPlugin, FilePlugin } from "@platejs/media/react";
import { toggleList, ListStyleType } from "@platejs/list";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArticleLinkPopover } from "./article-link-popover";
import { uploadEditorMedia } from "@/app/(protected)/resources/media-actions";
import {
  ImageUploadDialog,
  VideoEmbedDialog,
  FileUploadDialog,
} from "./media-dialogs";
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
  ToggleElement,
  ImageElement,
  MediaEmbedElement,
  FileElement,
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
  ChevronRight,
  ImageIcon,
  Video,
  Paperclip,
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
}

function InsertBlockDropdown({
  editor,
  onOpenImageDialog,
  onOpenEmbedDialog,
  onOpenFileDialog,
}: InsertBlockDropdownProps) {
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
            editor.tf.insert.nodes(
              { type: "toggle", id: crypto.randomUUID(), children: [{ text: "" }] },
              { select: true }
            );
            editor.tf.focus();
          }}
        >
          <ChevronRight className="h-4 w-4" />
          Toggle
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================
// TOOLBAR
// =============================================

interface EditorToolbarProps {
  editor: NonNullable<ReturnType<typeof usePlateEditor>>;
  onOpenImageDialog: () => void;
  onOpenEmbedDialog: () => void;
  onOpenFileDialog: () => void;
}

function EditorToolbar({
  editor,
  onOpenImageDialog,
  onOpenEmbedDialog,
  onOpenFileDialog,
}: EditorToolbarProps) {
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
      <InsertBlockDropdown
        editor={editor}
        onOpenImageDialog={onOpenImageDialog}
        onOpenEmbedDialog={onOpenEmbedDialog}
        onOpenFileDialog={onOpenFileDialog}
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
  /** Article ID for media upload tracking (required — uploads need an article association) */
  articleId: string;
  /** Additional className for the editor container */
  className?: string;
}

export function PlateRichEditor({
  initialValue,
  onChange,
  articleId,
  className,
}: PlateEditorProps) {
  const onChangeRef = useRef(onChange);
  const articleIdRef = useRef(articleId);
  const pendingDimensionsMap = useRef(new Map<string, { width: number; height: number }>());

  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);
  const [showFileDialog, setShowFileDialog] = useState(false);

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
            targetPlugins: ["p", "h1", "h2", "h3", "h4", "blockquote", "toggle"],
          },
        }),
        TogglePlugin,
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
          toggle: ToggleElement,
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

  return (
    <div className={cn("rounded-lg border border-input bg-card overflow-hidden", className)}>
      <Plate editor={editor} onValueChange={handleValueChange}>
        <EditorToolbar
          editor={editor}
          onOpenImageDialog={() => setShowImageDialog(true)}
          onOpenEmbedDialog={() => setShowEmbedDialog(true)}
          onOpenFileDialog={() => setShowFileDialog(true)}
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
    </div>
  );
}
