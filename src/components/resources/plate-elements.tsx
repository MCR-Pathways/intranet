"use client";

/**
 * Element and leaf components for the native Plate editor.
 *
 * Extracted from plate-editor.tsx to keep the main file focused
 * on plugin registration and toolbar. Each component wraps
 * PlateElement/PlateLeaf with semantic HTML + Tailwind styling.
 */

import { createElement, useState } from "react";
import { PlateElement, PlateLeaf, useEditorRef, useSelected } from "platejs/react";
import {
  TablePlugin,
  useTableElement,
  useTableCellElement,
  useTableCellElementResizable,
  useSelectedCells,
  useTableColSizes,
} from "@platejs/table/react";
import {
  insertTableRow,
  insertTableColumn,
  deleteRow,
  deleteColumn,
  deleteTable,
} from "@platejs/table";
import { ResizeHandle } from "@platejs/resizable";
import { setColumns, toggleColumnGroup } from "@platejs/layout";
import { useToggleButtonState, useToggleButton } from "@platejs/toggle/react";
import { cn } from "@/lib/utils";
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  Minus,
  Trash2,
  Rows3,
  Columns2,
  Columns3,
  PanelLeft,
  PanelRight,
  X,
  ChevronRight,
  Download,
  FileText,
  Pencil,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFileSize } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PlateElementProps, PlateLeafProps } from "platejs/react";
import { VideoEmbedDialog } from "./media-dialogs";

// =============================================
// BASIC ELEMENTS
// =============================================

export function ParagraphElement(props: PlateElementProps) {
  return <PlateElement {...props} as="p" />;
}

export function BlockquoteElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      as="blockquote"
      className="border-l-2 border-border pl-6 italic"
    />
  );
}

export function H1Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h1" className="text-3xl font-bold tracking-tight" />;
}

export function H2Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h2" className="text-2xl font-semibold tracking-tight" />;
}

export function H3Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h3" className="text-xl font-semibold tracking-tight" />;
}

export function H4Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h4" className="text-lg font-semibold tracking-tight" />;
}

export function HrElement(props: PlateElementProps) {
  return (
    <PlateElement {...props}>
      <hr className="my-4 border-border" />
      {props.children}
    </PlateElement>
  );
}

