"use client";

import { useState, useTransition } from "react";
import {
  createLesson,
  updateLesson,
  uploadCourseVideo,
  uploadLessonImage,
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
import { Upload, Loader2, CheckCircle2, HelpCircle } from "lucide-react";
import { LessonImageManager } from "./lesson-image-manager";
import { QuizEditor } from "./quiz-editor";
import type { CourseLesson, LessonType, LessonImage, QuizQuestionWithOptions } from "@/types/database.types";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { TiptapDocument } from "@/lib/tiptap";

interface LessonEditDialogProps {
  courseId: string;
  sectionId?: string;
  lesson?: CourseLesson;
  lessonImages?: LessonImage[];
  quizQuestions?: QuizQuestionWithOptions[];
  sortOrder?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LessonEditDialog({
  courseId,
  sectionId,
  lesson,
  lessonImages = [],
  quizQuestions = [],
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
  const [contentJson, setContentJson] = useState<TiptapDocument | undefined>(
    lesson?.content_json as TiptapDocument | undefined
  );
  const [slidesUrl, setSlidesUrl] = useState(lesson?.slides_url ?? "");
  
  const [videoUrl, setVideoUrl] = useState(lesson?.video_url ?? "");
  const [videoStoragePath, setVideoStoragePath] = useState(
    lesson?.video_storage_path ?? ""
  );
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const resetForm = () => {
    if (!isEditing) {
      setTitle("");
      setLessonType("text");
      setContent("");
      setContentJson(undefined);
      setSlidesUrl("");
      setVideoUrl("");
      setVideoStoragePath("");
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

    // Client-side validation
    if (lessonType === "text" && !content.trim()) {
      setError("Text content is required");
      return;
    }
    if (lessonType === "rich_text" && !contentJson) {
      setError("Rich text content is required");
      return;
    }
    if (lessonType === "slides" && !slidesUrl) {
      setError("Slides URL is required");
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
          content: lessonType === "text" || lessonType === "rich_text" ? content || null : lesson.content,
          content_json: lessonType === "rich_text" ? contentJson || null : undefined,
          slides_url: lessonType === "slides" ? slidesUrl || null : undefined,
          video_url: lessonType === "video" ? videoUrl || null : null,
          video_storage_path:
            lessonType === "video" ? videoStoragePath || null : null,
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
          section_id: sectionId ?? null,
          title,
          lesson_type: lessonType,
          content: lessonType === "text" || lessonType === "rich_text" ? content || null : null,
          content_json: lessonType === "rich_text" ? contentJson || null : undefined,
          slides_url: lessonType === "slides" ? slidesUrl || null : undefined,
          video_url: lessonType === "video" ? videoUrl || null : null,
          video_storage_path:
            lessonType === "video" ? videoStoragePath || null : null,
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
                  <SelectItem value="text">Plain Text</SelectItem>
                  <SelectItem value="rich_text">Rich Text</SelectItem>
                  <SelectItem value="slides">Slides</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
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

            {/* Rich text content (for rich_text lessons) */}
            {lessonType === "rich_text" && (
              <div className="grid gap-2">
                <Label>Content (Rich Text)</Label>
                <div className="overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <RichTextEditor
                    preset="full"
                    className="min-h-[300px] border-none ring-0 focus-within:ring-0 focus:ring-0"
                    borderless
                    initialContent={contentJson}
                    onChange={(json, text) => {
                      setContentJson(json);
                      setContent(text);
                    }}
                    onImageUpload={async (file) => {
                      const formData = new FormData();
                      formData.append("file", file);
                      formData.append("courseId", courseId);
                      formData.append("lessonId", lesson?.id ?? `draft-${Date.now()}`);
                      const result = await uploadLessonImage(formData);
                      return result.success ? result.image?.file_url ?? null : null;
                    }}
                    placeholder="Write your lesson content..."
                  />
                </div>
              </div>
            )}

            {/* Slides content (for slides lessons) */}
            {lessonType === "slides" && (
              <div className="grid gap-2">
                <Label htmlFor="lesson_slides_url">
                  Slides Presentation URL
                </Label>
                <Input
                  id="lesson_slides_url"
                  type="url"
                  value={slidesUrl}
                  onChange={(e) => setSlidesUrl(e.target.value)}
                  placeholder="e.g. https://docs.google.com/presentation/d/.../embed"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Paste the embed URL for your Google Slides presentation (File &gt; Share &gt; Publish to web &gt; Embed).
                </p>
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

            {/* Quiz fields (for quiz lessons) */}
            {lessonType === "quiz" && (
              <div className="grid gap-2">
                <Label>Quiz Questions</Label>
                {isEditing ? (
                  <div className="p-4 border border-dashed rounded-lg bg-muted/30">
                    <QuizEditor 
                      lessonId={lesson.id} 
                      courseId={courseId} 
                      lessonTitle={title} 
                      questions={quizQuestions} 
                    />
                  </div>
                ) : (
                  <div className="p-6 border border-dashed rounded-lg bg-muted/50 text-center space-y-2">
                    <HelpCircle className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Create the quiz lesson first to start adding questions.
                    </p>
                  </div>
                )}
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
