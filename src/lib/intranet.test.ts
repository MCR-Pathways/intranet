import { describe, it, expect } from "vitest";
import {
  validateFile,
  isImageType,
  ATTACHMENT_MAX_SIZE_BYTES,
} from "@/lib/intranet";

// =============================================
// validateFile
// =============================================

describe("validateFile", () => {
  const createFile = (name: string, size: number, type: string): File => {
    const file = new File(["x"], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
  };

  it("returns null for a valid JPEG image", () => {
    expect(validateFile(createFile("photo.jpg", 1024, "image/jpeg"))).toBeNull();
  });

  it("returns null for a valid PNG image", () => {
    expect(validateFile(createFile("photo.png", 1024, "image/png"))).toBeNull();
  });

  it("returns null for a valid GIF image", () => {
    expect(validateFile(createFile("anim.gif", 1024, "image/gif"))).toBeNull();
  });

  it("returns null for a valid WebP image", () => {
    expect(validateFile(createFile("photo.webp", 1024, "image/webp"))).toBeNull();
  });

  it("returns null for a valid PDF document", () => {
    expect(validateFile(createFile("doc.pdf", 1024, "application/pdf"))).toBeNull();
  });

  it("returns null for a valid DOCX document", () => {
    expect(validateFile(createFile("doc.docx", 1024, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toBeNull();
  });

  it("returns null for a valid DOC document", () => {
    expect(validateFile(createFile("doc.doc", 1024, "application/msword"))).toBeNull();
  });

  it("returns error for file exceeding 50MB", () => {
    const result = validateFile(createFile("big.jpg", ATTACHMENT_MAX_SIZE_BYTES + 1, "image/jpeg"));
    expect(result).toContain("too large");
  });

  it("includes filename in error message", () => {
    const result = validateFile(createFile("huge-video.mp4", ATTACHMENT_MAX_SIZE_BYTES + 1, "video/mp4"));
    expect(result).toContain("huge-video.mp4");
  });

  it("returns error for unsupported type", () => {
    const result = validateFile(createFile("script.js", 1024, "application/javascript"));
    expect(result).toContain("unsupported file type");
  });

  it("returns error for executable", () => {
    const result = validateFile(createFile("virus.exe", 1024, "application/x-executable"));
    expect(result).toContain("unsupported file type");
  });

  it("returns size error before type error (size checked first)", () => {
    const result = validateFile(createFile("big-bad.exe", ATTACHMENT_MAX_SIZE_BYTES + 1, "application/x-executable"));
    expect(result).toContain("too large");
  });
});

// =============================================
// isImageType
// =============================================

describe("isImageType", () => {
  it("returns true for image/jpeg", () => {
    expect(isImageType("image/jpeg")).toBe(true);
  });

  it("returns true for image/png", () => {
    expect(isImageType("image/png")).toBe(true);
  });

  it("returns true for image/gif", () => {
    expect(isImageType("image/gif")).toBe(true);
  });

  it("returns true for image/webp", () => {
    expect(isImageType("image/webp")).toBe(true);
  });

  it("returns false for application/pdf", () => {
    expect(isImageType("application/pdf")).toBe(false);
  });

  it("returns false for application/msword", () => {
    expect(isImageType("application/msword")).toBe(false);
  });

  it("returns false for unknown type", () => {
    expect(isImageType("text/plain")).toBe(false);
  });
});
