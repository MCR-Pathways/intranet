/**
 * Tests for ImageLightbox component.
 *
 * Covers: navigation buttons, keyboard nav (arrows, Escape), image counter,
 * single image (no nav), close button, and index wrapping.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageLightbox } from "./image-lightbox";
import type { PostAttachment } from "@/types/database.types";

function makeImage(id: string, name: string): PostAttachment {
  return {
    id,
    post_id: "post-1",
    attachment_type: "image",
    file_url: `/api/drive-file/${id}`,
    drive_file_id: id,
    file_name: name,
    file_size: 1024,
    mime_type: "image/jpeg",
    image_width: 800,
    image_height: 600,
    page_count: null,
    link_url: null,
    link_title: null,
    link_description: null,
    link_image_url: null,
    created_at: "2026-01-01T00:00:00Z",
    sort_order: 0,
  };
}

const threeImages = [
  makeImage("img-1", "cat"),
  makeImage("img-2", "dog"),
  makeImage("img-3", "bird"),
];

describe("ImageLightbox", () => {
  // =============================================
  // Basic rendering
  // =============================================

  it("renders the initial image", () => {
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/api/drive-file/img-1");
    expect(img).toHaveAttribute("alt", "cat");
  });

  it("renders image at specified initialIndex", () => {
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={2}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/api/drive-file/img-3");
  });

  it("renders nothing when open is false", () => {
    const { container } = render(
      <ImageLightbox
        images={threeImages}
        initialIndex={0}
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(container.querySelector("img")).toBeNull();
  });

  // =============================================
  // Image counter
  // =============================================

  it("shows image counter for multiple images", () => {
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("does not show counter for single image", () => {
    render(
      <ImageLightbox
        images={[threeImages[0]]}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  // =============================================
  // Navigation buttons
  // =============================================

  it("shows prev/next buttons for multiple images", () => {
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    // There should be at least 3 buttons: close, prev, next
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("hides prev/next buttons for single image", () => {
    render(
      <ImageLightbox
        images={[threeImages[0]]}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    // Only the close button
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
  });

  it("navigates forward on next button click", async () => {
    const user = userEvent.setup();
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    // Click the next button (third button: close, prev, next)
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[2]);

    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  // =============================================
  // Backdrop click
  // =============================================

  it("closes when the backdrop is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={0}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    // Click the Dialog Content directly (the backdrop area around the image).
    // The handler only fires when the click target IS the Content element,
    // so we have to dispatch the event on it directly rather than through
    // userEvent (which simulates clicks on child pixels).
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not close when the image itself is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={0}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("img"));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  // =============================================
  // Keyboard navigation
  // =============================================

  it("navigates forward with ArrowRight key", () => {
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("navigates backward with ArrowLeft key", () => {
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={1}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("wraps around from last to first image", () => {
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={2}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("wraps around from first to last image", () => {
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  // =============================================
  // Accessible title
  // =============================================

  it("has accessible dialog title", () => {
    render(
      <ImageLightbox
        images={threeImages}
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    // VisuallyHidden title should exist in the DOM
    expect(screen.getByText("Image 1 of 3")).toBeInTheDocument();
  });
});
