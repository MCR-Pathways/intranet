import { describe, it, expect } from "vitest";
import { validateMagicBytes, DRIVE_FILE_ID_REGEX } from "./google-drive-upload";

describe("DRIVE_FILE_ID_REGEX", () => {
  it("accepts valid Google Drive file IDs", () => {
    expect(DRIVE_FILE_ID_REGEX.test("1DSAlUhBfOHut5r8zXA5oreRi1GLAZ0Wn")).toBe(true);
    expect(DRIVE_FILE_ID_REGEX.test("abc123_-XYZ")).toBe(true);
  });

  it("rejects invalid characters", () => {
    expect(DRIVE_FILE_ID_REGEX.test("../etc/passwd")).toBe(false);
    expect(DRIVE_FILE_ID_REGEX.test("file id with spaces")).toBe(false);
    expect(DRIVE_FILE_ID_REGEX.test("id;drop table")).toBe(false);
    expect(DRIVE_FILE_ID_REGEX.test("")).toBe(false);
  });
});

describe("validateMagicBytes", () => {
  it("validates PNG files", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(100).fill(0)]);
    expect(validateMagicBytes(png, "image/png")).toBe(true);
  });

  it("validates JPEG files", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(100).fill(0)]);
    expect(validateMagicBytes(jpeg, "image/jpeg")).toBe(true);
  });

  it("validates GIF87a files", () => {
    const gif87a = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, ...Array(100).fill(0)]);
    expect(validateMagicBytes(gif87a, "image/gif")).toBe(true);
  });

  it("validates GIF89a files", () => {
    const gif89a = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...Array(100).fill(0)]);
    expect(validateMagicBytes(gif89a, "image/gif")).toBe(true);
  });

  it("validates WebP files", () => {
    // RIFF at 0-3, then 4 bytes size, then WEBP at 8-11
    const webp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size
      0x57, 0x45, 0x42, 0x50, // WEBP
      ...Array(100).fill(0),
    ]);
    expect(validateMagicBytes(webp, "image/webp")).toBe(true);
  });

  it("validates PDF files", () => {
    const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, ...Array(100).fill(0)]);
    expect(validateMagicBytes(pdf, "application/pdf")).toBe(true);
  });

  it("rejects PNG with wrong magic bytes", () => {
    const notPng = Buffer.from([0x00, 0x00, 0x00, 0x00, ...Array(100).fill(0)]);
    expect(validateMagicBytes(notPng, "image/png")).toBe(false);
  });

  it("rejects JPEG with PNG bytes", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array(100).fill(0)]);
    expect(validateMagicBytes(png, "image/jpeg")).toBe(false);
  });

  it("rejects empty buffer", () => {
    expect(validateMagicBytes(Buffer.alloc(0), "image/png")).toBe(false);
  });

  it("rejects buffer too short for signature", () => {
    expect(validateMagicBytes(Buffer.from([0x89, 0x50]), "image/png")).toBe(false);
  });

  it("passes through unknown MIME types", () => {
    const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]); // ZIP header (docx is a zip)
    expect(validateMagicBytes(docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
  });

  it("rejects WebP with wrong WEBP marker at offset 8", () => {
    const notWebp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00,
      0x41, 0x56, 0x49, 0x20, // AVI instead of WEBP
      ...Array(100).fill(0),
    ]);
    expect(validateMagicBytes(notWebp, "image/webp")).toBe(false);
  });
});
