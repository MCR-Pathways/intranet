import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFilesList = vi.hoisted(() => vi.fn());
const mockFilesCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/google-drive", () => ({
  getDriveClient: () => ({
    files: { list: mockFilesList, create: mockFilesCreate },
  }),
}));

import {
  validateMagicBytes,
  DRIVE_FILE_ID_REGEX,
  uploadFileToDrive,
  sanitiseFilename,
} from "./google-drive-upload";

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

  it("validates HEIC files (ftyp at offset 4)", () => {
    const heic = Buffer.from([
      0x00, 0x00, 0x00, 0x18, // box size
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x68, 0x65, 0x69, 0x63, // heic
      ...Array(100).fill(0),
    ]);
    expect(validateMagicBytes(heic, "image/heic")).toBe(true);
  });

  it("validates DNG files (TIFF little-endian header)", () => {
    const dng = Buffer.from([0x49, 0x49, 0x2a, 0x00, ...Array(100).fill(0)]);
    expect(validateMagicBytes(dng, "image/x-adobe-dng")).toBe(true);
    expect(validateMagicBytes(dng, "image/dng")).toBe(true);
  });
});

describe("sanitiseFilename", () => {
  it("strips path separators", () => {
    expect(sanitiseFilename("a/b\\c.png")).toBe("a_b_c.png");
  });

  it("collapses whitespace", () => {
    expect(sanitiseFilename("hello   world.png")).toBe("hello world.png");
  });

  it("truncates to 200 chars", () => {
    const long = "a".repeat(300) + ".png";
    expect(sanitiseFilename(long).length).toBe(200);
  });
});

describe("uploadFileToDrive — subfolder resolution", () => {
  const ROOT = "root-folder-id";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_DRIVE_UPLOAD_FOLDER_ID = ROOT;

    let createId = 1000;
    mockFilesList.mockResolvedValue({ data: { files: [] } });
    mockFilesCreate.mockImplementation(async ({ requestBody }) => ({
      data: {
        id:
          requestBody.mimeType === "application/vnd.google-apps.folder"
            ? `folder-${createId++}`
            : "uploaded-file-id",
        mimeType: requestBody.mimeType,
        size: "100",
      },
    }));
  });

  it("uploads directly to root when no subfolder path is given", async () => {
    const result = await uploadFileToDrive(
      Buffer.from("content"),
      "image/jpeg",
      "test.jpg",
    );

    expect(mockFilesList).not.toHaveBeenCalled();
    expect(mockFilesCreate).toHaveBeenCalledTimes(1);
    expect(mockFilesCreate.mock.calls[0][0].requestBody.parents).toEqual([
      ROOT,
    ]);
    expect(result.fileId).toBe("uploaded-file-id");
  });

  it("creates missing subfolders lazily", async () => {
    await uploadFileToDrive(
      Buffer.from("content"),
      "image/jpeg",
      "test.jpg",
      { subfolderPath: ["2050", "01"] }, // unique keys to avoid module-cache pollution
    );

    expect(mockFilesList).toHaveBeenCalledTimes(2);
    expect(mockFilesCreate).toHaveBeenCalledTimes(3);

    const yearCreate = mockFilesCreate.mock.calls[0][0];
    expect(yearCreate.requestBody.name).toBe("2050");
    expect(yearCreate.requestBody.parents).toEqual([ROOT]);

    const monthCreate = mockFilesCreate.mock.calls[1][0];
    expect(monthCreate.requestBody.name).toBe("01");

    const fileCreate = mockFilesCreate.mock.calls[2][0];
    expect(fileCreate.requestBody.name).toBe("test.jpg");
  });

  it("caches resolved subfolders across calls", async () => {
    await uploadFileToDrive(
      Buffer.from("a"),
      "image/jpeg",
      "first.jpg",
      { subfolderPath: ["2051", "02"] },
    );
    const firstListCount = mockFilesList.mock.calls.length;

    await uploadFileToDrive(
      Buffer.from("b"),
      "image/jpeg",
      "second.jpg",
      { subfolderPath: ["2051", "02"] },
    );

    // No new list calls — second upload hit the cache
    expect(mockFilesList.mock.calls.length).toBe(firstListCount);
    // Total folder creates: 2. Total file creates: 2. Combined: 4
    expect(mockFilesCreate).toHaveBeenCalledTimes(4);
  });

  it("uses options.folderId override when provided", async () => {
    const NEWS_ROOT = "news-feed-root";
    await uploadFileToDrive(
      Buffer.from("content"),
      "image/jpeg",
      "test.jpg",
      { folderId: NEWS_ROOT },
    );

    expect(mockFilesCreate.mock.calls[0][0].requestBody.parents).toEqual([
      NEWS_ROOT,
    ]);
  });

  it("reuses an existing subfolder when list returns a hit", async () => {
    mockFilesList.mockResolvedValueOnce({
      data: { files: [{ id: "existing-2099" }] },
    });
    mockFilesList.mockResolvedValueOnce({
      data: { files: [{ id: "existing-12" }] },
    });

    await uploadFileToDrive(
      Buffer.from("content"),
      "image/jpeg",
      "test.jpg",
      { subfolderPath: ["2099", "12"] },
    );

    expect(mockFilesCreate).toHaveBeenCalledTimes(1);
    expect(mockFilesCreate.mock.calls[0][0].requestBody.parents).toEqual([
      "existing-12",
    ]);
  });

  it("throws when no folder is configured and none is provided", async () => {
    delete process.env.GOOGLE_DRIVE_UPLOAD_FOLDER_ID;

    await expect(
      uploadFileToDrive(Buffer.from("a"), "image/jpeg", "x.jpg"),
    ).rejects.toThrow(/No Drive folder configured/);
  });
});
