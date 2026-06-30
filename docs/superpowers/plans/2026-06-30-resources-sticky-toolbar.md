# Sticky editor toolbar — Implementation Plan (PR 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the native-article editor's toolbar a single sticky bar — format tools plus Save/View/Publish — pinned below the app header, so the controls stay reachable when scrolling a long article.

**Architecture:** The format toolbar (`EditorToolbar` in `plate-editor.tsx`) grows a `rightSlot` so it stays reusable; `native-article-editor.tsx` passes its Save/View/Publish cluster (extracted into a small presentational `EditorSaveControls`) into that slot, and drops its separate header bar. The toolbar pins at `top-16` (clearing the 64px sticky app header). The editor card switches `overflow-hidden` → `overflow-clip` so the sticky context isn't trapped.

**Tech Stack:** Next.js 16 (App Router), React 19, Plate (platejs), Tailwind v4, TypeScript strict, Vitest + React Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-06-30-resources-redesign-design.md` (§1).

## Global Constraints

- British English in all user-facing copy. Don't change existing copy strings in this PR.
- Buttons follow `docs/button-system.md`: never put `h-X w-X` on a `Button` (use the `size` prop); don't add explicit icon sizing inside a `Button` (the variant injects `[&_svg]:size-*`). An ESLint rule enforces this.
- Branch `fix/resources-sticky-toolbar` off `main`; PR via `gh pr create`. Run `/code-review` on the diff before committing. No Claude attribution in commits or the PR body.
- The app header is `sticky top-0 z-50` and 64px tall (`header.tsx:70`) — the toolbar offset must clear it (`top-16`).

---

## Setup (once, before Task 1)

- [ ] **Create the branch**

Run:
```bash
git checkout main && git pull
git checkout -b fix/resources-sticky-toolbar
```

---

### Task 1: `EditorSaveControls` presentational component

A focused, testable component holding the save-status indicator + Save / View / Publish buttons. Pure presentation; all state and handlers stay in `native-article-editor.tsx` and arrive as props.

**Files:**
- Create: `src/components/resources/editor-save-controls.tsx`
- Test: `src/components/resources/editor-save-controls.test.tsx`

**Interfaces:**
- Produces: `EditorSaveControls(props: { saveStatus: "idle"|"saving"|"saved"|"error"; onSave: () => void; viewHref: string; isPublished: boolean; onPublishToggle: () => void; isPublishPending: boolean }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/resources/editor-save-controls.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EditorSaveControls } from "./editor-save-controls";

const base = {
  saveStatus: "idle" as const,
  onSave: () => {},
  viewHref: "/resources/article/x",
  isPublished: false,
  onPublishToggle: () => {},
  isPublishPending: false,
};

