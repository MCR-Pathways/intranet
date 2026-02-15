"use client";

import { useState, useTransition } from "react";
import {
  createLesson,
  updateLesson,
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
import type { CourseLesson } from "@/types/database.types";

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
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(lesson?.title ?? "");
  const [content, setContent] = useState(lesson?.content ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson?.video_url ?? "");

  const resetForm = () => {
    if (!isEditing) {
      setTitle("");
      setContent("");
      setVideoUrl("");
    }
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      if (isEditing) {
        const result = await updateLesson(lesson.id, courseId, {
          title,
          content: content || null,
          video_url: videoUrl || null,
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
          content: content || null,
          video_url: videoUrl || null,
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
            {isEditing ? "Edit Lesson" : "Add Lesson"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the lesson content."
              : "Add a new lesson to this course."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
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

            <div className="grid gap-2">
              <Label htmlFor="lesson_content">Content (Markdown)</Label>
              <textarea
                id="lesson_content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write lesson content using Markdown..."
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
                rows={10}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lesson_video_url">Video URL (optional)</Label>
              <Input
                id="lesson_video_url"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/..."
              />
            </div>

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
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Add Lesson"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
