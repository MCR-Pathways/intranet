import { describe, it, expect } from "vitest";
import { resolveResourceType, resolveResourceCell } from "./resource-grid";

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