describe("EditorSaveControls", () => {
  it("renders Save, View article and Publish, and fires onSave on click", () => {
    const onSave = vi.fn();
    render(<EditorSaveControls {...base} onSave={onSave} />);
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("View article")).toBeInTheDocument();
    expect(screen.getByText("Publish")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows the Saved status and an Unpublish button when published", () => {
    render(<EditorSaveControls {...base} saveStatus="saved" isPublished />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Unpublish")).toBeInTheDocument();
  });

  it("disables Save while saving", () => {
    render(<EditorSaveControls {...base} saveStatus="saving" />);
    expect(screen.getByText("Save").closest("button")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test -- editor-save-controls`
Expected: FAIL — cannot find module `./editor-save-controls`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/resources/editor-save-controls.tsx
"use client";

import Link from "next/link";
import { Check, Loader2, AlertTriangle, Save, Send, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface EditorSaveControlsProps {
  saveStatus: SaveStatus;
  onSave: () => void;
  viewHref: string;
  isPublished: boolean;
  onPublishToggle: () => void;
  isPublishPending: boolean;
}

/**
 * Save-status indicator + Save / View / Publish controls for the native
 * article editor. Presentational only — state and handlers live in
 * NativeArticleEditor and are passed in. Rendered inside the sticky editor
 * toolbar via its `rightSlot`.
 */
export function EditorSaveControls({
  saveStatus,
  onSave,
  viewHref,
  isPublished,
  onPublishToggle,
  isPublishPending,
}: EditorSaveControlsProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {saveStatus === "saving" && (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving...
        </span>
      )}
      {saveStatus === "saved" && (
        <span className="inline-flex items-center gap-1 text-emerald-600">
          <Check className="h-3.5 w-3.5" />
          Saved
        </span>
      )}
      {saveStatus === "error" && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          Failed to save — retrying...
        </span>
      )}

      <Button onClick={onSave} disabled={saveStatus === "saving"}>
        <Save />
        Save
      </Button>
      <Button variant="outline" asChild>
        <Link href={viewHref}>View article</Link>
      </Button>
      {isPublished ? (
        <Button variant="outline" onClick={onPublishToggle} disabled={isPublishPending}>
          <EyeOff />
          Unpublish
        </Button>
      ) : (
        <Button variant="success" onClick={onPublishToggle} disabled={isPublishPending}>
          <Send />
          Publish
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test -- editor-save-controls`
Expected: PASS (3 tests).

---

### Task 2: `rightSlot` on the toolbar + sticky + `overflow-clip`

**Files:**
- Modify: `src/components/resources/plate-editor.tsx` (`EditorToolbarProps` + `EditorToolbar` ~287-377; `PlateEditorProps` ~388-397; `PlateRichEditor` return ~645-660)

**Interfaces:**
- Consumes: nothing new.
- Produces: `PlateRichEditor` accepts an optional `rightSlot?: React.ReactNode`, rendered at the right end of the now-sticky toolbar.

- [ ] **Step 1: Add `rightSlot` to `EditorToolbarProps` and render it; make the bar sticky + opaque**

In `EditorToolbarProps`, add:
```tsx
rightSlot?: React.ReactNode;
```
Change the `EditorToolbar` signature to destructure `rightSlot`, then change the root `<div>` and append the slot:
```tsx
// was: className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1.5"
<div className="sticky top-16 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-muted px-2 py-1.5">
  {/* ...all existing marks / headings / blocks / link / InsertBlockDropdown unchanged... */}
  {rightSlot && (
    <div className="ml-auto flex items-center gap-2">{rightSlot}</div>
  )}
</div>
```

- [ ] **Step 2: Add `rightSlot` to `PlateEditorProps`, forward it, and switch the card to `overflow-clip`**

In `PlateEditorProps` add `rightSlot?: React.ReactNode;`. Destructure it in `PlateRichEditor`. In the return:
```tsx
// card wrapper: overflow-hidden -> overflow-clip
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
  {/* ...dialogs unchanged... */}
</div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

---

### Task 3: Wire `native-article-editor` to the slot

Move the Save/View/Publish cluster into the toolbar slot; keep the breadcrumb in its own (non-sticky) row above the editor; keep the publish dialog.

**Files:**
- Modify: `src/components/resources/native-article-editor.tsx` (header block ~168-246; `PlateRichEditor` usage ~263-267)

**Interfaces:**
- Consumes: `EditorSaveControls` (Task 1), `PlateRichEditor` `rightSlot` (Task 2).

- [ ] **Step 1: Import `EditorSaveControls`**

```tsx
import { EditorSaveControls } from "./editor-save-controls";
```
Remove now-unused icon imports if they're no longer referenced in this file (`Check`, `Loader2`, `Save`, `Send`, `EyeOff`; keep `AlertTriangle` and `ArrowLeft` — `AlertTriangle` is still used by the concurrent-edit/published warnings, `ArrowLeft` by the breadcrumb). Verify with the typecheck in Step 4.

- [ ] **Step 2: Replace the header bar with a breadcrumb-only row**

Replace the `<div className="flex items-center justify-between"> … </div>` block (the breadcrumb nav + the save-status/buttons cluster) with just the breadcrumb nav:
```tsx
{/* Breadcrumb — scrolls away; the controls live in the sticky toolbar */}
<nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
  <Link
    href={`/resources/article/${article.slug}`}
    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
  >
    <ArrowLeft className="h-3.5 w-3.5" />
    Back to article
  </Link>
  <span className="text-muted-foreground/50">/</span>
  <span className="inline-flex items-center gap-1.5">
    {createElement(resolveIcon(category.icon), { className: cn("h-3.5 w-3.5", iconFg) })}
    {category.name}
  </span>
</nav>
```

- [ ] **Step 3: Pass the controls into the editor's `rightSlot`**

Change the `PlateRichEditor` usage:
```tsx
<PlateRichEditor
  initialValue={initialValue}
  onChange={handleChange}
  articleId={article.id}
  rightSlot={
    <EditorSaveControls
      saveStatus={saveStatus}
      onSave={handleManualSave}
      viewHref={`/resources/article/${article.slug}`}
      isPublished={isPublished}
      onPublishToggle={() => setPublishOpen(true)}
      isPublishPending={isPublishPending}
    />
  }
/>
```
Leave `<PublishConfirmDialog ... />` and the warning callouts where they are.

- [ ] **Step 4: Typecheck + run the editor tests**

Run: `npx tsc --noEmit -p tsconfig.json && npm test -- editor-save-controls`
Expected: no type errors; tests pass; no unused-import lint errors (fix any flagged in Step 1).

---

### Task 4: Verify, review, commit

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: passes (no `mcr-button` violations, no unused imports).

- [ ] **Step 2: Manual verification (the load-bearing check for a layout change)**

Start the dev server (`npm run dev`), open a long native article at `/resources/article/<slug>/edit` in the Chrome MCP tab. Scroll the body. Confirm:
- The single bar (format tools on the left, ✓ Saved / Save / View article / Publish on the right) stays pinned directly below the app header.
- Body text scrolls under the bar without bleeding through (opaque `bg-muted`).
- The bar isn't hidden behind the header (that would mean the `top-16` offset or an ancestor `overflow` is wrong).
- Save still saves; Publish still opens the confirm dialog.

Capture a screenshot top + mid-scroll for the PR.

- [ ] **Step 3: `/code-review` the diff and address findings**

Run the `/code-review` skill on the working diff. Address anything it finds (re-run lint/typecheck/tests after).

- [ ] **Step 4: Commit on the branch**

```bash
git add src/components/resources/editor-save-controls.tsx \
        src/components/resources/editor-save-controls.test.tsx \
        src/components/resources/plate-editor.tsx \
        src/components/resources/native-article-editor.tsx
git commit -m "Sticky editor toolbar: one bar with Save/Publish via a toolbar slot"
```
(`/code-review` has run, so the commit gate passes; no `[skip-review]` needed.)

- [ ] **Step 5: Push + open the PR, then run Gemini**

```bash
git push -u origin fix/resources-sticky-toolbar
gh pr create --base main --title "Sticky editor toolbar (resources §1)" --body "<summary + manual-verification screenshots>"
```
Then request `/gemini review` as a PR comment, verify each comment against the code, reply to every one, loop (cap 3 rounds), and wait for explicit merge approval.

---

## Out of scope for this PR

- The optional Plate `FloatingToolbar` selection bubble. The spec marks it optional ("ship the sticky bar alone if positioning is fiddly"); it's a possible follow-up, not part of PR 1.
- §2–§4 (grid, promotion, rail) and the lightbox refactor — separate PRs with their own plans.

## Self-review notes

- Spec §1 coverage: sticky `top-16` (Task 2), opaque fill (Task 2), `overflow-clip` (Task 2), one bar via `rightSlot` (Tasks 1–3), reusable editor preserved (the slot is generic). ✓
- No placeholders: all code shown; tests are runnable.
- Type consistency: `EditorSaveControls` prop names/types in Task 1 match the call site in Task 3; `rightSlot: React.ReactNode` is consistent across `EditorToolbarProps`, `PlateEditorProps`, and the call site.
- Honest gap: the sticky/`overflow` behaviour is CSS, verified manually (Task 4 Step 2), not by a unit test — fabricating a jsdom layout assertion would be a false guarantee.
