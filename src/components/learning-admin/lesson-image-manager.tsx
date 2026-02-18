"use client";

import { useState, useTransition } from "react";
import {
  uploadLessonImage,
  deleteLessonImage,
} from "@/app/(protected)/learning/admin/courses/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { Upload, Loader2, Trash2, ImageIcon } from "lucide-react";
import type { LessonImage } from "@/types/database.types";

interface LessonImageManagerProps {
  lessonId: string;
  courseId: string;
  images: LessonImage[];
}

export function LessonImageManager({
  lessonId,
  courseId,
  images,
}: LessonImageManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LessonImage | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lessonId", lessonId);
    formData.append("courseId", courseId);

    const result = await uploadLessonImage(formData);

    if (!result.success) {
      setError(result.error ?? "Failed to upload image");
    }
    setIsUploading(false);

    // Reset the input so the same file can be uploaded again
    e.target.value = "";
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteLessonImage(deleteTarget.id, courseId);
      if (!result.success) {
        setError(result.error ?? "Failed to delete image");
      }
      setDeleteTarget(null);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          Images ({images.length})
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() =>
            document.getElementById(`image-upload-${lessonId}`)?.click()
          }
        >
          {isUploading ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-2 h-3.5 w-3.5" />
          )}
          {isUploading ? "Uploading..." : "Upload Image"}
        </Button>
        <input
          id={`image-upload-${lessonId}`}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-video rounded-md overflow-hidden border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.file_url}
                alt={img.file_name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setDeleteTarget(img)}
                  disabled={isPending}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
              <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1.5 py-0.5 truncate">
                {img.file_name}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.file_name}
              &quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