export function LinkElement({ children, element, ...props }: PlateElementProps) {
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

export function CalloutElement({ children, element, editor, ...props }: PlateElementProps) {
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
                const path = editor.api.findPath(element);
                if (!path) return;
                editor.tf.setNodes(
                  { variant: v } as Record<string, unknown>,
                  { at: path }
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
// TABLE
// =============================================

export function TableElement({ children, ...props }: PlateElementProps) {
  const { props: tableProps } = useTableElement();
  const colSizes = useTableColSizes();

  useSelectedCells();

  return (
    <PlateElement {...props}>
      <div className="relative my-4 group/table overflow-x-auto">
        <TableFloatingToolbar />
        <table
          className="w-full border-collapse border border-border"
          {...tableProps}
        >
          <colgroup>
            {colSizes.map((size, i) => (
              <col
                key={i}
                style={size ? { width: size } : undefined}
              />
            ))}
          </colgroup>
          <tbody>{children}</tbody>
        </table>
      </div>
    </PlateElement>
  );
}

export function TableRowElement(props: PlateElementProps) {
  return <PlateElement {...props} as="tr" />;
}

export function TableCellElement({ children, ...props }: PlateElementProps) {
  const { colIndex, colSpan, rowIndex, selected, width } =
    useTableCellElement();

  const resizable = useTableCellElementResizable({ colIndex, colSpan, rowIndex });

  return (
    <PlateElement
      {...props}
      as="td"
      className={cn(
        "border border-border p-2 align-top relative",
        selected && "bg-primary/10"
      )}
      style={width ? { width } : undefined}
    >
      {children}
      <ResizeHandle
        {...resizable.rightProps}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize opacity-0 hover:opacity-100 bg-primary/40 transition-opacity"
      />
    </PlateElement>
  );
}

export function TableCellHeaderElement({ children, ...props }: PlateElementProps) {
  const { colIndex, colSpan, rowIndex, selected, width } =
    useTableCellElement();

  const resizable = useTableCellElementResizable({ colIndex, colSpan, rowIndex });

  return (
    <PlateElement
      {...props}
      as="th"
      className={cn(
        "border border-border p-2 align-top relative bg-muted font-semibold text-left",
        selected && "bg-primary/10"
      )}
      style={width ? { width } : undefined}
    >
      {children}
      <ResizeHandle
        {...resizable.rightProps}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize opacity-0 hover:opacity-100 bg-primary/40 transition-opacity"
      />
    </PlateElement>
  );
}

function TableFloatingToolbar() {
  const editor = useEditorRef();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isInTable = editor.api.some({
    match: { type: TablePlugin.node.type },
  });

  if (!isInTable) return null;

  return (
    <>
    <div
      contentEditable={false}
      className="absolute -top-9 left-0 z-10 flex items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5 shadow-sm opacity-0 group-focus-within/table:opacity-100 transition-opacity"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onMouseDown={(e) => {
              e.preventDefault();
              insertTableRow(editor, { before: true });
              editor.tf.focus();
            }}
            aria-label="Insert row above"
          >
            <Plus className="h-3.5 w-3.5" />
            <Rows3 className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Insert row above</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onMouseDown={(e) => {
              e.preventDefault();
              insertTableRow(editor);
              editor.tf.focus();
            }}
            aria-label="Insert row below"
          >
            <Rows3 className="h-3 w-3" />
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Insert row below</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onMouseDown={(e) => {
              e.preventDefault();
              insertTableColumn(editor, { before: true });
              editor.tf.focus();
            }}
            aria-label="Insert column left"
          >
            <Plus className="h-3.5 w-3.5" />
            <Columns3 className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Insert column left</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onMouseDown={(e) => {
              e.preventDefault();
              insertTableColumn(editor);
              editor.tf.focus();
            }}
            aria-label="Insert column right"
          >
            <Columns3 className="h-3 w-3" />
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Insert column right</TooltipContent>
      </Tooltip>

      <div className="w-px h-5 bg-border mx-0.5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onMouseDown={(e) => {
              e.preventDefault();
              deleteRow(editor);
              editor.tf.focus();
            }}
            aria-label="Delete row"
          >
            <Minus className="h-3.5 w-3.5" />
            <Rows3 className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Delete row</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            onMouseDown={(e) => {
              e.preventDefault();
              deleteColumn(editor);
              editor.tf.focus();
            }}
            aria-label="Delete column"
          >
            <Minus className="h-3.5 w-3.5" />
            <Columns3 className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Delete column</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="hover:bg-destructive/10 hover:text-destructive"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowDeleteConfirm(true);
            }}
            aria-label="Delete table"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Delete table</TooltipContent>
      </Tooltip>
    </div>

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete table?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove the entire table and its contents. You can undo with Ctrl+Z.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              deleteTable(editor);
              editor.tf.focus();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// =============================================
// COLUMNS
// =============================================

const COLUMN_PRESETS = [
  { label: "2 equal", icon: Columns2, columns: 2, widths: undefined },
  { label: "3 equal", icon: Columns3, columns: 3, widths: undefined },
  { label: "2/3 + 1/3", icon: PanelLeft, columns: undefined, widths: ["66%", "34%"] },
  { label: "1/3 + 2/3", icon: PanelRight, columns: undefined, widths: ["34%", "66%"] },
] as const;

export function ColumnGroupElement({ children, element, ...props }: PlateElementProps) {
  const editor = useEditorRef();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  return (
    <PlateElement element={element} {...props}>
      <div className="flex gap-4 my-4 w-full relative group/columns">
        {/* Layout switcher — visible on hover/focus */}
        <div
          contentEditable={false}
          className="absolute -top-8 left-0 z-10 flex items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5 shadow-sm opacity-0 group-hover/columns:opacity-100 group-focus-within/columns:opacity-100 transition-opacity"
        >
          {COLUMN_PRESETS.map((preset) => (
            <Tooltip key={preset.label}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const at = editor.api.findPath(element);
                    if (!at) return;
                    if (preset.widths) {
                      setColumns(editor, { at, widths: [...preset.widths] });
                    } else {
                      setColumns(editor, { at, columns: preset.columns });
                    }
                    editor.tf.focus();
                  }}
                  aria-label={preset.label}
                >
                  <preset.icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{preset.label}</TooltipContent>
            </Tooltip>
          ))}

          <div className="w-px h-5 bg-border mx-0.5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="hover:bg-destructive/10 hover:text-destructive"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowRemoveConfirm(true);
                }}
                aria-label="Remove columns"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Remove columns</TooltipContent>
          </Tooltip>
        </div>

        {children}
      </div>

      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove columns?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unwrap the column layout. Content from each column will become normal blocks. You can undo with Ctrl+Z.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const at = editor.api.findPath(element);
                if (!at) return;
                toggleColumnGroup(editor, { at });
                editor.tf.focus();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PlateElement>
  );
}

