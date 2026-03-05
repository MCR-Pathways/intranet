import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNewPostsPoll } from "./use-new-posts-poll";

vi.mock("@/app/(protected)/intranet/actions", () => ({
  getNewPostCount: vi.fn(),
}));

import { getNewPostCount } from "@/app/(protected)/intranet/actions";

const mockGetNewPostCount = getNewPostCount as ReturnType<typeof vi.fn>;

// Use a short interval for fast tests
const SHORT_INTERVAL = 50;

describe("useNewPostsPoll", () => {
  beforeEach(() => {
    mockGetNewPostCount.mockReset();
    mockGetNewPostCount.mockResolvedValue(0);
    // Default: tab is visible
    Object.defineProperty(document, "hidden", {
      writable: true,
      value: false,
    });
  });

  it("returns zero count initially", () => {
    const { result } = renderHook(() =>
      useNewPostsPoll("2026-03-01T00:00:00Z", SHORT_INTERVAL)
    );

    expect(result.current.newCount).toBe(0);
  });

  it("does not poll when latestTimestamp is null", async () => {
    renderHook(() => useNewPostsPoll(null, SHORT_INTERVAL));

    await new Promise((r) => setTimeout(r, 150));

    expect(mockGetNewPostCount).not.toHaveBeenCalled();
  });

  it("polls at the specified interval", async () => {
    mockGetNewPostCount.mockResolvedValue(3);

    const { result } = renderHook(() =>
      useNewPostsPoll("2026-03-01T00:00:00Z", SHORT_INTERVAL)
    );

    await waitFor(
      () => {
        expect(result.current.newCount).toBe(3);
      },
      { timeout: 2000 }
    );

    expect(mockGetNewPostCount).toHaveBeenCalledWith("2026-03-01T00:00:00Z");
  });

  it("polls multiple times at interval", async () => {
    mockGetNewPostCount.mockResolvedValue(1);

    renderHook(() => useNewPostsPoll("2026-03-01T00:00:00Z", SHORT_INTERVAL));

    // Wait for several intervals
    await waitFor(
      () => {
        expect(mockGetNewPostCount.mock.calls.length).toBeGreaterThanOrEqual(3);
      },
      { timeout: 2000 }
    );
  });

  it("dismiss resets count to zero", async () => {
    mockGetNewPostCount.mockResolvedValue(5);

    const { result } = renderHook(() =>
      useNewPostsPoll("2026-03-01T00:00:00Z", SHORT_INTERVAL)
    );

    await waitFor(
      () => {
        expect(result.current.newCount).toBe(5);
      },
      { timeout: 2000 }
    );

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.newCount).toBe(0);
  });

  it("pauses polling when tab is hidden", async () => {
    mockGetNewPostCount.mockResolvedValue(1);

    renderHook(() => useNewPostsPoll("2026-03-01T00:00:00Z", SHORT_INTERVAL));

    // Let at least one poll fire
    await waitFor(
      () => {
        expect(mockGetNewPostCount).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    // Hide the tab
    Object.defineProperty(document, "hidden", { value: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    const countAfterHide = mockGetNewPostCount.mock.calls.length;

    // Wait a bit — should not poll
    await new Promise((r) => setTimeout(r, 200));

    expect(mockGetNewPostCount.mock.calls.length).toBe(countAfterHide);
  });

  it("resumes polling when tab becomes visible", async () => {
    mockGetNewPostCount.mockResolvedValue(2);

    renderHook(() => useNewPostsPoll("2026-03-01T00:00:00Z", SHORT_INTERVAL));

    // Hide tab
    Object.defineProperty(document, "hidden", { value: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    const countAfterHide = mockGetNewPostCount.mock.calls.length;

    // Show tab — should fire an immediate poll
    Object.defineProperty(document, "hidden", { value: false });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(
      () => {
        expect(mockGetNewPostCount.mock.calls.length).toBeGreaterThan(
          countAfterHide
        );
      },
      { timeout: 2000 }
    );
  });

  it("silently ignores polling errors", async () => {
    mockGetNewPostCount.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useNewPostsPoll("2026-03-01T00:00:00Z", SHORT_INTERVAL)
    );

    // Wait for at least one poll cycle
    await new Promise((r) => setTimeout(r, 150));

    // Should not throw and count stays at 0
    expect(result.current.newCount).toBe(0);
  });

  it("uses updated timestamp ref for subsequent polls", async () => {
    mockGetNewPostCount.mockResolvedValue(1);

    const { rerender } = renderHook(
      ({ ts }) => useNewPostsPoll(ts, SHORT_INTERVAL),
      { initialProps: { ts: "2026-03-01T00:00:00Z" } }
    );

    await waitFor(
      () => {
        expect(mockGetNewPostCount).toHaveBeenCalledWith(
          "2026-03-01T00:00:00Z"
        );
      },
      { timeout: 2000 }
    );

    // Update timestamp
    rerender({ ts: "2026-03-01T12:00:00Z" });

    await waitFor(
      () => {
        expect(mockGetNewPostCount).toHaveBeenCalledWith(
          "2026-03-01T12:00:00Z"
        );
      },
      { timeout: 2000 }
    );
  });
});
