import { useCallback, useRef, useEffect } from "react";

const MAX_HEIGHT = 400;

/**
 * Auto-resizes a textarea to fit its content up to a maximum height,
 * then switches to scrollable overflow.
 */
export function useAutoResizeTextarea(minHeight: number = 80) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // Reset to min-height to get an accurate scrollHeight measurement
    textarea.style.height = `${minHeight}px`;
    const newHeight = Math.max(minHeight, textarea.scrollHeight);
    textarea.style.height = `${Math.min(newHeight, MAX_HEIGHT)}px`;
    textarea.style.overflowY = newHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [minHeight]);

  // Resize on mount (handles pre-filled content in edit dialogs)
  useEffect(() => {
    resize();
  }, [resize]);

  return { textareaRef, resize };
}