export function ColumnItemElement({ children, element, ...props }: PlateElementProps) {
  const width = (element as Record<string, unknown>).width as string | undefined;

  return (
    <PlateElement element={element} {...props}>
      <div
        className={cn(
          "min-w-0 rounded-md p-3 border border-dashed border-border/50",
          !width && "flex-1"
        )}
        style={width ? { width } : undefined}
      >
        {children}
      </div>
    </PlateElement>
  );
}

// =============================================
// TOGGLE
// =============================================

export function ToggleElement({ children, element, ...props }: PlateElementProps) {
  const id = (element as Record<string, unknown>).id as string || "";
  const state = useToggleButtonState(id);
  const { buttonProps, open } = useToggleButton(state);

  return (
    <PlateElement element={element} {...props}>
      <div className="flex items-start gap-1 my-1">
        <button
          type="button"
          contentEditable={false}
          className="mt-1 flex-shrink-0 select-none rounded p-0.5 hover:bg-muted transition-colors"
          aria-expanded={open}
          {...buttonProps}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
        </button>
        <div className="flex-1 min-w-0 font-medium">{children}</div>
      </div>
    </PlateElement>
  );
}

// =============================================
// IMAGE
// =============================================

const IMAGE_ALIGN_EDITOR: Record<string, string> = {
  left: "rounded-lg max-w-full block",
  center: "rounded-lg max-w-full mx-auto block",
  right: "rounded-lg max-w-full ml-auto block",
};

const ALIGN_OPTIONS = [
  { value: "left", icon: AlignLeft, label: "Align left" },
  { value: "center", icon: AlignCenter, label: "Align centre" },
  { value: "right", icon: AlignRight, label: "Align right" },
] as const;

