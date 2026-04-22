"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import {
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from "@/app/(protected)/learning/admin/courses/section-actions";
import { LessonManager } from "./lesson-manager";
import { SectionQuizEditor } from "./section-quiz-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  ChevronRight,
  Layers,
  HelpCircle,
  GripVertical,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { CourseSection, CourseSectionWithDetails } from "@/types/database.types";

interface SectionManagerProps {
  courseId: string;
  sections: CourseSectionWithDetails[];
}

export function SectionManager({ courseId, sections }: SectionManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseSectionWithDetails | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [newSectionId, setNewSectionId] = useState<string | null>(null);

  // Inline edit state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  const sortedSections = [...sections].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const nextSortOrder =
    sortedSections.length > 0
      ? sortedSections[sortedSections.length - 1].sort_order + 1
      : 0;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // ─── Expand / collapse ──────────────────────────────────────────

  function toggleExpanded(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  // ─── DnD reorder ──────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedSections.findIndex((s) => s.id === active.id);
    const newIndex = sortedSections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...sortedSections];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    startTransition(async () => {
      const result = await reorderSections(
        courseId,
        reordered.map((s) => s.id)
      );
      if (!result.success) {
        toast.error(result.error ?? "Failed to reorder sections");
      }
    });
  }

  // ─── One-click create ─────────────────────────────────────────

  function handleCreate() {
    startTransition(async () => {
      const result = await createSection({
        course_id: courseId,
        title: "Untitled Section",
        sort_order: nextSortOrder,
      });
      if (result.success && result.sectionId) {
        setNewSectionId(result.sectionId);
        setExpandedSections((prev) => new Set([...prev, result.sectionId!]));
      } else {
        toast.error(result.error ?? "Failed to create section");
      }
    });
  }

  // ─── Inline edit ──────────────────────────────────────────────

  function startEdit(section: CourseSection) {
    setEditingSectionId(section.id);
    setEditTitle(section.title);
    setEditDescription(section.description ?? "");
    setEditIsActive(section.is_active);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingSectionId(null);
    setEditError(null);
  }

  function saveEdit(sectionId: string) {
    if (!editTitle.trim()) {
      setEditError("Title is required");
      return;
    }
    setEditError(null);
    startTransition(async () => {
      const result = await updateSection(sectionId, courseId, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        is_active: editIsActive,
      });
      if (result.success) {
        setEditingSectionId(null);
        setNewSectionId(null);
      } else {
        setEditError(result.error ?? "Failed to update section");
      }
    });
  }

  // ─── Delete ─────────────────────────────────────────────────────

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteSection(deleteTarget.id, courseId);
      if (result.success) {
        toast.success("Section deleted");
        setDeleteTarget(null);
      } else {
        setDeleteError(result.error ?? "Failed to delete section");
      }
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Course Sections ({sortedSections.length})
            <InfoTooltip text="Organise your course into sections. Each section can have lessons and an optional quiz that gates access to the next section." />
          </CardTitle>
          <Button size="sm" onClick={handleCreate} disabled={isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Add Section
          </Button>
        </CardHeader>
        <CardContent>
          {sortedSections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No sections yet. Add a section to organise your course content.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext
                items={sortedSections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {sortedSections.map((section, index) => (
                    <SortableSectionRow
                      key={section.id}
                      section={section}
                      index={index}
                      courseId={courseId}
                      isExpanded={expandedSections.has(section.id)}
                      isEditing={editingSectionId === section.id}
                      isNewlyCreated={newSectionId === section.id}
                      isPending={isPending}
                      editTitle={editTitle}
                      editDescription={editDescription}
                      editIsActive={editIsActive}
                      editError={editError}
                      onToggleExpanded={() => toggleExpanded(section.id)}
                      onStartEdit={() => startEdit(section)}
                      onCancelEdit={cancelEdit}
                      onSaveEdit={() => saveEdit(section.id)}
                      onEditTitleChange={setEditTitle}
                      onEditDescriptionChange={setEditDescription}
                      onEditIsActiveChange={setEditIsActive}
                      onDelete={() => {
                        setDeleteError(null);
                        setDeleteTarget(section);
                      }}
                      onNewSectionSaved={() => setNewSectionId(null)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the section &quot;
              {deleteTarget?.title}&quot;? This will also remove any associated
              quiz. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {deleteError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete Section"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Sortable Section Row ───────────────────────────────────────

interface SortableSectionRowProps {
  section: CourseSectionWithDetails;
  index: number;
  courseId: string;
  isExpanded: boolean;
  isEditing: boolean;
  isNewlyCreated: boolean;
  isPending: boolean;
  editTitle: string;
  editDescription: string;
  editIsActive: boolean;
  editError: string | null;
  onToggleExpanded: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditTitleChange: (value: string) => void;
  onEditDescriptionChange: (value: string) => void;
  onEditIsActiveChange: (value: boolean) => void;
  onDelete: () => void;
  onNewSectionSaved: () => void;
}

function SortableSectionRow({
  section,
  index,
  courseId,
  isExpanded,
  isEditing,
  isNewlyCreated,
  isPending,
  editTitle,
  editDescription,
  editIsActive,
  editError,
  onToggleExpanded,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditTitleChange,
  onEditDescriptionChange,
  onEditIsActiveChange,
  onDelete,
  onNewSectionSaved,
}: SortableSectionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const titleInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const [inlineTitle, setInlineTitle] = useState(section.title);
  const lastSavedTitle = useRef(section.title);

  // Auto-focus the title input for newly created sections
  useEffect(() => {
    if (isNewlyCreated && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isNewlyCreated]);

  const handleInlineTitleBlur = () => {
    const trimmed = inlineTitle.trim();
    if (!trimmed) {
      setInlineTitle(lastSavedTitle.current);
      return;
    }
    if (trimmed === lastSavedTitle.current) {
      onNewSectionSaved();
      return;
    }
    startTransition(async () => {
      const { updateSection: update } = await import(
        "@/app/(protected)/learning/admin/courses/section-actions"
      );
      const result = await update(section.id, courseId, { title: trimmed });
      if (result.success) {
        lastSavedTitle.current = trimmed;
        onNewSectionSaved();
      } else {
        toast.error("Failed to save title");
        setInlineTitle(lastSavedTitle.current);
      }
    });
  };

  const handleInlineTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      setInlineTitle(lastSavedTitle.current);
      onNewSectionSaved();
    }
  };

  const lessonCount = section.lessons.length;
  const hasQuiz = !!section.quiz;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-50 z-50")}
    >
      {isEditing ? (
        /* ─── Inline edit mode ─── */
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="grid gap-2">
            <Label htmlFor={`edit_title_${section.id}`}>Title</Label>
            <Input
              id={`edit_title_${section.id}`}
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") onCancelEdit();
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit_desc_${section.id}`}>
              Description (optional)
            </Label>
            <Textarea
              id={`edit_desc_${section.id}`}
              value={editDescription}
              onChange={(e) => onEditDescriptionChange(e.target.value)}
              placeholder="Briefly describe what this section covers (visible to learners)"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={`edit_active_${section.id}`}
              checked={editIsActive}
              onCheckedChange={onEditIsActiveChange}
            />
            <Label htmlFor={`edit_active_${section.id}`}>Active</Label>
          </div>
          {editError && (
            <p className="text-sm text-destructive">{editError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancelEdit}>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={onSaveEdit} disabled={isPending}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        /* ─── Normal display mode ─── */
        <>
          <div className="flex items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
            {/* Drag handle */}
            <button
              className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground touch-none"
              {...attributes}
              {...listeners}
              aria-label={`Drag to reorder ${section.title}`}
            >
              <GripVertical className="h-4 w-4" />
            </button>

            {/* Expand chevron */}
            <button
              onClick={onToggleExpanded}
              className="p-0.5"
              aria-label={isExpanded ? "Collapse section" : "Expand section"}
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </button>

            <span className="text-sm font-medium text-muted-foreground w-6 text-center shrink-0">
              {index + 1}
            </span>

            {/* Title: inline editable for new sections, plain text otherwise */}
            <div className="flex-1 min-w-0">
              {isNewlyCreated ? (
                <Input
                  ref={titleInputRef}
                  value={inlineTitle}
                  onChange={(e) => setInlineTitle(e.target.value)}
                  onBlur={handleInlineTitleBlur}
                  onKeyDown={handleInlineTitleKeyDown}
                  className="h-7 text-sm font-medium border-transparent bg-transparent px-1 focus-visible:border-input focus-visible:bg-card"
                />
              ) : (
                <>
                  <p className="text-sm font-medium truncate">
                    {section.title}
                  </p>
                  {section.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {section.description}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="muted" className="text-xs">
                {lessonCount} lesson{lessonCount !== 1 ? "s" : ""}
              </Badge>
              {hasQuiz && (
                <Badge variant="default" className="text-xs">
                  <HelpCircle className="h-3 w-3 mr-0.5" />
                  Quiz
                </Badge>
              )}
              {!section.is_active && (
                <Badge variant="muted" className="text-xs">
                  Inactive
                </Badge>
              )}
            </div>
            <div
              className="flex items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onStartEdit}
                aria-label={`Edit ${section.title}`}
                title="Edit"
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
                aria-label={`Delete ${section.title}`}
                title="Delete"
              >
                <Trash2 />
              </Button>
            </div>
          </div>

          {/* Collapsible content */}
          {isExpanded && (
            <div className="mt-2 ml-3 pl-8 pb-2 space-y-4 border-l-2 border-border">
              <LessonManager
                courseId={courseId}
                sectionId={section.id}
                lessons={section.lessons}
                lessonImagesMap={section.lessonImagesMap}
              />
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Section Quiz
                </p>
                <SectionQuizEditor
                  sectionId={section.id}
                  courseId={courseId}
                  quiz={section.quiz}
                  questions={section.quizQuestions}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
