import { describe, it, expect } from "vitest";
import { extractDocId, extractFolderId, unwrapGoogleRedirect } from "./google-doc-url";

// =============================================
// extractDocId
// =============================================

describe("extractDocId", () => {
  it("extracts ID from standard Google Docs URL", () => {
    expect(
      extractDocId(
        "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("extracts ID from Google Docs view URL", () => {
    expect(
      extractDocId(
        "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("extracts ID from Google Docs URL without trailing path", () => {
    expect(
      extractDocId(
        "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("extracts ID from Google Drive file URL", () => {
    expect(
      extractDocId(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("extracts ID from Google Drive open URL", () => {
    expect(
      extractDocId(
        "https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
  });

  it("handles IDs with hyphens and underscores", () => {
    expect(
      extractDocId(
        "https://docs.google.com/document/d/1A-b_C-d_E/edit"
      )
    ).toBe("1A-b_C-d_E");
  });

  it("returns null for non-Google URLs", () => {
    expect(extractDocId("https://example.com/document/123")).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(extractDocId("not-a-url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractDocId("")).toBeNull();
  });

  it("returns null for Google Drive folder URLs (not a doc)", () => {
    expect(
      extractDocId("https://drive.google.com/drive/folders/1AbCdEfGhI")
    ).toBeNull();
  });
});

// =============================================
// extractFolderId
// =============================================

describe("extractFolderId", () => {
  it("extracts ID from standard Drive folder URL", () => {
    expect(
      extractFolderId(
        "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrSt"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrSt");
  });

  it("extracts ID from Drive folder URL with user prefix", () => {
    expect(
      extractFolderId(
        "https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrSt"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrSt");
  });

  it("extracts ID from Drive folder URL with query params", () => {
    expect(
      extractFolderId(
        "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrSt?resourcekey=abc"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrSt");
  });

  it("returns null for Google Docs URL", () => {
    expect(
      extractFolderId(
        "https://docs.google.com/document/d/1AbCdEfGhI/edit"
      )
    ).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(extractFolderId("not-a-url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractFolderId("")).toBeNull();
  });
});

// =============================================
// unwrapGoogleRedirect
// =============================================

describe("unwrapGoogleRedirect", () => {
  it("unwraps a Google redirect URL", () => {
    expect(
      unwrapGoogleRedirect(
        "https://www.google.com/url?q=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2FABC123%2Fedit&sa=D&ust=123"
      )
    ).toBe("https://docs.google.com/document/d/ABC123/edit");
  });

  it("unwraps without www prefix", () => {
    expect(
      unwrapGoogleRedirect(
        "https://google.com/url?q=https%3A%2F%2Fexample.com&sa=D"
      )
    ).toBe("https://example.com");
  });

  it("returns original URL if not a Google redirect", () => {
    expect(
      unwrapGoogleRedirect("https://docs.google.com/document/d/ABC/edit")
    ).toBe("https://docs.google.com/document/d/ABC/edit");
  });

  it("returns original URL for non-Google domains", () => {
    expect(
      unwrapGoogleRedirect("https://example.com/url?q=something")
    ).toBe("https://example.com/url?q=something");
  });

  it("returns original URL if q parameter is missing", () => {
    expect(
      unwrapGoogleRedirect("https://www.google.com/url?sa=D&ust=123")
    ).toBe("https://www.google.com/url?sa=D&ust=123");
  });

  it("returns original URL for invalid input", () => {
    expect(unwrapGoogleRedirect("not-a-url")).toBe("not-a-url");
  });

  it("returns original URL for empty string", () => {
    expect(unwrapGoogleRedirect("")).toBe("");
  });
});
