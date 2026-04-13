"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared upload state management for media upload dialogs.
 *
 * Handles file selection, progress simulation, error/retry state,
 * and timer cleanup. Each dialog provides its own upload logic
 * (image needs dimensions, file needs result metadata).
 */
export function useUploadHandler(
  maxSize: number,
  validateFile?: (file: File) => string | null,
) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setUploading(false);
    setProgress(0);
    setError(null);
    setRetried(false);
    if (progressTimer.current) clearInterval(progressTimer.current);
  }, []);

  const startProgress = useCallback(() => {
    setProgress(30);
    let current = 30;
    progressTimer.current = setInterval(() => {
      current = Math.min(current + 4, 85);
      setProgress(current);
    }, 500);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(100);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError(null);
    setRetried(false);

    if (selected.size > maxSize) {
      const limitMB = Math.round(maxSize / (1024 * 1024));
      setError(`File must be under ${limitMB} MB`);
      return;
    }

    if (validateFile) {
      const msg = validateFile(selected);
      if (msg) {
        setError(msg);
        return;
      }
    }

    setFile(selected);
  }, [maxSize, validateFile]);

  return {
    file,
    uploading,
    setUploading,
    progress,
    error,
    setError,
    retried,
    setRetried,
    handleFileChange,
    startProgress,
    stopProgress,
    reset,
  };
}
