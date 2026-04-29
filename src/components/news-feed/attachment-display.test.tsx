import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttachmentDisplay } from "./attachment-display";
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

describe("AttachmentDisplay — documents block", () => {
  it("renders PDF type colour and label in meta line", () => {
    const { container } = render(
      <AttachmentDisplay attachments={[makeDoc()]} />,
    );
    const iconContainer = container.querySelector("button > div");
    expect(iconContainer?.className).toContain("bg-red-50");
    expect(screen.getByText(/PDF · 12 pages · /)).toBeInTheDocument();
  });

  it("renders DOC type colour for DOCX attachments", () => {
    const { container } = render(
      <AttachmentDisplay
        attachments={[
          makeDoc({
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            file_name: "memo.docx",
            page_count: null,
          }),
        ]}
      />,
    );
    const iconContainer = container.querySelector("button > div");
    expect(iconContainer?.className).toContain("bg-blue-50");
    expect(screen.getByText(/DOCX · /)).toBeInTheDocument();
  });

  it("falls back to size-only meta when page_count is null", () => {
    render(
      <AttachmentDisplay
        attachments={[makeDoc({ page_count: null })]}
      />,
    );
    expect(screen.queryByText(/page/i)).not.toBeInTheDocument();
    expect(screen.getByText(/PDF · /)).toBeInTheDocument();
  });

  it("shows singular 'page' for page_count = 1", () => {
    render(<AttachmentDisplay attachments={[makeDoc({ page_count: 1 })]} />);
    expect(screen.getByText(/PDF · 1 page · /)).toBeInTheDocument();
  });

  it("clicking card body opens the document lightbox", () => {
    const { container } = render(
      <AttachmentDisplay attachments={[makeDoc()]} />,
    );
    // The lightbox iframe exists in the DOM only when a doc is selected.
    expect(
      container.ownerDocument.querySelector("iframe"),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /policy\.pdf/ }));

    const iframe = container.ownerDocument.querySelector(
      "iframe",
    ) as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.src).toContain("/api/drive-file/abc123");
  });

  it("download anchor has download attribute and proxy href", () => {
    render(<AttachmentDisplay attachments={[makeDoc()]} />);
    const link = screen.getByLabelText(
      "Download policy.pdf",
    ) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/drive-file/abc123");
    expect(link.getAttribute("download")).toBe("policy.pdf");
  });
});
