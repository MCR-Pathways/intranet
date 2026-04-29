import { describe, it, expect } from "vitest";
import { resolveFileType } from "./file-types";

describe("resolveFileType", () => {
  it("resolves PDF by mime", () => {
    const config = resolveFileType("application/pdf", "policy.pdf");
    expect(config.key).toBe("pdf");
    expect(config.label).toBe("PDF");
    expect(config.bgClass).toContain("bg-red-50");
    expect(config.fgClass).toContain("text-red-700");
  });

  it("resolves DOC by mime", () => {
    const config = resolveFileType("application/msword", "memo.doc");
    expect(config.key).toBe("doc");
    expect(config.label).toBe("DOC");
    expect(config.bgClass).toContain("bg-blue-50");
  });

  it("resolves DOCX by mime", () => {
    const config = resolveFileType(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "memo.docx",
    );
    expect(config.key).toBe("doc");
    expect(config.label).toBe("DOCX");
  });

  it("resolves XLSX by mime to sheet config", () => {
    const config = resolveFileType(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "data.xlsx",
    );
    expect(config.key).toBe("sheet");
    expect(config.label).toBe("XLSX");
    expect(config.bgClass).toContain("bg-green-50");
  });

  it("resolves CSV by mime to sheet config", () => {
    const config = resolveFileType("text/csv", "export.csv");
    expect(config.key).toBe("sheet");
    expect(config.label).toBe("CSV");
  });

  it("resolves PPTX by mime to slide config", () => {
    const config = resolveFileType(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "deck.pptx",
    );
    expect(config.key).toBe("slide");
    expect(config.label).toBe("PPTX");
    expect(config.bgClass).toContain("bg-orange-50");
  });

  it("resolves TXT by mime to text config", () => {
    const config = resolveFileType("text/plain", "notes.txt");
    expect(config.key).toBe("text");
    expect(config.label).toBe("TXT");
    expect(config.bgClass).toContain("bg-slate-100");
  });

  it("falls back to extension when mime is missing", () => {
    const config = resolveFileType(null, "report.pdf");
    expect(config.key).toBe("pdf");
    expect(config.label).toBe("PDF");
  });

  it("falls back to extension when mime is generic octet-stream", () => {
    const config = resolveFileType("application/octet-stream", "deck.pptx");
    expect(config.key).toBe("slide");
    expect(config.label).toBe("PPTX");
  });

  it("returns fallback config for unknown mime and unknown extension", () => {
    const config = resolveFileType("application/x-unknown", "weird.xyz");
    expect(config.key).toBe("text");
    expect(config.label).toBe("FILE");
    expect(config.bgClass).toContain("bg-slate-100");
  });

  it("returns fallback config when both mime and filename are null", () => {
    const config = resolveFileType(null, null);
    expect(config.key).toBe("text");
    expect(config.label).toBe("FILE");
  });

  it("is case-insensitive on extension", () => {
    const config = resolveFileType(null, "REPORT.PDF");
    expect(config.key).toBe("pdf");
  });

  it("guards against prototype-pollution lookup keys on mime", () => {
    const config = resolveFileType("__proto__", "file.txt");
    // Should fall through to extension lookup, not return Object.prototype.
    expect(config.key).toBe("text");
  });

  it("guards against prototype-pollution lookup keys on extension", () => {
    const config = resolveFileType(null, "file.__proto__");
    expect(config.key).toBe("text");
    expect(config.label).toBe("FILE");
  });
});
