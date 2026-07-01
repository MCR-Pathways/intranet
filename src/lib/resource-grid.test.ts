import { describe, it, expect } from "vitest";
import { resolveResourceType, resolveResourceCell, isResourceCell, groupResourceGrids, hasResourceGridRun } from "./resource-grid";

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
