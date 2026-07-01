import { describe, it, expect } from "vitest";
import { resolveResourceType, resolveResourceCell, isResourceCell, groupResourceGrids, hasResourceGridRun, flagAutoGridCards } from "./resource-grid";

const fileNode = (name: string, url = "/api/drive-file/abc") => ({
  type: "file",
  name,
  url,
  children: [{ text: "" }],
});
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

  it("proxied Drive files classify as documents (not page links)", () => {
    expect(resolveResourceType(linkPara("/api/drive-file/abc123").children[1]).key).toBe("document");
  });

  it("a foreign URL merely containing the proxy path is external, not a document", () => {
    expect(resolveResourceType(linkPara("https://example.com/x?f=/api/drive-file/abc").children[1]).key).toBe("external");
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

  it("proxied-document link: document type, opens in a new tab", () => {
    const c = resolveResourceCell(linkPara("/api/drive-file/abc123", "Session plan"))!;
    expect(c.config.key).toBe("document");
    expect(c.newTab).toBe(true);
  });

  it("a link with whitespace-only text falls back to the URL as the name", () => {
    const c = resolveResourceCell(linkPara("/resources/article/x", "   "))!;
    expect(c.name).toBe("/resources/article/x");
  });

  it("returns null for a non-cell node", () => {
    expect(resolveResourceCell({ type: "p", children: [{ text: "just prose" }] })).toBeNull();
  });
});

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
  it("a paragraph with another inline element beside a link is not a standalone cell", () => {
    const mixed = { type: "p", children: [{ type: "inline_code", children: [{ text: "x" }] }, { type: "a", url: "/x", children: [{ text: "here" }] }] };
    expect(isResourceCell(mixed)).toBe(false);
  });
});

describe("groupResourceGrids", () => {
  it("wraps a run of 4+ cells, leaves <4 alone", () => {
    const four = groupResourceGrids([F("1"), F("2"), F("3"), F("4")] as never);
    expect(four).toHaveLength(1);
    expect(four[0].type).toBe("resource_grid");
    expect(four[0].children as unknown[]).toHaveLength(4);

    const three = groupResourceGrids([F("1"), F("2"), F("3")] as never);
    expect(three.every((n) => n.type === "file")).toBe(true);
  });
  it("a heading breaks a run; files + standalone links mix in one grid", () => {
    const out = groupResourceGrids([F("1"), L("/2"), F("3"), L("/4"), H, F("5")] as never);
    expect(out[0].type).toBe("resource_grid");
    expect(out[0].children as unknown[]).toHaveLength(4);
    expect(out[1]).toBe(H);
    expect(out[2].type).toBe("file");
  });
  it("does not mutate the input", () => {
    const input = [F("1"), F("2"), F("3"), F("4")];
    const copy = JSON.parse(JSON.stringify(input));
    groupResourceGrids(input as never);
    expect(input).toEqual(copy);
  });
});

describe("hasResourceGridRun", () => {
  it("true when a 4+ run exists, false otherwise", () => {
    expect(hasResourceGridRun([F("1"), F("2"), F("3"), F("4")] as never)).toBe(true);
    expect(hasResourceGridRun([F("1"), F("2"), F("3")] as never)).toBe(false);
    expect(hasResourceGridRun([P, H] as never)).toBe(false);
  });
});

// A standalone-link paragraph whose inner link is flagged as a card (§2.1).
const LC = (u: string) => ({ type: "p", children: [{ text: "" }, { type: "a", url: u, displayAsCard: true, children: [{ text: u }] }] });

