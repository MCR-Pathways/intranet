"use client";

import { useState, useMemo, useTransition } from "react";
import {
  createLesson,
  updateLesson,
  uploadCourseVideo,
} from "@/app/(protected)/learning/admin/courses/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { LessonImageManager } from "./lesson-image-manager";
import { LessonTiptapEditor } from "./lesson-tiptap-editor";
import { extractPlainText, plainTextToTiptapDoc } from "@/lib/tiptap";
import { useAutoSave } from "@/hooks/use-auto-save";
import { autoSaveLessonContent } from "@/app/(protected)/learning/admin/courses/actions";
import type { TiptapDocument } from "@/lib/tiptap";
import type { CourseLesson, LessonType, LessonImage } from "@/types/database.types";

interface LessonEditDialogProps {
  courseId: string;
  sectionId?: string;
  lesson?: CourseLesson;
  lessonImages?: LessonImage[];
  sortOrder?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LessonEditDialog({
  courseId,
  sectionId,
  lesson,
  lessonImages = [],
  sortOrder = 0,
  open,
  onOpenChange,
}: LessonEditDialogProps) {
  const isEditing = !!lesson;
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(lesson?.title ?? "");
  const [lessonType, setLessonType] = useState<LessonType>(
    lesson?.lesson_type ?? "text"
  );
  const [content, setContent] = useState(lesson?.content ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson?.video_url ?? "");
  const [videoStoragePath, setVideoStoragePath] = useState(
    lesson?.video_storage_path ?? ""
  );
  const [slidesUrl, setSlidesUrl] = useState(lesson?.slides_url ?? "");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Rich text content (Tiptap JSON)
  const [contentJson, setContentJson] = useState<TiptapDocument | null>(() => {
    if (lesson?.content_json && typeof lesson.content_json === "object") {
      return lesson.content_json as unknown as TiptapDocument;
    }
    // Convert existing plain text to Tiptap JSON when switching to rich_text
    if (lesson?.content) {
      return plainTextToTiptapDoc(lesson.content);
    }
    return null;
  });

  // Auto-save for existing rich_text lessons
  const autoSaveData = useMemo(
    () =>
      contentJson
        ? {
            content_json: contentJson as unknown as Record<string, unknown>,
            content: extractPlainText(contentJson),
          }
        : null,
    [contentJson]
  );

  const { status: autoSaveStatus } = useAutoSave({
    data: autoSaveData,
    onSave: async (data) => {
      if (!data || !lesson) return { success: false };
      return autoSaveLessonContent(lesson.id, courseId, data);
    },
    delay: 2000,
    enabled: isEditing && lessonType === "rich_text" && !!contentJson,
  });

  const resetForm = () => {
    if (!isEditing) {
      setTitle("");
      setLessonType("text");
      setContent("");
      setVideoUrl("");
      setVideoStoragePath("");
      setSlidesUrl("");
      setUploadedFileName(null);
    }
    setError(null);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", courseId);

    const result = await uploadCourseVideo(formData);

    if (result.success && result.storagePath) {
      setVideoStoragePath(result.storagePath);
      setUploadedFileName(file.name);
      // Clear external URL if uploading a file
      setVideoUrl("");
    } else {
      setError(result.error ?? "Failed to upload video");
    }
    setIsUploading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation: prevent empty content
    if (lessonType === "text" && !content.trim()) {
      setError("Text content is required");
      return;
    }
    if (lessonType === "video" && !videoUrl && !videoStoragePath) {
      setError("A video URL or uploaded video is required");
      return;
    }
    if (lessonType === "slides") {
      const trimmedSlidesUrl = slidesUrl.trim();
      if (!trimmedSlidesUrl) {
        setError("A slides URL is required (e.g. Google Slides embed link)");
        return;
      }
      if (!trimmedSlidesUrl.startsWith("https://docs.google.com/presentation/")) {
        setError("Please provide a valid Google Slides URL (must start with https://docs.google.com/presentation/)");
        return;
      }
    }

    startTransition(async () => {
      // Build content fields based on lesson type
      const richTextContent =
        lessonType === "rich_text" && contentJson
          ? {
              content_json: contentJson as unknown as Record<string, unknown>,
              content: extractPlainText(contentJson),
            }
          : {};

      if (isEditing) {
        const result = await updateLesson(lesson.id, courseId, {
          title,
          lesson_type: lessonType,
          content:
            lessonType === "text"
              ? content || null
              : lessonType === "rich_text"
                ? (richTextContent.content ?? lesson.content)
                : lesson.content,
          ...(lessonType === "rich_text" && richTextContent.content_json
            ? { content_json: richTextContent.content_json }
            : {}),
          video_url: lessonType === "video" ? videoUrl || null : null,
          video_storage_path:
            lessonType === "video" ? videoStoragePath || null : null,
          slides_url: lessonType === "slides" ? slidesUrl || null : null,
        });

        if (result.success) {
          toast.success("Lesson updated");
          onOpenChange(false);
        } else {
          setError(result.error || "Failed to update lesson");
          toast.error(result.error || "Failed to update lesson");
        }
      } else {
        const result = await createLesson({
          course_id: courseId,
          section_id: sectionId!,
          title,
          lesson_type: lessonType,
          content:
            lessonType === "text"
              ? content || null
              : lessonType === "rich_text"
                ? (richTextContent.content ?? null)
                : null,
          ...(lessonType === "rich_text" && richTextContent.content_json
            ? { content_json: richTextContent.content_json }
            : {}),
          video_url: lessonType === "video" ? videoUrl || null : null,
          video_storage_path:
            lessonType === "video" ? videoStoragePath || null : null,
          slides_url: lessonType === "slides" ? slidesUrl || null : null,
          sort_order: sortOrder,
        });

        if (result.success) {
          toast.success("Lesson created");
          resetForm();
          onOpenChange(false);
        } else {
          setError(result.error || "Failed to create lesson");
          toast.error(result.error || "Failed to create lesson");
        }
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className={lessonType === "rich_text" ? "sm:max-w-[900px]" : "sm:max-w-[600px]"}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Content" : "Add Content"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this content item."
              : "Add new content to this course."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Lesson type selector */}
            <div className="grid gap-2">
              <Label>Content Type</Label>
              <Select
                value={lessonType}
                onValueChange={(val) => setLessonType(val as LessonType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="slides">Slides (Google Slides)</SelectItem>
                  <SelectItem value="rich_text">Rich Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="lesson_title">Title</Label>
              <Input
                id="lesson_title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Introduction to Data Protection"
                required
              />
            </div>

            {/* Text content (for text lessons) */}
            {lessonType === "text" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="lesson_content">Content</Label>
                  <textarea
                    id="lesson_content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write lesson content..."
                    className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
                    rows={10}
                  />
                </div>

                {/* Image gallery — only shown when editing an existing text lesson */}
                {isEditing && (
                  <LessonImageManager
                    lessonId={lesson.id}
                    courseId={courseId}
                    images={lessonImages}
                  />
                )}
              </>
            )}

            {/* Video fields (for video lessons) */}
            {lessonType === "video" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="lesson_video_url">
                    External Video URL (YouTube, Vimeo)
                  </Label>
                  <Input
                    id="lesson_video_url"
                    type="url"
                    value={videoUrl}
                    onChange={(e) => {
                      setVideoUrl(e.target.value);
                      // Clear storage path if entering an external URL
                      if (e.target.value) {
                        setVideoStoragePath("");
                        setUploadedFileName(null);
                      }
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    disabled={!!videoStoragePath}
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or upload a video
                    </span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Upload Video File (max 50MB)</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploading}
                      onClick={() =>
                        document.getElementById("video-upload-input")?.click()
                      }
                    >
                      {isUploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {isUploading ? "Uploading..." : "Choose File"}
                    </Button>
                    <input
                      id="video-upload-input"
                      type="file"
                      accept="video/mp4,video/webm,video/ogg,video/quicktime"
                      className="hidden"
                      onChange={handleVideoUpload}
                    />
                    {(uploadedFileName || videoStoragePath) && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="truncate">
                          {uploadedFileName ?? "Video uploaded"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Slides URL (for slides lessons) */}
            {lessonType === "slides" && (
              <div className="grid gap-2">
                <Label htmlFor="lesson_slides_url">
                  Google Slides Embed URL
                </Label>
                <Input
                  id="lesson_slides_url"
                  type="url"
                  value={slidesUrl}
                  onChange={(e) => setSlidesUrl(e.target.value)}
                  placeholder="https://docs.google.com/presentation/d/.../embed"
                />
                <p className="text-xs text-muted-foreground">
                  In Google Slides: File → Share → Publish to web → Embed tab → Copy the URL
                </p>
              </div>
            )}

            {/* Rich text editor (Tiptap) */}
            {lessonType === "rich_text" && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Content</Label>
                  {isEditing && autoSaveStatus !== "idle" && (
                    <span className="text-xs text-muted-foreground">
                      {autoSaveStatus === "saving" && "Saving..."}
                      {autoSaveStatus === "saved" && "Saved"}
                      {autoSaveStatus === "error" && (
                        <span className="text-destructive">Save failed</span>
                      )}
                    </span>
                  )}
                </div>
                <LessonTiptapEditor
                  initialContent={contentJson}
                  onChange={setContentJson}
                  placeholder="Start writing your lesson content..."
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || isUploading}>
              {isPending
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Add Content"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
