import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EditorSaveControls } from "./editor-save-controls";

const base = {
  saveStatus: "idle" as const,
  onSave: () => {},
  viewHref: "/resources/article/x",
  isPublished: false,
  onPublishToggle: () => {},
  isPublishPending: false,
};

describe("EditorSaveControls", () => {
  it("renders Save, View article and Publish, and fires onSave on click", () => {
    const onSave = vi.fn();
    render(<EditorSaveControls {...base} onSave={onSave} />);
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("View article")).toBeInTheDocument();
    expect(screen.getByText("Publish")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows the Saved status and an Unpublish button when published", () => {
    render(<EditorSaveControls {...base} saveStatus="saved" isPublished />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Unpublish")).toBeInTheDocument();
  });

  it("disables Save while saving", () => {
    render(<EditorSaveControls {...base} saveStatus="saving" />);
    expect(screen.getByText("Save").closest("button")).toBeDisabled();
  });
});
