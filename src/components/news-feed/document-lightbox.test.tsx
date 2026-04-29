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
    expect(iframe.src).toContain("/api/drive-file/abc123");
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

  it("shows page count for PDFs", () => {
    render(
      <DocumentLightbox doc={makeDoc()} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText("12 pages")).toBeInTheDocument();
  });

  it("uses singular 'page' when page_count is 1", () => {
    render(
      <DocumentLightbox
        doc={makeDoc({ page_count: 1 })}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByText("1 page")).toBeInTheDocument();
  });

  it("hides page count when page_count is null", () => {
    render(
      <DocumentLightbox
        doc={makeDoc({ page_count: null })}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.queryByText(/page/i)).not.toBeInTheDocument();
  });

  it("Open-in-new-tab anchor goes to the proxy URL for PDFs", () => {
    render(
      <DocumentLightbox doc={makeDoc()} open={true} onOpenChange={() => {}} />,
    );
    const link = screen.getByLabelText("Open in new tab") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/drive-file/abc123");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("Open-in-new-tab anchor goes to Drive's /view URL for non-PDFs", () => {
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

  it("Download anchor uses the proxy URL with download attribute", () => {
    render(
      <DocumentLightbox doc={makeDoc()} open={true} onOpenChange={() => {}} />,
    );
    const link = screen.getByLabelText(
      "Download policy.pdf",
    ) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/drive-file/abc123");
    expect(link.getAttribute("download")).toBe("policy.pdf");
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
});
