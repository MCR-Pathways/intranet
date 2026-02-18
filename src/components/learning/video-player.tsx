"use client";

import { useState, useTransition, useRef } from "react";
import { completeLesson } from "@/app/(protected)/learning/courses/[id]/actions";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";

interface VideoPlayerProps {
  videoStoragePath: string | null;
  videoUrl: string | null;
  lessonId: string;
  courseId: string;
  isCompleted: boolean;
  /** Public URL for the storage video (pre-computed server-side) */
  storagePublicUrl?: string | null;
  isLastLesson?: boolean;
}

/** Convert YouTube/Vimeo URLs to embeddable URLs */
function getEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }
  } catch {
    return "";
  }

  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
  );
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // Return as-is for direct video URLs (mp4 etc.)
  return url;
}

export function VideoPlayer({
  videoStoragePath,
  videoUrl,
  lessonId,
  courseId,
  isCompleted,
  storagePublicUrl,
  isLastLesson = false,
}: VideoPlayerProps) {
  const [autoCompleted, setAutoCompleted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);

  function handleVideoEnded() {
    if (isCompleted || autoCompleted) return;
    startTransition(async () => {
      const result = await completeLesson(lessonId, courseId);
      if (result.success) {
        setAutoCompleted(true);
      }
    });
  }

  // Determine what to render
  const hasUploadedVideo = !!videoStoragePath && !!storagePublicUrl;
  const hasExternalVideo = !!videoUrl;

  if (!hasUploadedVideo && !hasExternalVideo) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No video content available for this lesson.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video container */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="aspect-video bg-black">
            {hasUploadedVideo ? (
              <video
                ref={videoRef}
                src={storagePublicUrl}
                controls
                className="h-full w-full"
                onEnded={handleVideoEnded}
              />
            ) : hasExternalVideo && getEmbedUrl(videoUrl) ? (
              <iframe
                src={getEmbedUrl(videoUrl)}
                className="h-full w-full"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Auto-completion feedback */}
      {(isCompleted || autoCompleted) && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {isLastLesson
              ? "Video lesson completed \u2014 you\u2019ve finished all lessons!"
              : "Video lesson completed"}
          </span>
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Marking as complete...</span>
        </div>
      )}

      {/* Tip for uploaded videos */}
      {hasUploadedVideo && !isCompleted && !autoCompleted && (
        <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <strong>Tip:</strong> Watch the entire video to automatically mark
          this lesson as complete.
        </div>
      )}
    </div>
  );
}
