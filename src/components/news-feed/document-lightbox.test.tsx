import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentLightbox } from "./document-lightbox";
import type { PostAttachment } from "@/types/database.types";

function makeDoc(overrides: Partial<PostAttachment> = {}): PostAttachment {
  return {
    id: "doc-1",
    post_id: "post-1",
    attachment_type: "document",
    file_url: "/api/drive-file/abc123",
    drive_file_id: "abc123",
    file_name: "policy.pdf",
    file_size: 230_000,
    mime_type: "application/pdf",
    image_width: null,
    image_height: null,
    page_count: 12,
    link_url: null,
    link_title: null,
    link_description: null,
    link_image_url: null,
    created_at: "2026-01-01T00:00:00Z",
    sort_order: 0,
    ...overrides,
  };
}

describe("DocumentLightbox", () => {
  it("returns nothing when doc is null", () => {
    const { container } = render(
      <DocumentLightbox doc={null} open={true} onOpenChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the iframe pointing at the proxy URL for PDFs", () => {
    const { container } = render(
      <DocumentLightbox
        doc={makeDoc()}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    const iframe = container.ownerDocument.querySelector(
      "iframe",
    ) as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    // Plain proxy URL — no #toolbar=0 fragment. Chromium's full PDF
    // viewer toolbar is intentionally visible (familiar UX); duplication
    // is avoided by us not adding our own toolbar.
    expect(iframe.src).toBe(
      "http://localhost:3000/api/drive-file/abc123",
    );
    expect(iframe.title).toBe("policy.pdf");
  });

  it("renders the iframe pointing at Drive preview for non-PDFs", () => {
    const { container } = render(
      <DocumentLightbox
        doc={makeDoc({
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          file_name: "memo.docx",
        })}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    const iframe = container.ownerDocument.querySelector(
      "iframe",
    ) as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.src).toBe(
      "https://drive.google.com/file/d/abc123/preview",
    );
    expect(iframe.title).toBe("memo.docx");
  });

  it("Open-in-new-tab floating button goes to the proxy URL for PDFs", () => {
    render(
      <DocumentLightbox doc={makeDoc()} open={true} onOpenChange={() => {}} />,
    );
    const link = screen.getByLabelText("Open in new tab") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/drive-file/abc123");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("Open-in-new-tab floating button goes to Drive's /view URL for non-PDFs", () => {
    render(
      <DocumentLightbox
        doc={makeDoc({
          mime_type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          file_name: "budget.xlsx",
        })}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    const link = screen.getByLabelText("Open in new tab") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(
      "https://drive.google.com/file/d/abc123/view",
    );
  });

  it("Close button calls onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(
      <DocumentLightbox
        doc={makeDoc()}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render its own download/print/page-count chrome (delegates to Chromium / Drive viewers)", () => {
    render(
      <DocumentLightbox doc={makeDoc()} open={true} onOpenChange={() => {}} />,
    );
    // No download anchor or visible page-count text in the lightbox —
    // Chromium's PDF toolbar / Drive's preview header handle those.
    expect(screen.queryByLabelText(/^Download /)).not.toBeInTheDocument();
    expect(screen.queryByText(/12 pages/)).not.toBeInTheDocument();
  });
});
