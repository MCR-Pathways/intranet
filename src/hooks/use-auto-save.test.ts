import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoSave, type SaveStatus } from "./use-auto-save";

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Initial state ──────────────────────────────────────────────────────

  it("starts with idle status", () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAutoSave({ onSave }));

    expect(result.current.status).toBe("idle");
  });

  // ── markDirty ──────────────────────────────────────────────────────────

  it("transitions to unsaved when markDirty is called", () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAutoSave({ onSave }));

    act(() => {
      result.current.markDirty();
    });

    expect(result.current.status).toBe("unsaved");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onSave after debounce period", async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() =>
      useAutoSave({ onSave, debounceMs: 3000 })
    );

    act(() => {
      result.current.markDirty();
    });

    // Not yet called
    expect(onSave).not.toHaveBeenCalled();

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saved");
  });

  it("resets debounce timer on subsequent markDirty calls", async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() =>
      useAutoSave({ onSave, debounceMs: 5000 })
    );

    act(() => {
      result.current.markDirty();
    });

    // Advance 3s (not yet 5s)
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Another change — resets the timer
    act(() => {
      result.current.markDirty();
    });

    // Advance another 3s (total 6s, but only 3s since last markDirty)
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Should NOT have saved yet (5s from last markDirty not elapsed)
    expect(onSave).not.toHaveBeenCalled();

    // Advance remaining 2s
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // ── enabled flag ───────────────────────────────────────────────────────

  it("does nothing when enabled is false", async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() =>
      useAutoSave({ onSave, enabled: false })
    );

    act(() => {
      result.current.markDirty();
    });

    // Status stays idle because markDirty is a no-op
    expect(result.current.status).toBe("idle");

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  // ── Error handling ─────────────────────────────────────────────────────

  it("transitions to error when onSave returns { success: false }", async () => {
    const onSave = vi.fn().mockResolvedValue({ success: false });
    const { result } = renderHook(() =>
      useAutoSave({ onSave, debounceMs: 1000 })
    );

    act(() => {
      result.current.markDirty();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.status).toBe("error");
  });

  it("transitions to error when onSave throws", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() =>
      useAutoSave({ onSave, debounceMs: 1000 })
    );

    act(() => {
      result.current.markDirty();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.status).toBe("error");
  });

  // ── flushSave ──────────────────────────────────────────────────────────

  it("flushSave triggers immediate save and cancels debounce", async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() =>
      useAutoSave({ onSave, debounceMs: 5000 })
    );

    act(() => {
      result.current.markDirty();
    });

    expect(result.current.status).toBe("unsaved");

    await act(async () => {
      await result.current.flushSave();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saved");

    // Original timer should not fire again
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("flushSave waits for in-flight save before returning", async () => {
    let resolveInflight: (value: { success: boolean }) => void;
    const inflightPromise = new Promise<{ success: boolean }>((resolve) => {
      resolveInflight = resolve;
    });

    const onSave = vi.fn().mockReturnValueOnce(inflightPromise);

    const { result } = renderHook(() =>
      useAutoSave({ onSave, debounceMs: 1000 })
    );

    // Trigger auto-save
    act(() => {
      result.current.markDirty();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.status).toBe("saving");

    // Start flushSave — should wait for in-flight save
    let flushed = false;
    const flushPromise = act(async () => {
      await result.current.flushSave();
      flushed = true;
    });

    // Resolve the in-flight save
    await act(async () => {
      resolveInflight!({ success: true });
    });

    await flushPromise;

    expect(flushed).toBe(true);
    expect(result.current.status).toBe("saved");
  });

  it("flushSave does nothing when status is idle", async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAutoSave({ onSave }));

    await act(async () => {
      await result.current.flushSave();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  // ── reset ──────────────────────────────────────────────────────────────

  it("reset returns to idle and cancels pending timers", async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() =>
      useAutoSave({ onSave, debounceMs: 5000 })
    );

    act(() => {
      result.current.markDirty();
    });

    expect(result.current.status).toBe("unsaved");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");

    // Timer should have been cancelled
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  // ── Concurrent save protection ─────────────────────────────────────────

  it("queues save if change occurs during in-flight save", async () => {
    let resolveFirst: (value: { success: boolean }) => void;
    const firstSave = new Promise<{ success: boolean }>((resolve) => {
      resolveFirst = resolve;
    });

    const onSave = vi
      .fn()
      .mockReturnValueOnce(firstSave)
      .mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useAutoSave({ onSave, debounceMs: 1000 })
    );

    // First change → triggers first save after debounce
    act(() => {
      result.current.markDirty();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saving");

    // Second change while first save is in-flight
    act(() => {
      result.current.markDirty();
    });

    // Advance past second debounce — this should queue (not execute yet)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Resolve the first save
    await act(async () => {
      resolveFirst!({ success: true });
    });

    // The queued save should have executed after first completed
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });

  // ── Status transitions ─────────────────────────────────────────────────

  it("follows idle → unsaved → saving → saved flow", async () => {
    const statuses: SaveStatus[] = [];
    const onSave = vi.fn().mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useAutoSave({ onSave, debounceMs: 1000 })
    );

    statuses.push(result.current.status);

    act(() => {
      result.current.markDirty();
    });
    statuses.push(result.current.status);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    statuses.push(result.current.status);

    expect(statuses).toEqual(["idle", "unsaved", "saved"]);
  });

  // ── beforeunload ───────────────────────────────────────────────────────

  it("adds beforeunload listener when unsaved", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const onSave = vi.fn().mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAutoSave({ onSave }));

    act(() => {
      result.current.markDirty();
    });

    expect(addSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function)
    );

    addSpy.mockRestore();
  });

  it("removes beforeunload listener when saved", async () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const onSave = vi.fn().mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useAutoSave({ onSave, debounceMs: 1000 })
    );

    act(() => {
      result.current.markDirty();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.status).toBe("saved");
    expect(removeSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function)
    );

    removeSpy.mockRestore();
  });
});
