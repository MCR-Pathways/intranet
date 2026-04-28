"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Provides drag-and-drop file handling for a dialog body. The drag-zone
 * has to cover the whole dialog (not just the AttachmentEditor) so users
 * can drop a file anywhere inside the composer — dropping outside the
 * zone falls back to the browser's default which navigates away from the
 * page.
 *
 * Usage in a Dialog: spread `dropHandlers` on the DialogContent (or any
 * outermost child), and render the overlay near the top of the body.
 */
export function useDialogDropZone(onFiles: (files: FileList) => void) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounterRef.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;
      const files = e.dataTransfer.files;
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  return {
    isDragging,
    dropHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
}
