# §2.1 Editor-Controlled Resource Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let an author mark a standalone link as a resource card via a per-link `displayAsCard` flag, so a lone or sub-threshold link can render as a card (grid tile) while the existing auto-grid-at-4+ behaviour stays as the default.

**Architecture:** The flag lives on the link node (`{ type: "a", url, displayAsCard?: true, children }`). Two authoring surfaces set it: a tickbox in the article-link insert popover, and a floating "Show as card" toggle on a selected standalone link. The read-path grouping (`resource-grid.ts`) is extended so a candidate is a card if it is a flagged standalone link **or** it sits in a run of 4+ candidates; adjacent cards group into a grid. The flag is presentational: it survives autosave (no sanitisation) and the Algolia path ignores it (index-safe). Files are untouched in v1.

**Tech Stack:** Next.js 16 / React 19, Plate (platejs + @platejs/link/react), TypeScript strict, Vitest 4.

## Global Constraints

- **Index-safety:** do NOT touch the Algolia serialisation path (`createNativeStaticEditor` / `LinkStatic`). It renders links inline and ignores `displayAsCard` by construction. A flagged link must index identically to an inline link.
- **No migration:** auto-detection stays as the default, so existing 4+ grids keep rendering. The flag is purely additive.
- **Files untouched in v1:** the flag applies to standalone links only. `file` void behaviour (block when lone, tile in a 4+ run) is unchanged.
- **No full in-editor card render:** match §2 — the editor shows the flagged state + the "displays as … when published · Preview" hint; Preview shows the real card.
- British English in user-facing text and comments. No Claude attribution in commits/PR. `/code-review` before commit (hook-enforced). PR + Gemini loop. Never merge unprompted.

---

### Task 1: Read-path rule — a flagged standalone link renders as a card

**Files:**
- Modify: `src/lib/resource-grid.ts`
- Test: `src/lib/resource-grid.test.ts`

**Interfaces:**
- Consumes: `standaloneLink(node)` (existing — returns the inner `a` node of a standalone-link paragraph, or null), `MIN_GRID_RUN` (existing, = 4), `isResourceCell` (existing).
- Produces: unchanged public signatures for `groupResourceGrids(value): Value` and `hasResourceGridRun(value): boolean`; new private `isFlaggedCard(node): boolean`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/resource-grid.test.ts` (the existing `L` helper builds an unflagged standalone-link paragraph; add a flagged variant):

```ts
// A standalone-link paragraph whose inner link is flagged as a card.
const LC = (u: string) => ({ type: "p", children: [{ text: "" }, { type: "a", url: u, displayAsCard: true, children: [{ text: u }] }] });

