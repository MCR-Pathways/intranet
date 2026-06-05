"use client";

/**
 * Editor elements for the glossary block. The term/definition hierarchy and
 * layout come from the SAME `.glossary` / `.glossary-entry` / `.glossary-acronyms`
 * classes the static read view uses (defined in globals.css), so authors see
 * exactly what readers see — per the editor-matches-read-view rule.
 *
 * The layout (terms list vs acronyms table) is chosen WHEN THE GLOSSARY IS
 * INSERTED and is fixed thereafter — a set-once structural choice, like a
 * table's column count. The header shows it as a read-only label with a
 * tooltip explaining how to switch (delete + re-insert), so an editor poking
 * at it to change it isn't left wondering where the control is.
 *
 * Editor-only affordances (not in the read view): a light block border, the
 * read-only layout label, a "Delete glossary" control (confirmed — the block
 * can hold dozens of entries), an "Add entry" button, and a per-entry delete
 * control revealed on focus-within (not hover — hover toolbars can target the
 * wrong block when the cursor is elsewhere). Action controls use the shared
 * <Button> for the real button characteristics (cursor, focus ring, tap, a11y)
 * per docs/button-system.md.
 */

import { useState } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import { PathApi } from "platejs";
import { PlateElement, useEditorRef } from "platejs/react";
import type { PlateElementProps } from "platejs/react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createEmptyGlossaryEntry } from "./plate-glossary";

const LAYOUT_FIXED_MESSAGE =
  "A glossary's layout is set when you add it. To switch, delete this block and insert the other type.";

/** Layout label shown in the block header. The layout is fixed at insert. */
const LAYOUT_LABEL: Record<string, string> = {
  terms: "Terms list",
  acronyms: "Acronyms table",
};

export function GlossaryElement({ children, element, ...props }: PlateElementProps) {
  const editor = useEditorRef();
  const variant = ((element as Record<string, unknown>).variant as string) || "terms";
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const entryCount = ((element.children as unknown[]) ?? []).length;

  function handleAddEntry() {
    const path = editor.api.findPath(element);
    if (!path) return;
    const at = [...path, entryCount];
    editor.tf.insertNodes(createEmptyGlossaryEntry() as never, { at });
    const termStart = editor.api.start([...at, 0]);
    if (termStart) editor.tf.select(termStart);
    editor.tf.focus();
  }

  function handleDelete() {
    const path = editor.api.findPath(element);
    if (!path) return;
    editor.tf.removeNodes({ at: path });
    editor.tf.focus();
  }

  return (
    <PlateElement element={element} {...props}>
      <div
        data-variant={variant}
        className={cn(
          "glossary my-3 overflow-hidden rounded-lg border border-border",
          variant === "acronyms" && "glossary-acronyms",
        )}
      >
        {/* Header — editor-only chrome: block identity, the fixed layout
            label, and delete. */}
        <div
          contentEditable={false}
          className="flex items-center gap-2 border-b border-border px-2.5 py-1.5"
        >
          <span className="select-none text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Glossary
          </span>
          {/* Layout is fixed at insert. Clicking the label (the natural "can I
              change this?" gesture) fires a toast explaining how to switch, so
              an editor is told rather than left hunting for a control. */}
          <button
            type="button"
            aria-label="Why can't I change the layout?"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toast(LAYOUT_FIXED_MESSAGE, { id: "glossary-layout-fixed" })}
            className="inline-flex cursor-help select-none items-center gap-1 rounded text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {LAYOUT_LABEL[variant] ?? LAYOUT_LABEL.terms}
            <Info className="h-3.5 w-3.5 opacity-70" />
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete glossary"
            title="Delete glossary"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowDeleteConfirm(true)}
            className="ml-auto text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>

        {children}

        {/* No border-t: the last entry's own divider separates it from this
            button (the globals rule keeps that divider in the editor because
            the button, not an entry, is the container's last child). */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleAddEntry}
          className="w-full justify-start gap-1.5 font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          <Plus />
          Add entry
        </Button>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this glossary?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the glossary and its {entryCount}{" "}
              {entryCount === 1 ? "entry" : "entries"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete glossary
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PlateElement>
  );
}

export function GlossaryEntryElement({ children, element, ...props }: PlateElementProps) {
  const editor = useEditorRef();

  function handleDelete() {
    const path = editor.api.findPath(element);
    if (!path) return;
    editor.tf.removeNodes({ at: path });
    editor.tf.focus();
  }

  // Insert a blank entry directly after this one, cursor in its term. The list
  // is alphabetical, so editors need to add terms mid-list; the "Add entry"
  // button only appends to the end. Mirrors the insertBreak (Enter-in-def) path.
  function handleInsertBelow() {
    const path = editor.api.findPath(element);
    if (!path) return;
    const at = PathApi.next(path);
    editor.tf.insertNodes(createEmptyGlossaryEntry() as never, { at });
    const termStart = editor.api.start([...at, 0]);
    if (termStart) editor.tf.select(termStart);
    editor.tf.focus();
  }

  return (
    <PlateElement element={element} {...props}>
      {/* glossary-entry (globals.css) supplies divider, stacked-vs-two-column
          layout and position:relative. pl-3 insets from the editor border;
          pr-8 reserves room so text never sits under the delete control. */}
      <div className="glossary-entry group/entry pl-3 pr-8">
        {children}
        {/* Hover/focus-reveal is an allowed exception here — Plate editor
            block toolbar, pointer/selection-driven (button-system.md
            §Row-action visibility). focus-visible:opacity-100 keeps it
            reachable by keyboard. */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          contentEditable={false}
          aria-label="Delete entry"
          title="Delete entry"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleDelete}
          className="pointer-events-none absolute right-0 top-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:pointer-events-auto focus-visible:opacity-100 group-focus-within/entry:pointer-events-auto group-focus-within/entry:opacity-100"
        >
          <Trash2 />
        </Button>
        {/* Insert-below: a "+" chip on the entry's bottom divider. Additive, so
            hover-reveal is safe here (unlike the focus-only delete). bg-card + z
            keep it legible where it straddles the divider. */}
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          contentEditable={false}
          aria-label="Insert entry below"
          title="Insert entry below"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleInsertBelow}
          className="pointer-events-none absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2 rounded-full border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-muted hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/entry:pointer-events-auto group-hover/entry:opacity-100 group-focus-within/entry:pointer-events-auto group-focus-within/entry:opacity-100"
        >
          <Plus />
        </Button>
      </div>
    </PlateElement>
  );
}

export function GlossaryTermElement(props: PlateElementProps) {
  // The term is the visual anchor — bold, mirroring the read view's <dt>.
  return <PlateElement {...props} className="font-semibold text-foreground" />;
}

export function GlossaryDefinitionElement(props: PlateElementProps) {
  // Regular weight; the entry's flex/grid gap handles spacing (no margin).
  return <PlateElement {...props} className="text-foreground/80" />;
}
