"use client";

import { useState, useTransition } from "react";
import {
  deleteLesson,
  reorderLessons,
} from "@/app/(protected)/learning/admin/courses/actions";
import { LessonEditDialog } from "./lesson-edit-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import type { CourseLesson } from "@/types/database.types";

interface LessonManagerProps {
  courseId: string;
  lessons: CourseLesson[];
}

export function LessonManager({ courseId, lessons }: LessonManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseLesson | null>(null);

  const sortedLessons = [...lessons].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const nextSortOrder =
    sortedLessons.length > 0
      ? sortedLessons[sortedLessons.length - 1].sort_order + 1
      : 0;

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrders = sortedLessons.map((l, i) => ({
      id: l.id,
      sort_order: i === index ? sortedLessons[i - 1].sort_order : i === index - 1 ? sortedLessons[index].sort_order : l.sort_order,
    }));
    startTransition(async () => {
      await reorderLessons(courseId, newOrders);
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === sortedLessons.length - 1) return;
    const newOrders = sortedLessons.map((l, i) => ({
      id: l.id,
      sort_order: i === index ? sortedLessons[i + 1].sort_order : i === index + 1 ? sortedLessons[index].sort_order : l.sort_order,
    }));
    startTransition(async () => {
      await reorderLessons(courseId, newOrders);
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteLesson(deleteTarget.id, courseId);
      setDeleteTarget(null);
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Lessons ({sortedLessons.length})
          </CardTitle>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Lesson
          </Button>
        </CardHeader>
        <CardContent>
          {sortedLessons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No lessons yet. Add lessons to create course content.
            </p>
          ) : (
            <div className="space-y-2">
              {sortedLessons.map((lesson, index) => (
                <div
                  key={lesson.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium text-muted-foreground w-6 text-center">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {lesson.title}
                    </p>
                    {lesson.video_url && (
                      <p className="text-xs text-muted-foreground">
                        Has video
                      </p>
                    )}
                  </div>
                  {!lesson.is_active && (
                    <Badge variant="destructive" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || isPending}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleMoveDown(index)}
                      disabled={
                        index === sortedLessons.length - 1 || isPending
                      }
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setEditingLesson(lesson)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(lesson)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Lesson Dialog */}
      <LessonEditDialog
        courseId={courseId}
        sortOrder={nextSortOrder}
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {/* Edit Lesson Dialog */}
      {editingLesson && (
        <LessonEditDialog
          courseId={courseId}
          lesson={editingLesson}
          open={!!editingLesson}
          onOpenChange={(open) => {
            if (!open) setEditingLesson(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lesson</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.title}&quot;?
              This will also remove all completion records for this lesson. This
              action cannot be undone.
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
              {isPending ? "Deleting..." : "Delete Lesson"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
