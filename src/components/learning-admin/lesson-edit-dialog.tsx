"use client";

import { useState, useTransition } from "react";
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
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { CourseLesson, LessonType } from "@/types/database.types";

interface LessonEditDialogProps {
  courseId: string;
  lesson?: CourseLesson;
  sortOrder?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LessonEditDialog({
  courseId,
  lesson,
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
  const [passingScore, setPassingScore] = useState(
    lesson?.passing_score ?? 80
  );
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const resetForm = () => {
    if (!isEditing) {
      setTitle("");
      setLessonType("text");
      setContent("");
      setVideoUrl("");
      setVideoStoragePath("");
      setPassingScore(80);
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

    startTransition(async () => {
      if (isEditing) {
        const result = await updateLesson(lesson.id, courseId, {
          title,
          lesson_type: lessonType,
          content: lessonType === "text" ? content || null : lesson.content,
          video_url: lessonType === "video" ? videoUrl || null : null,
          video_storage_path:
            lessonType === "video" ? videoStoragePath || null : null,
          passing_score: lessonType === "quiz" ? passingScore : null,
        });

        if (result.success) {
          onOpenChange(false);
        } else {
          setError(result.error || "Failed to update lesson");
        }
      } else {
        const result = await createLesson({
          course_id: courseId,
          title,
          lesson_type: lessonType,
          content: lessonType === "text" ? content || null : null,
          video_url: lessonType === "video" ? videoUrl || null : null,
          video_storage_path:
            lessonType === "video" ? videoStoragePath || null : null,
          passing_score: lessonType === "quiz" ? passingScore : null,
          sort_order: sortOrder,
        });

        if (result.success) {
          resetForm();
          onOpenChange(false);
        } else {
          setError(result.error || "Failed to create lesson");
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
      <DialogContent className="sm:max-w-[600px]">
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
                  <SelectItem value="quiz">Quiz / Assessment</SelectItem>
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
                placeholder={
                  lessonType === "quiz"
                    ? "e.g. Module 1 Assessment"
                    : "e.g. Introduction to Data Protection"
                }
                required
              />
            </div>

            {/* Text content (for text lessons) */}
            {lessonType === "text" && (
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

            {/* Quiz settings */}
            {lessonType === "quiz" && (
              <div className="grid gap-2">
                <Label htmlFor="passing_score">
                  Passing Score (%)
                  <InfoTooltip text="Learners must achieve this score to pass the quiz and unlock subsequent content" />
                </Label>
                <Input
                  id="passing_score"
                  type="number"
                  min={0}
                  max={100}
                  value={passingScore}
                  onChange={(e) =>
                    setPassingScore(parseInt(e.target.value, 10) || 0)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Learners must achieve this score to pass and proceed.
                  Add questions after creating the lesson.
                </p>
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