describe("displayAsCard (§2.1)", () => {
  it("a single flagged link becomes a grid of one, below the 4+ threshold", () => {
    const out = groupResourceGrids([P, LC("/one"), P] as never);
    expect(out[1].type).toBe("resource_grid");
    expect((out[1].children as unknown[]).length).toBe(1);
  });

  it("adjacent flagged links group into one grid; an unflagged sub-run link stays inline", () => {
    const out = groupResourceGrids([LC("/a"), LC("/b"), L("/c")] as never);
    // a+b group (flagged), c is an unflagged sub-threshold link -> stays a paragraph
    expect(out[0].type).toBe("resource_grid");
    expect((out[0].children as unknown[]).length).toBe(2);
    expect(out[1].type).toBe("p");
  });

  it("a 4+ run still grids regardless of flags (auto unchanged)", () => {
    const four = groupResourceGrids([L("/1"), L("/2"), L("/3"), L("/4")] as never);
    expect(four).toHaveLength(1);
    expect(four[0].type).toBe("resource_grid");
  });

  it("hasResourceGridRun is true for a single flagged link", () => {
    expect(hasResourceGridRun([P, LC("/one")] as never)).toBe(true);
    expect(hasResourceGridRun([P, L("/one")] as never)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/resource-grid.test.ts`
Expected: the four new tests FAIL (a single/sub-threshold flagged link is not yet grouped).

- [ ] **Step 3: Implement the rule**

In `src/lib/resource-grid.ts`, add the helper (near `standaloneLink`):

```ts
/** A standalone-link paragraph whose inner link is explicitly flagged as a card. */
function isFlaggedCard(node: Node): boolean {
  const link = standaloneLink(node);
  return !!link && (link as Node).displayAsCard === true;
}
```

Replace the `flush` inside `groupResourceGrids` so a sub-threshold run still promotes adjacent flagged cards:

```ts
  const flush = () => {
    if (run.length === 0) return;
    if (run.length >= MIN_GRID_RUN) {
      // 4+ consecutive candidates: the whole run is a grid (auto, unchanged).
      out.push({ type: "resource_grid", children: run } as unknown as Value[number]);
    } else {
      // Below threshold: group runs of adjacent flagged cards; emit the rest as-is
      // (an unflagged link stays inline; a file stays its own block).
      let cards: Value = [];
      const flushCards = () => {
        if (cards.length > 0) {
          out.push({ type: "resource_grid", children: cards } as unknown as Value[number]);
          cards = [];
        }
      };
      for (const node of run) {
        if (isFlaggedCard(node as Node)) cards.push(node);
        else { flushCards(); out.push(node); }
      }
      flushCards();
    }
    run = [];
  };
```

Update `hasResourceGridRun` so a flagged card also counts (the editor hint must fire for it):

```ts
export function hasResourceGridRun(value: Value): boolean {
  let run = 0;
  for (const node of value) {
    if (isResourceCell(node as Node)) {
      run++;
      if (run >= MIN_GRID_RUN || isFlaggedCard(node as Node)) return true;
    } else {
      run = 0;
    }
  }
  return false;
}
```

(`isResourceCell`, `resolveResourceCell`, `standaloneLink` are unchanged — `resolveResourceCell` already resolves the inner link to a tile.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/resource-grid.test.ts`
Expected: all pass (the four new + the existing suite).

- [ ] **Step 5: Commit**

```bash
git add src/lib/resource-grid.ts src/lib/resource-grid.test.ts
git commit -m "§2.1: read-path — a flagged standalone link renders as a card"
```

---

### Task 2: Set the flag when inserting an article link

**Files:**
- Modify: `src/components/resources/article-link-popover.tsx`
- Modify: `src/components/resources/plate-editor.tsx:352-365` (the `onInsertLink` wiring)

**Interfaces:**
- Produces: `onInsertLink(url: string, title: string, displayAsCard: boolean)` — signature gains the flag.

- [ ] **Step 1: Add the checkbox to the popover**

In `article-link-popover.tsx`: change the prop type to `onInsertLink: (url: string, title: string, displayAsCard: boolean) => void;`. Add `const [asCard, setAsCard] = useState(false);`. Render a checkbox above the results list (reuse the existing `Checkbox` + `Label` shadcn primitives, matching the export-poll dialog pattern): "Display as a card". Pass `asCard` in `handleSelect`: `onInsertLink(articleUrl, article.title, asCard);` and reset `setAsCard(false)` alongside the other resets.

- [ ] **Step 2: Thread the flag into the inserted node**

In `plate-editor.tsx:354-362`, update the handler:

```tsx
onInsertLink={(url, title, displayAsCard) => {
  editor.tf.insertNodes(
    { type: "a", url, children: [{ text: title }], ...(displayAsCard && { displayAsCard: true }) },
    { select: true }
  );
  editor.tf.focus();
}}
```

- [ ] **Step 3: Manual check**

Run `npm run dev`; in a native article, open the link popover, tick "Display as a card", insert an article link on its own line. Save, open Preview: the link renders as a single card. Untick and insert another: it stays an inline link.

- [ ] **Step 4: `/code-review`, then commit**

```bash
git add src/components/resources/article-link-popover.tsx src/components/resources/plate-editor.tsx
git commit -m "§2.1: 'Display as a card' tickbox in the article-link insert popover"
```

---

### Task 3: Floating "Show as card" toggle on a selected standalone link

**Files:**
- Modify: `src/components/resources/plate-elements.tsx` (`LinkElement`, lines 122-140)

**Interfaces:**
- Consumes: `useSelected` and `useEditorRef` from `platejs/react` (already used by `FileElement`); `editor.api.findPath`, `editor.tf.setNodes`, `editor.tf.unsetNodes`.

- [ ] **Step 1: Detect a standalone link**

A link is "standalone" when its parent paragraph's only meaningful child is the link. In `LinkElement`, compute this from the editor: get the link's path via `editor.api.findPath(element)`, read the parent node, and reuse the same meaningful-children test as `standaloneLink` (a single `a` child, ignoring empty text). Only a standalone link may become a card.

- [ ] **Step 2: Render the toggle when selected + standalone**

Mirror `FileElement`'s `useSelected`-gated control (plate-elements.tsx:906-921). When `useSelected()` is true and the link is standalone, render a small ghost button immediately after the `<a>` (inside a `contentEditable={false}` span so it isn't edited): label "Show as card" when `displayAsCard` is falsy, "Show inline" when true. `onMouseDown={(e) => { e.preventDefault(); const path = editor.api.findPath(element); if (!path) return; if (element.displayAsCard) editor.tf.unsetNodes("displayAsCard", { at: path }); else editor.tf.setNodes({ displayAsCard: true }, { at: path }); }}`. Keep the `<a>` render otherwise unchanged (inline, per the existing comment about not wrapping inline elements).

- [ ] **Step 3: Manual check (the Activity Plans case)**

Run `npm run dev`; open the Group Work article's editor. Select the lone "Getting to Know You Activity Plans" link. The "Show as card" toggle appears; click it. Save, open Preview: it now renders as a single card. Toggle again → back to an inline link. Confirm the toggle does NOT appear for a link inside a sentence.

- [ ] **Step 4: `/code-review`, then commit**

```bash
git add src/components/resources/plate-elements.tsx
git commit -m "§2.1: floating 'Show as card' toggle on a selected standalone link"
```

---

### Task 4: Editor hint reflects flagged cards

**Files:**
- Modify: `src/components/resources/native-article-editor.tsx` (the `hasGrid` hint copy, ~line 203-215)

**Interfaces:**
- Consumes: `hasResourceGridRun` (Task 1 already makes it fire for a flagged card).

- [ ] **Step 1: Broaden the hint copy**

The hint currently reads "Runs of 4 or more files or links display as a grid when published." Since a single flagged link now also renders as a card, reword to cover both: "Cards and runs of 4+ links display as a grid when published." Keep the existing Preview link. No logic change — `hasResourceGridRun` already returns true for a flagged card after Task 1.

- [ ] **Step 2: Manual check + commit**

Confirm the hint shows when an article has a single flagged card. Then:

```bash
git add src/components/resources/native-article-editor.tsx
git commit -m "§2.1: editor hint covers single flagged cards"
```

---

### Task 5: Full verification

- [ ] **Step 1: Full suite + lint**

Run: `npx vitest run && npx eslint src/lib/resource-grid.ts src/components/resources/article-link-popover.tsx src/components/resources/plate-editor.tsx src/components/resources/plate-elements.tsx src/components/resources/native-article-editor.tsx`
Expected: all tests pass; ESLint exit 0.

- [ ] **Step 2: Browser verification (Chrome MCP, save screenshots)**

1. **Flag an existing lone link → card:** the Activity Plans case (Task 3 Step 3), verified on the read view.
2. **Insert a flagged article link → card** (Task 2 Step 3).
3. **Auto-grid unchanged:** a section with 4+ links still renders as a grid.
4. **Index-safety:** confirm (via `getComputedStyle`/DOM or an Algolia reindex of the test article) that a flagged link still indexes as a link — the serialised Algolia HTML is unchanged by the flag.
5. **In-sentence link:** the toggle does not appear; the link stays inline.

- [ ] **Step 3: `/code-review` on the full diff, then push + PR + Gemini + await merge approval.**

---

## Out of scope (v1)

- **Opt-out** on files / forcing a link inline inside a 4+ run (three-way Auto/Card/Inline). Trivial extension of the same flag.
- **Files** getting the flag (deferred — see the spec's grounding refinement).
- **Full in-editor card rendering** (a link is a Plate inline node; deferred to keep v1 simple, matching §2's hint+Preview model).