describe("displayAsCard (§2.1)", () => {
  it("a single flagged link becomes a grid of one, below the 4+ threshold", () => {
    const out = groupResourceGrids([P, LC("/one"), P] as never);
    expect(out[1].type).toBe("resource_grid");
    expect((out[1].children as unknown[]).length).toBe(1);
  });

  it("adjacent flagged links group into one grid; an unflagged sub-run link stays inline", () => {
    const out = groupResourceGrids([LC("/a"), LC("/b"), L("/c")] as never);
    expect(out[0].type).toBe("resource_grid");
    expect((out[0].children as unknown[]).length).toBe(2);
    expect(out[1].type).toBe("p");
  });

  it("a 4+ run still grids regardless of flags (auto unchanged)", () => {
    const four = groupResourceGrids([L("/1"), L("/2"), L("/3"), L("/4")] as never);
    expect(four).toHaveLength(1);
    expect(four[0].type).toBe("resource_grid");
  });

  it("hasResourceGridRun is true for a single flagged link, false for an unflagged lone link", () => {
    expect(hasResourceGridRun([P, LC("/one")] as never)).toBe(true);
    expect(hasResourceGridRun([P, L("/one")] as never)).toBe(false);
  });
});

// Recursively drop `displayAsCard` so two trees can be compared for structure
// alone. The migration adds the flag, so an un-stripped deep-equal would differ
// by exactly that flag, which is the point.
const stripFlag = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stripFlag)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>)
            .filter(([k]) => k !== "displayAsCard")
            .map(([k, val]) => [k, stripFlag(val)]),
        )
      : v;

describe("flagAutoGridCards (§2.1b)", () => {
  it("flags every standalone link in a 4+ run", () => {
    const { value, flaggedCount } = flagAutoGridCards([L("/1"), L("/2"), L("/3"), L("/4")] as never);
    expect(flaggedCount).toBe(4);
    expect(value.every((n) => (n.children as { displayAsCard?: boolean }[])[1].displayAsCard === true)).toBe(true);
  });

  it("does not flag a run below 4 (the invariant); value is unchanged", () => {
    const input = [L("/1"), L("/2"), L("/3")];
    const { value, flaggedCount } = flagAutoGridCards(input as never);
    expect(flaggedCount).toBe(0);
    expect(value).toEqual(input);
  });

  it("flags the links but leaves a file void in the run untouched", () => {
    const { value, flaggedCount } = flagAutoGridCards([F("a"), L("/2"), L("/3"), L("/4")] as never);
    expect(flaggedCount).toBe(3);
    expect(value[0]).toEqual(F("a")); // file node unchanged
    expect((value[1].children as { displayAsCard?: boolean }[])[1].displayAsCard).toBe(true);
  });

  it("is idempotent: an already-flagged link stays flagged and is not re-counted", () => {
    const first = flagAutoGridCards([L("/1"), L("/2"), L("/3"), LC("/4")] as never);
    expect(first.flaggedCount).toBe(3); // /4 already flagged
    const second = flagAutoGridCards(first.value);
    expect(second.flaggedCount).toBe(0);
    expect(stripFlag(second.value)).toEqual(stripFlag(first.value));
  });

  it("leaves a lone link outside any 4+ run untouched", () => {
    const input = [P, L("/one"), P];
    const { value, flaggedCount } = flagAutoGridCards(input as never);
    expect(flaggedCount).toBe(0);
    expect(value).toEqual(input);
  });

  it("handles two runs split by a heading independently", () => {
    const { value, flaggedCount } = flagAutoGridCards(
      [L("/1"), L("/2"), L("/3"), L("/4"), H, L("/5"), L("/6"), L("/7")] as never,
    );
    expect(flaggedCount).toBe(4); // first run of 4 flagged; second run of 3 not
    expect((value[0].children as { displayAsCard?: boolean }[])[1].displayAsCard).toBe(true);
    expect(value[4]).toBe(H);
    expect((value[5].children as { displayAsCard?: boolean }[])[1].displayAsCard).toBeUndefined();
  });

  it("does not change the grid structure: strip the flag and grouping is identical", () => {
    const input = [P, L("/1"), L("/2"), L("/3"), L("/4"), H, F("x")];
    const before = groupResourceGrids(input as never);
    const after = groupResourceGrids(flagAutoGridCards(input as never).value);
    expect(stripFlag(after)).toEqual(stripFlag(before));
  });

  it("does not mutate the input", () => {
    const input = [L("/1"), L("/2"), L("/3"), L("/4")];
    const copy = JSON.parse(JSON.stringify(input));
    flagAutoGridCards(input as never);
    expect(input).toEqual(copy);
  });
});
