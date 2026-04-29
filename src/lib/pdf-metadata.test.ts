import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn(),
}));

import { getDocumentProxy } from "unpdf";
import { extractPdfPageCount } from "./pdf-metadata";

const mockGetDocumentProxy = vi.mocked(getDocumentProxy);

describe("extractPdfPageCount", () => {
  beforeEach(() => {
    mockGetDocumentProxy.mockReset();
  });

  it("returns the numPages value for a valid PDF", async () => {
    mockGetDocumentProxy.mockResolvedValue({
      numPages: 12,
    } as unknown as Awaited<ReturnType<typeof getDocumentProxy>>);

    const result = await extractPdfPageCount(Buffer.from("fake pdf bytes"));
    expect(result).toBe(12);
  });

  it("returns null when unpdf throws (corrupt or encrypted PDF)", async () => {
    mockGetDocumentProxy.mockRejectedValue(new Error("InvalidPDFException"));

    const result = await extractPdfPageCount(Buffer.from("not a pdf"));
    expect(result).toBeNull();
  });

  it("returns null when numPages is zero (degenerate PDF)", async () => {
    mockGetDocumentProxy.mockResolvedValue({
      numPages: 0,
    } as unknown as Awaited<ReturnType<typeof getDocumentProxy>>);

    const result = await extractPdfPageCount(Buffer.from("fake"));
    expect(result).toBeNull();
  });

  it("returns null when numPages is negative", async () => {
    mockGetDocumentProxy.mockResolvedValue({
      numPages: -1,
    } as unknown as Awaited<ReturnType<typeof getDocumentProxy>>);

    const result = await extractPdfPageCount(Buffer.from("fake"));
    expect(result).toBeNull();
  });
});
