# Resources §2 — Content-Aware Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a native article's resource list look like a scannable grid instead of one-per-line — a render-only transform, so nothing stored or indexed changes.

**Architecture:** A shared detector wraps runs of 4+ consecutive *resource cells* (a `file` void node, or a paragraph whose only child is a single link) into a `resource_grid` node, on the browser render path only (`prepareNativeArticle`). A `ResourceGrid` static component renders a real `<ul>` of Direction-A cells; each cell is an `<a>` with a Style-C colour-tinted type chip resolved from the file extension (files) or the URL (links). The Algolia path (`createNativeStaticEditor`) is untouched.

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict, Plate static (`platejs/static`, `Base*` plugins), Tailwind v4, Vitest + RTL.

## Global Constraints

- **British English** in any user-facing text and comments.
- **No Claude attribution** in commits/PRs.
- **Build-anything loop:** `/code-review` before each commit (hook-enforced; `[skip-review]` only for docs).
- **Index-safety is non-negotiable:** `groupResourceGrids` runs only inside `prepareNativeArticle` (browser). `createNativeStaticEditor` (Algolia) must never see a `resource_grid`. Locked by a regression test (Task 3).
- **Presentation-only:** the transform never mutates stored `content_json`; it runs on a copy at render time.
- **Accessibility of link destinations is out of scope** (parked). The grid neither fixes nor regresses reachability; a raw Google link tile opens Google. Don't claim otherwise.
- **One PR**, branch `feature/resources-content-grid` off `main`.

---

## File Structure

- **Create** `src/lib/resource-grid.ts` — pure logic: `isResourceCell`, `groupResourceGrids`, `resolveResourceType`, `resolveResourceCell`. No JSX (imports Lucide icon *values*, which is fine in `.ts`, same as `file-types.ts`).
- **Create** `src/lib/resource-grid.test.ts` — unit tests for all four.
- **Modify** `src/lib/plate-static-plugins.tsx` — `BaseResourceGridPlugin`, register `resource_grid: ResourceGrid` in `staticComponents`, the `ResourceGrid` component, and the `groupResourceGrids` call inside `prepareNativeArticle`.
- **Modify** `src/lib/plate-static-plugins.test.tsx` — index-safety regression + the prepareNativeArticle-wraps-a-run test.
- **Editor hint (Task 4)** — `src/components/resources/plate-editor.tsx` or the editor element module.

---

## Task 0: Branch + Phase-0 docs

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull --ff-only
git checkout -b feature/resources-content-grid
```

- [ ] **Step 2: Commit the Phase-0 docs** (the refreshed §2 spec + this plan are already in the working tree)

```bash
git add docs/superpowers/specs/2026-06-30-resources-redesign-design.md \
        docs/superpowers/plans/2026-06-30-resources-content-grid.md
git commit -m "docs: §2 spec refresh (files + Workspace links) + grid plan [skip-review]"
```

---

## Task 1: Type detection — `resolveResourceType` / `resolveResourceCell`

**Files:** Create `src/lib/resource-grid.ts` + `src/lib/resource-grid.test.ts`.

**Interfaces:**
- Produces `resolveResourceType(node): ResourceTypeConfig` where `ResourceTypeConfig = { key: string; label: string; Icon: LucideIcon; bgClass: string; fgClass: string }` (same shape as `FileTypeConfig` from `file-types.ts`).
- Produces `resolveResourceCell(node): { name: string; href: string; newTab: boolean; config: ResourceTypeConfig } | null` (null if the node isn't a resource cell).

- [ ] **Step 1: Write the failing test** — `src/lib/resource-grid.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { resolveResourceType, resolveResourceCell } from "./resource-grid";

const fileNode = (name: string, url = "/api/drive-file/abc") => ({ type: "file", name, url, children: [{ text: "" }] });
const linkPara = (url: string, text = "Link") => ({
  type: "p",
  children: [{ text: "" }, { type: "a", url, children: [{ text }] }, { text: "" }],
});

