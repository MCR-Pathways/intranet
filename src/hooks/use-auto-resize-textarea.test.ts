import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoResizeTextarea } from "./use-auto-resize-textarea";

describe("useAutoResizeTextarea", () => {
  let mockTextarea: HTMLTextAreaElement;

  beforeEach(() => {
    mockTextarea = document.createElement("textarea");
    // jsdom doesn't compute real scrollHeight, so we mock it
    Object.defineProperty(mockTextarea, "scrollHeight", {
      writable: true,
      value: 80,
    });
  });

  it("returns a ref and resize function", () => {
    const { result } = renderHook(() => useAutoResizeTextarea());

    expect(result.current.textareaRef).toBeDefined();
    expect(typeof result.current.resize).toBe("function");
  });

  it("uses default minHeight of 80px", () => {
    const { result } = renderHook(() => useAutoResizeTextarea());

    // Attach textarea to the ref
    Object.defineProperty(result.current.textareaRef, "current", {
      writable: true,
      value: mockTextarea,
    });

    act(() => {
      result.current.resize();
    });

    expect(mockTextarea.style.height).toBe("80px");
  });

  it("uses custom minHeight", () => {
    const { result } = renderHook(() => useAutoResizeTextarea(120));

    Object.defineProperty(result.current.textareaRef, "current", {
      writable: true,
      value: mockTextarea,
    });

    // scrollHeight is 80, but minHeight is 120 — should use minHeight
    act(() => {
      result.current.resize();
    });

    expect(mockTextarea.style.height).toBe("120px");
  });

  it("grows to match scrollHeight when content exceeds minHeight", () => {
    const { result } = renderHook(() => useAutoResizeTextarea(80));

    // Simulate scrollHeight expanding
    Object.defineProperty(mockTextarea, "scrollHeight", {
      writable: true,
      value: 200,
    });

    Object.defineProperty(result.current.textareaRef, "current", {
      writable: true,
      value: mockTextarea,
    });

    act(() => {
      result.current.resize();
    });

    expect(mockTextarea.style.height).toBe("200px");
    expect(mockTextarea.style.overflowY).toBe("hidden");
  });

  it("caps height at MAX_HEIGHT (400px) and enables scroll", () => {
    const { result } = renderHook(() => useAutoResizeTextarea(80));

    Object.defineProperty(mockTextarea, "scrollHeight", {
      writable: true,
      value: 600,
    });

    Object.defineProperty(result.current.textareaRef, "current", {
      writable: true,
      value: mockTextarea,
    });

    act(() => {
      result.current.resize();
    });

    expect(mockTextarea.style.height).toBe("400px");
    expect(mockTextarea.style.overflowY).toBe("auto");
  });

  it("does not throw when ref is null", () => {
    const { result } = renderHook(() => useAutoResizeTextarea());

    expect(() => {
      act(() => {
        result.current.resize();
      });
    }).not.toThrow();
  });
});
