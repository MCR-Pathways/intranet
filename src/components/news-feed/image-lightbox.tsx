"use client";

import { useState, useCallback, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { PostAttachment } from "@/types/database.types";

interface ImageLightboxProps {
  images: PostAttachment[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Inner content that remounts each time the lightbox opens (via key prop) */
function LightboxContent({
  images,
  initialIndex,
  onClose,
}: {
  images: PostAttachment[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  return (
    <>
      <VisuallyHidden.Root>
        <DialogPrimitive.Title>
          Image {currentIndex + 1} of {images.length}
        </DialogPrimitive.Title>
      </VisuallyHidden.Root>

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/10 p-2.5 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={goPrev}
          aria-label="Previous image"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full border border-white/20 bg-white/10 p-2.5 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded dynamic image URLs */}
      <img
        src={currentImage.file_url || undefined}
        alt={currentImage.file_name || "Image"}
        className="max-h-[90vh] max-w-[90vw] object-contain select-none"
        {...(currentImage.image_width && currentImage.image_height
          ? { width: currentImage.image_width, height: currentImage.image_height }
          : {})}
      />

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={goNext}
          aria-label="Next image"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full border border-white/20 bg-white/10 p-2.5 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Image counter */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white shadow-lg backdrop-blur-md">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </>
  );
}

export function ImageLightbox({
  images,
  initialIndex,
  open,
  onOpenChange,
}: ImageLightboxProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center focus:outline-none"
          aria-describedby={undefined}
          // Click on the backdrop (empty space around the image) closes the
          // lightbox. Children (image, buttons) don't trigger this because
          // the click target is the child, not the Content itself.
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          {/* Key forces remount on each open, so initialIndex is always fresh */}
          <LightboxContent
            key={`${initialIndex}-${open}`}
            images={images}
            initialIndex={initialIndex}
            onClose={() => onOpenChange(false)}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