describe("resolveResourceType", () => {
  it("files resolve by extension", () => {
    expect(resolveResourceType(fileNode("plan.pdf")).key).toBe("pdf");
    expect(resolveResourceType(fileNode("notes.docx")).key).toBe("doc");
  });
  it("classifies Google Workspace links by URL", () => {
    expect(resolveResourceType(linkPara("https://docs.google.com/document/d/x/edit").children[1]).key).toBe("gdoc");
    expect(resolveResourceType(linkPara("https://docs.google.com/spreadsheets/d/x").children[1]).key).toBe("gsheet");
    expect(resolveResourceType(linkPara("https://docs.google.com/presentation/d/x").children[1]).key).toBe("gslides");
    expect(resolveResourceType(linkPara("https://docs.google.com/forms/d/x").children[1]).key).toBe("gform");
    expect(resolveResourceType(linkPara("https://drive.google.com/file/d/x").children[1]).key).toBe("gdrive");
  });
  it("relative + app-origin URLs are internal; others external", () => {
    expect(resolveResourceType(linkPara("/resources/article/x").children[1]).key).toBe("internal");
    expect(resolveResourceType(linkPara("https://example.com/x").children[1]).key).toBe("external");
  });
});

describe("resolveResourceCell", () => {
  it("file cell: name has extension stripped, opens in a new tab at the proxy URL", () => {
    const c = resolveResourceCell(fileNode("Session plan.pdf", "/api/drive-file/abc"))!;
    expect(c.name).toBe("Session plan");
    expect(c.href).toBe("/api/drive-file/abc");
    expect(c.newTab).toBe(true);
  });
  it("internal link cell: link text as name, same-tab", () => {
    const c = resolveResourceCell(linkPara("/resources/article/safeguarding", "Safeguarding essentials"))!;
    expect(c.name).toBe("Safeguarding essentials");
    expect(c.href).toBe("/resources/article/safeguarding");
    expect(c.newTab).toBe(false);
  });
  it("external/Google link cell: new tab", () => {
    const c = resolveResourceCell(linkPara("https://docs.google.com/document/d/x/edit", "Policy"))!;
    expect(c.newTab).toBe(true);
  });
  it("returns null for a non-cell node", () => {
    expect(resolveResourceCell({ type: "p", children: [{ text: "just prose" }] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`resolve*` not defined)

Run: `npx vitest run src/lib/resource-grid.test.ts`

- [ ] **Step 3: Implement `src/lib/resource-grid.ts`**

```ts
import { FileText, Table2, Presentation, ClipboardList, HardDrive, Link2, ExternalLink, type LucideIcon } from "lucide-react";
import { resolveFileType } from "./file-types";
import { APP_ORIGIN } from "./article-constants";

export interface ResourceTypeConfig {
  key: string;
  label: string;
  Icon: LucideIcon;
  bgClass: string;
  fgClass: string;
}

// Link type configs. Tailwind type-colour convention, mirroring file-types.ts
// (which already uses non-brand red/blue/green/orange/slate for file types) —
// so this is the established chip convention, not app chrome.
const GDOC: ResourceTypeConfig    = { key: "gdoc",    label: "Google Doc",    Icon: FileText,      bgClass: "bg-blue-50 dark:bg-blue-950/30",   fgClass: "text-blue-700 dark:text-blue-400" };
const GSHEET: ResourceTypeConfig  = { key: "gsheet",  label: "Google Sheet",  Icon: Table2,        bgClass: "bg-green-50 dark:bg-green-950/30",  fgClass: "text-green-700 dark:text-green-400" };
const GSLIDES: ResourceTypeConfig = { key: "gslides", label: "Google Slides", Icon: Presentation,  bgClass: "bg-amber-50 dark:bg-amber-950/30",  fgClass: "text-amber-700 dark:text-amber-400" };
const GFORM: ResourceTypeConfig   = { key: "gform",   label: "Google Form",   Icon: ClipboardList, bgClass: "bg-purple-50 dark:bg-purple-950/30",fgClass: "text-purple-700 dark:text-purple-400" };
const GDRIVE: ResourceTypeConfig  = { key: "gdrive",  label: "Google Drive",  Icon: HardDrive,     bgClass: "bg-sky-50 dark:bg-sky-950/30",      fgClass: "text-sky-700 dark:text-sky-400" };
const INTERNAL: ResourceTypeConfig= { key: "internal",label: "Page",          Icon: Link2,         bgClass: "bg-cyan-50 dark:bg-cyan-950/30",    fgClass: "text-cyan-700 dark:text-cyan-400" };
const EXTERNAL: ResourceTypeConfig= { key: "external",label: "Link",          Icon: ExternalLink,  bgClass: "bg-slate-100 dark:bg-slate-800/40", fgClass: "text-slate-600 dark:text-slate-400" };

type Node = Record<string, unknown>;
const asNode = (n: unknown) => n as Node;

/** Mirrors LinkStatic (plate-static-plugins.tsx): relative "/…" or an APP_ORIGIN absolute URL is internal. */
function isInternalUrl(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (APP_ORIGIN) {
    try { return new URL(url).origin === APP_ORIGIN; } catch { /* not absolute */ }
  }
  return false;
}

function classifyLink(url: string): ResourceTypeConfig {
  if (isInternalUrl(url)) return INTERNAL;
  try {
    const u = new URL(url);
    if (u.hostname === "docs.google.com") {
      if (u.pathname.startsWith("/document")) return GDOC;
      if (u.pathname.startsWith("/spreadsheets")) return GSHEET;
      if (u.pathname.startsWith("/presentation")) return GSLIDES;
      if (u.pathname.startsWith("/forms")) return GFORM;
    }
    if (u.hostname === "drive.google.com") return GDRIVE;
  } catch { /* relative non-internal or malformed → external */ }
  return EXTERNAL;
}

function plateText(node: Node): string {
  if (typeof node.text === "string") return node.text;
  const kids = node.children as Node[] | undefined;
  return kids ? kids.map(plateText).join("") : "";
}

/** The single link inside a standalone-link paragraph, or null. */
function standaloneLink(node: Node): Node | null {
  if (node.type !== "p") return null;
  const kids = ((node.children as Node[]) ?? []).filter(
    (c) => c.type === "a" || (typeof c.text === "string" && c.text.trim() !== ""),
  );
  return kids.length === 1 && kids[0].type === "a" ? kids[0] : null;
}

export function resolveResourceType(node: Node): ResourceTypeConfig {
  if (node.type === "file") {
    return resolveFileType(node.mimeType as string | undefined, node.name as string | undefined);
  }
  // node is a link (`a`) — or a paragraph; normalise to the link
  const link = node.type === "a" ? node : standaloneLink(node);
  return classifyLink((link?.url as string) ?? "");
}

export function resolveResourceCell(
  node: Node,
): { name: string; href: string; newTab: boolean; config: ResourceTypeConfig } | null {
  if (node.type === "file") {
    const rawName = (node.name as string) || "Document";
    return {
      name: rawName.replace(/\.[^.]+$/, ""), // strip a single trailing extension
      href: (node.url as string) ?? "",
      newTab: true, // proxy URL always opens in a new tab
      config: resolveFileType(node.mimeType as string | undefined, rawName),
    };
  }
  const link = standaloneLink(node);
  if (!link) return null;
  const url = (link.url as string) ?? "";
  return {
    name: plateText(link) || url,
    href: url,
    newTab: !isInternalUrl(url),
    config: classifyLink(url),
  };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/resource-grid.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/resource-grid.ts src/lib/resource-grid.test.ts
git commit -m "Add resource-grid type detection (file extension + Workspace URL)"
```

---

## Task 2: Detector + transform — `isResourceCell` / `groupResourceGrids`

**Files:** extend `src/lib/resource-grid.ts` + `src/lib/resource-grid.test.ts`.

**Interfaces:**
- `isResourceCell(node): boolean` — a `file` node or a standalone-link paragraph.
- `groupResourceGrids(value: Value): Value` — wraps runs of 4+ consecutive resource cells in `{ type: "resource_grid", children: [...cells] }`, returning a new array (never mutates input).

- [ ] **Step 1: Add failing tests**

```ts
import { isResourceCell, groupResourceGrids } from "./resource-grid";

const H = { type: "h2", children: [{ text: "Heading" }] };
const P = { type: "p", children: [{ text: "prose" }] };
const F = (n: string) => ({ type: "file", name: n, url: `/api/drive-file/${n}`, children: [{ text: "" }] });
const L = (u: string) => ({ type: "p", children: [{ text: "" }, { type: "a", url: u, children: [{ text: u }] }] });

describe("isResourceCell", () => {
  it("file and standalone-link paragraph are cells; prose and headings are not", () => {
    expect(isResourceCell(F("a.pdf"))).toBe(true);
    expect(isResourceCell(L("/x"))).toBe(true);
    expect(isResourceCell(P)).toBe(false);
    expect(isResourceCell(H)).toBe(false);
  });
  it("a link inside a sentence is not a cell", () => {
    const inline = { type: "p", children: [{ text: "see " }, { type: "a", url: "/x", children: [{ text: "here" }] }, { text: " for more" }] };
    expect(isResourceCell(inline)).toBe(false);
  });
});

describe("groupResourceGrids", () => {
  it("wraps a run of 4+ cells, leaves <4 alone", () => {
    const four = groupResourceGrids([F("1"), F("2"), F("3"), F("4")]);
    expect(four).toHaveLength(1);
    expect(four[0].type).toBe("resource_grid");
    expect((four[0].children as unknown[])).toHaveLength(4);

    const three = groupResourceGrids([F("1"), F("2"), F("3")]);
    expect(three.every((n) => n.type === "file")).toBe(true);
  });
  it("a heading breaks a run; files + standalone links mix in one grid", () => {
    const out = groupResourceGrids([F("1"), L("/2"), F("3"), L("/4"), H, F("5")]);
    expect(out[0].type).toBe("resource_grid");
    expect((out[0].children as unknown[])).toHaveLength(4);
    expect(out[1]).toBe(H);
    expect(out[2].type).toBe("file"); // trailing single file stays a file
  });
  it("does not mutate the input", () => {
    const input = [F("1"), F("2"), F("3"), F("4")];
    const copy = JSON.parse(JSON.stringify(input));
    groupResourceGrids(input);
    expect(input).toEqual(copy);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement (append to `resource-grid.ts`)**

```ts
import type { Value } from "platejs";

export function isResourceCell(node: Record<string, unknown>): boolean {
  if (node.type === "file") return true;
  return standaloneLink(node) !== null;
}

export function groupResourceGrids(value: Value): Value {
  const out: Value = [];
  let run: Value = [];
  const flush = () => {
    if (run.length >= 4) {
      out.push({ type: "resource_grid", children: run } as unknown as Value[number]);
    } else {
      out.push(...run);
    }
    run = [];
  };
  for (const node of value) {
    if (isResourceCell(node as Record<string, unknown>)) run.push(node);
    else { flush(); out.push(node); }
  }
  flush();
  return out;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/resource-grid.ts src/lib/resource-grid.test.ts
git commit -m "Add resource-grid detector + groupResourceGrids transform"
```

---

## Task 3: `ResourceGrid` component, register, wire into `prepareNativeArticle`, lock index-safety

**Files:** `src/lib/plate-static-plugins.tsx`, `src/lib/plate-static-plugins.test.tsx`.

**Interfaces:** consumes `resolveResourceCell` (Task 1) and `groupResourceGrids` (Task 2).

- [ ] **Step 1: Index-safety regression test first** — add to `src/lib/plate-static-plugins.test.tsx`

```ts
import { prepareNativeArticle, createNativeStaticEditor } from "./plate-static-plugins";

const fileRun = [
  { type: "file", name: "a.pdf", url: "/api/drive-file/a", children: [{ text: "" }] },
  { type: "file", name: "b.pdf", url: "/api/drive-file/b", children: [{ text: "" }] },
  { type: "file", name: "c.pdf", url: "/api/drive-file/c", children: [{ text: "" }] },
  { type: "file", name: "d.pdf", url: "/api/drive-file/d", children: [{ text: "" }] },
];

it("prepareNativeArticle wraps a 4+ file run in a resource_grid", () => {
  const { editor } = prepareNativeArticle(fileRun as never);
  expect(editor.children[0].type).toBe("resource_grid");
});

it("the Algolia editor never sees a resource_grid (index-safe)", () => {
  const editor = createNativeStaticEditor(fileRun as never);
  const types = editor.children.map((n: Record<string, unknown>) => n.type);
  expect(types).not.toContain("resource_grid");
  expect(types.filter((t) => t === "file")).toHaveLength(4);
});
```

Run: `npx vitest run src/lib/plate-static-plugins.test.tsx` — expect the first test to FAIL (no wrapping yet), the second to PASS already.

- [ ] **Step 2: Register the plugin.** In `plate-static-plugins.tsx`, next to `BaseToggleV2SummaryPlugin` (~line 592):

```ts
const BaseResourceGridPlugin = createSlatePlugin({
  key: "resource_grid",
  node: { isElement: true },
});
```

Add it to the `staticPlugins` array (~line 601):

```ts
const staticPlugins = [
  // …existing…
  BaseResourceGridPlugin,
];
```

- [ ] **Step 3: The `ResourceGrid` component.** Add near `FileStatic` (~line 384). Import `resolveResourceCell` at the top and `cn` from `@/lib/utils`:

```tsx
import { resolveResourceCell, groupResourceGrids } from "./resource-grid";
import { cn } from "@/lib/utils";

function ResourceGrid({ element }: SlateElementProps) {
  const cells = ((element as Record<string, unknown>).children as Record<string, unknown>[]) ?? [];
  return (
    <ul role="list" className="not-prose my-5 grid list-none grid-cols-2 gap-3 pl-0 lg:grid-cols-3">
      {cells.map((cell, i) => {
        const info = resolveResourceCell(cell);
        if (!info) return null;
        const { name, href, newTab, config } = info;
        const Icon = config.Icon;
        return (
          <li key={i} className="m-0">
            <a
              href={href}
              {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex h-full items-center gap-3 rounded-lg border border-border bg-card p-3 no-underline transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", config.bgClass)}>
                <Icon className={cn("h-5 w-5", config.fgClass)} />
              </span>
              <span className="min-w-0 text-sm font-medium leading-snug text-foreground">{name}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Register the component** in the `staticComponents` map (~line 630) — add `resource_grid: ResourceGrid`. **Do NOT** add it to `staticComponentsAlgolia`; the Algolia path never produces the node.

- [ ] **Step 5: Wire the transform** into `prepareNativeArticle` (~line 859):

```ts
const { value: processed, headings } = addHeadingIds(value);
const grouped = groupResourceGrids(processed);
const withStableIds = addStableNodeIds(grouped);
```

(Leave `createNativeStaticEditor` untouched — that guarantees index-safety.)

- [ ] **Step 6: Run the tests — expect PASS**

Run: `npx vitest run src/lib/plate-static-plugins.test.tsx src/lib/resource-grid.test.ts`
Then typecheck + lint: `npx tsc --noEmit` · `npx eslint src/lib/resource-grid.ts src/lib/plate-static-plugins.tsx`

- [ ] **Step 7: Commit**

```bash
git add src/lib/plate-static-plugins.tsx src/lib/plate-static-plugins.test.tsx
git commit -m "Render resource grids on the read path (index-safe)"
```

---

## Task 4: Editor hint — "displays as a grid · Preview"

**Files:** `src/components/resources/plate-editor.tsx` (or the editor element module). Lowest priority — the grid works without it; this is an authoring cue so editors aren't surprised.

- [ ] **Step 1:** In the editor, run the SAME `groupResourceGrids` detector over the live value (read-only — do not transform the editor content) to find qualifying runs, and render a quiet inline affordance above each run: text "Displays as a grid when published" + a "Preview" link opening `/resources/article/{slug}` in a new tab. Use `text-xs text-muted-foreground`, no border. Gate on `isResourceCell` reusing Task 2's export so the rule is defined once.

- [ ] **Step 2:** Manual check at `localhost` — a run of 4+ files/links shows the hint; authoring stays a flat list; Preview opens the read view showing the grid.

- [ ] **Step 3: Commit**

```bash
git add src/components/resources/plate-editor.tsx
git commit -m "Editor hint: flag runs that publish as a grid"
```

---

## After all tasks — verify + PR + review loop

- [ ] `npm test` · `npm run lint` · `npx tsc --noEmit` — all green.
- [ ] **Visual check at `localhost`** (required by the spec's "confirm at build" note): open a native article with a 4+ resource run and confirm the grid renders 3-up ≥1024px / 2-up below, Style-C chips per type, names extension-stripped, part-filled last row left-aligned, and Cmd+K search still deep-links to headings (index unchanged). Also confirm real `file`-node `name` values aren't ugly slugs (spec build-time confirmation) — if they are, decide extension/slug tidy then.
- [ ] Run `/code-review`, address findings, then `gh pr create --base main --title "Resources §2 — content-aware grid"`.
- [ ] Gemini loop: `/gemini review`, verify + reply to each comment, cap 3 rounds, then wait for explicit merge approval.

## Self-review notes (against the spec)

- **Detector = files + standalone links**, mid-sentence links stay inline — Task 2 (`isResourceCell` + the inline-link test). ✓
- **Direction A / Style C chip, extension stripped, no kind label** — Task 3 component + Task 1 `resolveResourceCell`. ✓
- **Type taxonomy** PDF/file + Doc/Sheet/Slides/Form/Drive + internal/external — Task 1 `resolveResourceType`. ✓
- **Open behaviour** files → proxy new-tab; internal → same-tab; external/Google → new-tab — Task 1 `newTab` + Task 3 `<a>`. ✓
- **Render-only + index-safe** — Task 3 wires only `prepareNativeArticle`; regression test locks the Algolia path. ✓
- **Accessibility parked** — no Sheets/Slides serving or image rehosting here; a raw Google tile opens Google (honest chip, not dressed as intranet-served). ✓
- **Type consistency:** `resolveResourceCell` returns `{ name, href, newTab, config }`; Task 3 destructures exactly those; `ResourceTypeConfig` matches `FileTypeConfig`'s shape so `resolveFileType`'s return slots in. ✓
