import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutoLinkPreview } from "./use-auto-link-preview";

// Mock dependencies
vi.mock("@/lib/url", () => ({
  extractUrls: vi.fn(),
}));

vi.mock("@/app/(protected)/intranet/actions", () => ({
  fetchLinkPreview: vi.fn(),
}));

import { extractUrls } from "@/lib/url";
import { fetchLinkPreview } from "@/app/(protected)/intranet/actions";

const mockExtractUrls = extractUrls as ReturnType<typeof vi.fn>;
const mockFetchLinkPreview = fetchLinkPreview as ReturnType<typeof vi.fn>;

describe("useAutoLinkPreview", () => {
  beforeEach(() => {
    mockExtractUrls.mockReturnValue([]);
    mockFetchLinkPreview.mockReset();
    mockFetchLinkPreview.mockResolvedValue({ success: false });
  });

  it("returns null preview initially when no content", () => {
    const { result } = renderHook(() =>
      useAutoLinkPreview({ content: "" })
    );

    expect(result.current.autoLinkPreview).toBeNull();
    expect(result.current.isFetchingPreview).toBe(false);
  });

  it("returns initial preview when URL matches content", () => {
    const initial = { url: "https://example.com", title: "Example" };
    // extractUrls returns the same URL — effect hits "already showing" early return
    mockExtractUrls.mockReturnValue(["https://example.com"]);

    const { result } = renderHook(() =>
      useAutoLinkPreview({
        content: "https://example.com",
        initialPreview: initial,
      })
    );

    expect(result.current.autoLinkPreview).toEqual(initial);
  });

  it("fetches preview after debounce when URL is detected", async () => {
    mockExtractUrls.mockReturnValue(["https://example.com"]);
    mockFetchLinkPreview.mockResolvedValue({
      success: true,
      title: "Example Site",
      description: "A description",
      imageUrl: "https://example.com/image.png",
    });

    const { result } = renderHook(() =>
      useAutoLinkPreview({ content: "Check https://example.com" })
    );

    // Before debounce fires
    expect(result.current.autoLinkPreview).toBeNull();

    // Wait for the 500ms debounce + async fetch to complete
    await waitFor(
      () => {
        expect(result.current.autoLinkPreview).toEqual({
          url: "https://example.com",
          title: "Example Site",
          description: "A description",
          imageUrl: "https://example.com/image.png",
        });
      },
      { timeout: 2000 }
    );

    expect(mockFetchLinkPreview).toHaveBeenCalledWith("https://example.com");
  });

  it("does not fetch when disabled", async () => {
    mockExtractUrls.mockReturnValue(["https://example.com"]);

    renderHook(() =>
      useAutoLinkPreview({ content: "https://example.com", enabled: false })
    );

    // Wait a bit past the debounce time
    await new Promise((r) => setTimeout(r, 700));

    expect(mockFetchLinkPreview).not.toHaveBeenCalled();
  });

  it("clears preview when URL is removed from content", async () => {
    mockExtractUrls.mockReturnValue(["https://example.com"]);
    mockFetchLinkPreview.mockResolvedValue({
      success: true,
      title: "Example",
    });

    const { result, rerender } = renderHook(
      ({ content }) => useAutoLinkPreview({ content }),
      { initialProps: { content: "https://example.com" } }
    );

    // Wait for fetch to complete
    await waitFor(
      () => {
        expect(result.current.autoLinkPreview).not.toBeNull();
      },
      { timeout: 2000 }
    );

    // Remove URL from content
    mockExtractUrls.mockReturnValue([]);
    rerender({ content: "no urls here" });

    await waitFor(() => {
      expect(result.current.autoLinkPreview).toBeNull();
    });
  });

  it("does not re-fetch the same URL", async () => {
    mockExtractUrls.mockReturnValue(["https://example.com"]);
    mockFetchLinkPreview.mockResolvedValue({
      success: true,
      title: "Example",
    });

    const { result, rerender } = renderHook(
      ({ content }) => useAutoLinkPreview({ content }),
      { initialProps: { content: "https://example.com" } }
    );

    await waitFor(
      () => {
        expect(result.current.autoLinkPreview).not.toBeNull();
      },
      { timeout: 2000 }
    );

    expect(mockFetchLinkPreview).toHaveBeenCalledTimes(1);

    // Re-render with same URL extracted
    rerender({ content: "still https://example.com here" });

    // Wait past debounce again
    await new Promise((r) => setTimeout(r, 700));

    // Should not have called again
    expect(mockFetchLinkPreview).toHaveBeenCalledTimes(1);
  });

  it("sets preview to null when fetch fails", async () => {
    mockExtractUrls.mockReturnValue(["https://bad-site.com"]);
    mockFetchLinkPreview.mockResolvedValue({ success: false });

    const { result } = renderHook(() =>
      useAutoLinkPreview({ content: "https://bad-site.com" })
    );

    await waitFor(
      () => {
        expect(mockFetchLinkPreview).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    expect(result.current.autoLinkPreview).toBeNull();
  });

  it("dismissPreview sets dismissed URL and clears preview", async () => {
    mockExtractUrls.mockReturnValue(["https://example.com"]);
    mockFetchLinkPreview.mockResolvedValue({
      success: true,
      title: "Example",
    });

    const { result } = renderHook(() =>
      useAutoLinkPreview({ content: "https://example.com" })
    );

    await waitFor(
      () => {
        expect(result.current.autoLinkPreview).not.toBeNull();
      },
      { timeout: 2000 }
    );

    // Dismiss
    act(() => {
      result.current.dismissPreview();
    });

    expect(result.current.autoLinkPreview).toBeNull();
  });

  it("does not re-fetch dismissed URL", async () => {
    mockExtractUrls.mockReturnValue(["https://example.com"]);
    mockFetchLinkPreview.mockResolvedValue({
      success: true,
      title: "Example",
    });

    const { result, rerender } = renderHook(
      ({ content }) => useAutoLinkPreview({ content }),
      { initialProps: { content: "https://example.com" } }
    );

    await waitFor(
      () => {
        expect(result.current.autoLinkPreview).not.toBeNull();
      },
      { timeout: 2000 }
    );

    // Dismiss
    act(() => {
      result.current.dismissPreview();
    });

    mockFetchLinkPreview.mockClear();

    // Re-render — same URL still extracted
    rerender({ content: "https://example.com again" });

    // Wait past debounce
    await new Promise((r) => setTimeout(r, 700));

    // Should not re-fetch dismissed URL
    expect(mockFetchLinkPreview).not.toHaveBeenCalled();
  });

  it("resetPreview clears all state", async () => {
    mockExtractUrls.mockReturnValue(["https://example.com"]);
    mockFetchLinkPreview.mockResolvedValue({
      success: true,
      title: "Example",
    });

    const { result } = renderHook(() =>
      useAutoLinkPreview({ content: "https://example.com" })
    );

    await waitFor(
      () => {
        expect(result.current.autoLinkPreview).not.toBeNull();
      },
      { timeout: 2000 }
    );

    // Reset
    act(() => {
      result.current.resetPreview();
    });

    expect(result.current.autoLinkPreview).toBeNull();
    expect(result.current.isFetchingPreview).toBe(false);
  });

  it("resetPreview accepts a new initial preview", () => {
    const { result } = renderHook(() =>
      useAutoLinkPreview({ content: "" })
    );

    const newPreview = { url: "https://new.com", title: "New" };

    act(() => {
      result.current.resetPreview(newPreview);
    });

    expect(result.current.autoLinkPreview).toEqual(newPreview);
  });
});
