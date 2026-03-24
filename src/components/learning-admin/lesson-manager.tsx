"use client";

import { useState, useTransition } from "react";
import {
  createLesson,
  deleteLesson,
  reorderLessons,
} from "@/app/(protected)/learning/admin/courses/actions";
import { LessonEditDialog } from "./lesson-edit-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  PlayCircle,
  FileText,
  FileCode2,
  Presentation,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CourseLesson, LessonType, LessonImage } from "@/types/database.types";

const lessonTypeConfig: Record<LessonType, { label: string; icon: typeof FileText; color: string; bgColor: string }> = {
  text: { label: "Text", icon: FileText, color: "text-green-600", bgColor: "bg-green-50" },
  video: { label: "Video", icon: PlayCircle, color: "text-blue-600", bgColor: "bg-blue-50" },
  slides: { label: "Slides", icon: Presentation, color: "text-amber-600", bgColor: "bg-amber-50" },
  rich_text: { label: "Rich Text", icon: FileCode2, color: "text-purple-600", bgColor: "bg-purple-50" },
};

interface LessonManagerProps {
  courseId: string;
  sectionId: string;
  lessons: CourseLesson[];
  lessonImagesMap?: Record<string, LessonImage[]>;
}

export function LessonManager({ courseId, sectionId, lessons, lessonImagesMap = {} }: LessonManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseLesson | null>(null);

  // Inline add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addType, setAddType] = useState<LessonType>("rich_text");
  const [addError, setAddError] = useState<string | null>(null);

  const sortedLessons = [...lessons].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const nextSortOrder =
    sortedLessons.length > 0
      ? sortedLessons[sortedLessons.length - 1].sort_order + 1
      : 0;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // ─── DnD reorder ──────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedLessons.findIndex((l) => l.id === active.id);
    const newIndex = sortedLessons.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...sortedLessons];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    startTransition(async () => {
      await reorderLessons(
        courseId,
        reordered.map((l, i) => ({ id: l.id, sort_order: i }))
      );
    });
  }

  // ─── Inline create ────────────────────────────────────────────

  function handleInlineCreate() {
    if (!addTitle.trim()) {
      setAddError("Title is required");
      return;
    }
    setAddError(null);
    startTransition(async () => {
      const result = await createLesson({
        course_id: courseId,
        section_id: sectionId,
        title: addTitle.trim(),
        lesson_type: addType,
        sort_order: nextSortOrder,
      });
      if (result.success) {
        setAddTitle("");
        setShowAddForm(false);
      } else {
        setAddError(result.error ?? "Failed to create lesson");
      }
    });
  }

  // ─── Delete ───────────────────────────────────────────────────

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteLesson(deleteTarget.id, courseId);
      toast.success("Lesson deleted");
      setDeleteTarget(null);
    });
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">
            Lessons ({sortedLessons.length})
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowAddForm(true);
              setAddError(null);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Lesson
          </Button>
        </div>
        {sortedLessons.length === 0 && !showAddForm ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No lessons yet. Add a lesson to this section.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={sortedLessons.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {sortedLessons.map((lesson, index) => (
                  <SortableLessonRow
                    key={lesson.id}
                    lesson={lesson}
                    index={index}
                    isPending={isPending}
                    lessonImagesMap={lessonImagesMap}
                    onEdit={() => setEditingLesson(lesson)}
                    onDelete={() => setDeleteTarget(lesson)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Inline add form */}
        {showAddForm && (
          <div className="mt-2 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Input
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Lesson title..."
                className="flex-1 h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleInlineCreate();
                  }
                  if (e.key === "Escape") setShowAddForm(false);
                }}
              />
              <Select
                value={addType}
                onValueChange={(v) => setAddType(v as LessonType)}
              >
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rich_text">Rich Text</SelectItem>
                  <SelectItem value="text">Plain Text</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="slides">Slides</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8"
                onClick={handleInlineCreate}
                disabled={isPending}
              >
                {isPending ? "Adding..." : "Add"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
            </div>
            {addError && (
              <p className="text-sm text-destructive mt-2">{addError}</p>
            )}
          </div>
        )}
      </div>

      {/* Edit Lesson Dialog (kept — substantial content editing UI) */}
      {editingLesson && (
        <LessonEditDialog
          courseId={courseId}
          sectionId={sectionId}
          lesson={editingLesson}
          lessonImages={lessonImagesMap[editingLesson.id] ?? []}
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
              This will also remove all completion records. This action cannot be
              undone.
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

// ─── Sortable Lesson Row ────────────────────────────────────────

function SortableLessonRow({
  lesson,
  index,
  isPending,
  lessonImagesMap,
  onEdit,
  onDelete,
}: {
  lesson: CourseLesson;
  index: number;
  isPending: boolean;
  lessonImagesMap: Record<string, LessonImage[]>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const typeConfig = lessonTypeConfig[lesson.lesson_type ?? "text"];
  const TypeIcon = typeConfig.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors",
        isDragging && "opacity-50 z-50"
      )}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${lesson.title}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="text-sm font-medium text-muted-foreground w-6 text-center">
        {index + 1}
      </span>
      <div className={`p-1.5 rounded ${typeConfig.bgColor}`}>
        <TypeIcon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {lesson.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {typeConfig.label}
          {lesson.lesson_type === "video" && lesson.video_storage_path && " (uploaded)"}
          {lesson.lesson_type === "video" && lesson.video_url && !lesson.video_storage_path && " (external)"}
          {lesson.lesson_type === "text" && (lessonImagesMap[lesson.id]?.length ?? 0) > 0 && ` · ${lessonImagesMap[lesson.id].length} image${lessonImagesMap[lesson.id].length > 1 ? "s" : ""}`}
        </p>
      </div>
      {!lesson.is_active && (
        <Badge variant="muted" className="text-xs">
          Inactive
        </Badge>
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onEdit}
          aria-label={`Edit ${lesson.title}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`Delete ${lesson.title}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
