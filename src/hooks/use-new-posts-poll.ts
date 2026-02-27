"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getNewPostCount } from "@/app/(protected)/intranet/actions";

/**
 * Polls for new posts since `latestTimestamp` at the given interval.
 * Pauses when the tab is hidden and fires an immediate poll when it becomes visible.
 */
export function useNewPostsPoll(
  latestTimestamp: string | null,
  intervalMs: number = 30_000
) {
  const [newCount, setNewCount] = useState(0);
  const timestampRef = useRef(latestTimestamp);

  // Keep ref in sync so the interval always uses the latest value
  useEffect(() => {
    timestampRef.current = latestTimestamp;
  }, [latestTimestamp]);

  const poll = useCallback(async () => {
    if (!timestampRef.current) return;
    try {
      const count = await getNewPostCount(timestampRef.current);
      setNewCount(count);
    } catch {
      // Silently ignore polling errors — non-critical background operation
    }
  }, []);

  const dismiss = useCallback(() => {
    setNewCount(0);
  }, []);

  useEffect(() => {
    if (!latestTimestamp) return;

    let timerId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      timerId = setInterval(poll, intervalMs);
    };

    const stop = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Immediate poll when tab becomes visible, then restart interval
        poll();
        stop(); // clear any existing interval before restarting
        start();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [latestTimestamp, intervalMs, poll]);

  return { newCount, dismiss };
}