export function ImageElement({ children, element, ...props }: PlateElementProps) {
  const editor = useEditorRef();
  const selected = useSelected();
  const url = (element as Record<string, unknown>).url as string;
  const alt = (element as Record<string, unknown>).alt as string | undefined;
  const width = (element as Record<string, unknown>).width as number | undefined;
  const height = (element as Record<string, unknown>).height as number | undefined;
  const align = ((element as Record<string, unknown>).align as string) || "center";
  const [showAltInput, setShowAltInput] = useState(false);
  const [altText, setAltText] = useState(alt ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handleAlign(value: string) {
    const path = editor.api.findPath(element);
    if (!path) return;
    editor.tf.setNodes({ align: value } as Record<string, unknown>, { at: path });
  }

  return (
    <PlateElement element={element} {...props}>
      <div className="relative my-4" contentEditable={false}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Plate editor element, can't use next/image */}
        <img
          src={url}
          alt={alt ?? ""}
          className={IMAGE_ALIGN_EDITOR[align] ?? IMAGE_ALIGN_EDITOR.center}
          width={width}
          height={height}
          style={width ? { height: "auto" } : undefined}
          loading="lazy"
        />

        {/* Floating toolbar — visible when node is selected */}
        <div className={cn(
          "absolute top-2 right-2 flex items-center gap-1.5 transition-opacity",
          selected ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          {/* Alignment toggle group */}
          <div className="flex rounded-md overflow-hidden border border-border">
            {ALIGN_OPTIONS.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                className={cn(
                  "h-7 w-7 flex items-center justify-center transition-colors",
                  align === value
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAlign(value);
                }}
              >
                {createElement(Icon, { className: "h-3.5 w-3.5" })}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="text-xs"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowAltInput(!showAltInput);
            }}
          >
            <Pencil />
            Alt text
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="text-xs hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete image"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowDeleteConfirm(true);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Alt text input */}
        {showAltInput && (
          <div className="mt-2 flex gap-2">
            <Input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe this image..."
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const path = editor.api.findPath(element);
                  if (!path) return;
                  editor.tf.setNodes({ alt: altText } as Record<string, unknown>, { at: path });
                  setShowAltInput(false);
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                const path = editor.api.findPath(element);
                if (!path) return;
                editor.tf.setNodes({ alt: altText } as Record<string, unknown>, { at: path });
                setShowAltInput(false);
              }}
            >
              Save
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the image from this article. The file will remain in Google Drive. You can undo with Ctrl+Z.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const path = editor.api.findPath(element);
                if (!path) return;
                editor.tf.removeNodes({ at: path });
                editor.tf.focus();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {children}
    </PlateElement>
  );
}

// =============================================
// VIDEO EMBED
// =============================================

export function MediaEmbedElement({ children, element, ...props }: PlateElementProps) {
  const editor = useEditorRef();
  const selected = useSelected();
  const url = (element as Record<string, unknown>).url as string;
  const sourceUrl = (element as Record<string, unknown>).sourceUrl as string | undefined;
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <PlateElement element={element} {...props}>
      <div className="relative my-4" contentEditable={false}>
        <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={url}
            title="Embedded video"
            className="absolute inset-0 w-full h-full"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>

        {/* Floating toolbar — visible when node is selected */}
        <div className={cn(
          "absolute top-2 right-2 flex gap-1 transition-opacity",
          selected ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <Button
            variant="secondary"
            size="sm"
            className="text-xs"
            aria-label="Edit video URL"
            title="Edit"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowEditDialog(true);
            }}
          >
            <Pencil />
            Edit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="text-xs hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove video embed"
            title="Remove"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowDeleteConfirm(true);
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {showEditDialog && (
        <VideoEmbedDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          defaultUrl={sourceUrl ?? ""}
          onEmbed={(newEmbedUrl, newSourceUrl) => {
            const path = editor.api.findPath(element);
            if (!path) return;
            editor.tf.setNodes(
              { url: newEmbedUrl, sourceUrl: newSourceUrl } as Record<string, unknown>,
              { at: path }
            );
          }}
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove video embed?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the video from this article. You can undo with Ctrl+Z.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const path = editor.api.findPath(element);
                if (!path) return;
                editor.tf.removeNodes({ at: path });
                editor.tf.focus();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {children}
    </PlateElement>
  );
}

// =============================================
// FILE ATTACHMENT
// =============================================

export function FileElement({ children, element, ...props }: PlateElementProps) {
  const editor = useEditorRef();
  const selected = useSelected();
  const url = (element as Record<string, unknown>).url as string;
  const name = (element as Record<string, unknown>).name as string | undefined;
  const size = (element as Record<string, unknown>).size as number | undefined;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <PlateElement element={element} {...props}>
      <div
        className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 my-2"
        contentEditable={false}
      >
        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{name ?? "File"}</p>
          {size != null && <p className="text-xs text-muted-foreground">{formatFileSize(size)}</p>}
        </div>
        <a
          href={url}
          download
          aria-label={`Download ${name ?? "file"}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </a>
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(
            "hover:bg-destructive/10 hover:text-destructive transition-opacity",
            selected ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          aria-label="Remove file attachment"
          title="Remove"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowDeleteConfirm(true);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove file attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the file from this article. The file will remain in Google Drive. You can undo with Ctrl+Z.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const path = editor.api.findPath(element);
                if (!path) return;
                editor.tf.removeNodes({ at: path });
                editor.tf.focus();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {children}
    </PlateElement>
  );
}

// =============================================
// LEAF COMPONENTS
// =============================================

export function BoldLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="strong" />;
}

export function ItalicLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="em" />;
}

export function UnderlineLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="u" />;
}

export function StrikethroughLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="s" />;
}
