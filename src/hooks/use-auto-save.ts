import { useRef, useEffect, useState, useCallback } from "react";

type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions<T> {
  /** The data to auto-save */
  data: T;
  /** Callback to save the data. Returns success/error. */
  onSave: (data: T) => Promise<{ success: boolean; error?: string }>;
  /** Debounce delay in milliseconds (default: 2000) */
  delay?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
}

/**
 * Debounced auto-save hook. Saves after `delay` ms of inactivity.
 * Tracks save status for UI indicators ("Saved" / "Saving..." / "Unsaved changes").
 */
export function useAutoSave<T>({
  data,
  onSave,
  delay = 2000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const onSaveRef = useRef(onSave);

  // Keep onSave ref current without triggering effect
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const save = useCallback(
    async (dataToSave: T) => {
      setStatus("saving");
      try {
        const result = await onSaveRef.current(dataToSave);
        if (result.success) {
          setStatus("saved");
          setLastSavedAt(new Date());
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    },
    []
  );

  useEffect(() => {
    // Skip auto-save on first render (initial load)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!enabled) return;

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set new debounce timer
    timerRef.current = setTimeout(() => {
      save(data);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [data, delay, enabled, save]);

  return { status, lastSavedAt };
}
