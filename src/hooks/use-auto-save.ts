"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

interface UseAutoSaveOptions {
  /** Milliseconds to wait after last change before saving. Default: 5000 (5s). */
  debounceMs?: number;
  /** Async save function. Must return { success: boolean }. */
  onSave: () => Promise<{ success: boolean }>;
  /** Set false to disable auto-save (e.g. during manual save). */
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  status: SaveStatus;
  /** Call on every content/title change to start debounce timer. */
  markDirty: () => void;
  /** Immediately flush any pending save (call before manual publish). */
  flushSave: () => Promise<void>;
  /** Reset to idle state (call after manual save completes). */
  reset: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAutoSave({
  debounceMs = 5000,
  onSave,
  enabled = true,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Refs to avoid stale closures
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const onSaveRef = useRef(onSave);
  const enabledRef = useRef(enabled);

  // Keep refs in sync
  onSaveRef.current = onSave;
  enabledRef.current = enabled;

  // ── Core save logic ──────────────────────────────────────────────────────

  const executeSave = useCallback(async () => {
    if (isSavingRef.current) {
      // Save in progress — queue another save after it completes
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setStatus("saving");

    try {
      const result = await onSaveRef.current();
      if (result.success) {
        setStatus("saved");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      isSavingRef.current = false;

      // If another change came in while we were saving, save again
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        executeSave();
      }
    }
  }, []);

  // ── markDirty — reset debounce timer on each call ────────────────────────

  const markDirty = useCallback(() => {
    if (!enabledRef.current) return;

    setStatus("unsaved");

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Start new debounce timer
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      executeSave();
    }, debounceMs);
  }, [debounceMs, executeSave]);

  // ── flushSave — immediate save, cancel debounce ─────────────────────────

  const flushSave = useCallback(async () => {
    // Cancel any pending debounce timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Only flush if there are unsaved changes
    if (status === "unsaved" || status === "error") {
      await executeSave();
    }
  }, [status, executeSave]);

  // ── reset — return to idle state ─────────────────────────────────────────

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingSaveRef.current = false;
    setStatus("idle");
  }, []);

  // ── beforeunload warning when there are unsaved changes ──────────────────

  useEffect(() => {
    if (status === "unsaved" || status === "error") {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
      };
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    }
  }, [status]);

  // ── Cleanup timer on unmount ─────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { status, markDirty, flushSave, reset };
}
