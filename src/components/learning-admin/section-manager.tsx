"use client";

import { useState, useTransition } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Layers,
  HelpCircle,
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSection, setEditingSection] = useState<CourseSection | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<CourseSectionWithDetails | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Create form state
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit form state
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

  // ─── Reorder ────────────────────────────────────────────────────

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const reordered = [...sortedSections];
    [reordered[index - 1], reordered[index]] = [
      reordered[index],
      reordered[index - 1],
    ];
    startTransition(async () => {
      const result = await reorderSections(
        courseId,
        reordered.map((s) => s.id)
      );
      if (result.success) {
        toast.success("Section order saved");
      } else {
        toast.error(result.error ?? "Failed to reorder sections");
      }
    });
  }

  function handleMoveDown(index: number) {
    if (index === sortedSections.length - 1) return;
    const reordered = [...sortedSections];
    [reordered[index], reordered[index + 1]] = [
      reordered[index + 1],
      reordered[index],
    ];
    startTransition(async () => {
      const result = await reorderSections(
        courseId,
        reordered.map((s) => s.id)
      );
      if (result.success) {
        toast.success("Section order saved");
      } else {
        toast.error(result.error ?? "Failed to reorder sections");
      }
    });
  }

  // ─── Create ─────────────────────────────────────────────────────

  function resetCreateForm() {
    setCreateTitle("");
    setCreateDescription("");
    setCreateError(null);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createTitle.trim()) {
      setCreateError("Section title is required");
      return;
    }
    setCreateError(null);
    startTransition(async () => {
      const result = await createSection({
        course_id: courseId,
        title: createTitle.trim(),
        description: createDescription.trim() || null,
        sort_order: nextSortOrder,
      });
      if (result.success) {
        toast.success("Section created");
        resetCreateForm();
        setShowCreateDialog(false);
        // Auto-expand the new section
        if (result.sectionId) {
          setExpandedSections((prev) => new Set([...prev, result.sectionId!]));
        }
      } else {
        setCreateError(result.error ?? "Failed to create section");
        toast.error(result.error ?? "Failed to create section");
      }
    });
  }

  // ─── Edit ───────────────────────────────────────────────────────

  function openEdit(section: CourseSection) {
    setEditingSection(section);
    setEditTitle(section.title);
    setEditDescription(section.description ?? "");
    setEditIsActive(section.is_active);
    setEditError(null);
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSection) return;
    if (!editTitle.trim()) {
      setEditError("Section title is required");
      return;
    }
    setEditError(null);
    startTransition(async () => {
      const result = await updateSection(editingSection.id, courseId, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        is_active: editIsActive,
      });
      if (result.success) {
        toast.success("Section updated");
        setEditingSection(null);
      } else {
        setEditError(result.error ?? "Failed to update section");
        toast.error(result.error ?? "Failed to update section");
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
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
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
            <div className="space-y-2">
              {sortedSections.map((section, index) => {
                const expanded = expandedSections.has(section.id);
                const lessonCount = section.lessons.length;
                const hasQuiz = !!section.quiz;

                return (
                  <div key={section.id}>
                    {/* Section header row */}
                    <div
                      className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => toggleExpanded(section.id)}
                    >
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          expanded && "rotate-90"
                        )}
                      />
                      <span className="text-sm font-medium text-muted-foreground w-6 text-center shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {section.title}
                        </p>
                        {section.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {section.description}
                          </p>
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
                            index === sortedSections.length - 1 || isPending
                          }
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(section)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(section);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Collapsible content */}
                    {expanded && (
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
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Section Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) resetCreateForm();
          setShowCreateDialog(isOpen);
        }}
      >
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
            <DialogDescription>
              Create a new section to organise your course content.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="section_title">Title</Label>
                <Input
                  id="section_title"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Module 1: Introduction"
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="section_description">
                  Description (optional)
                </Label>
                <textarea
                  id="section_description"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="A brief description of what this section covers..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={3}
                />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetCreateForm();
                  setShowCreateDialog(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Add Section"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog
        open={!!editingSection}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingSection(null);
        }}
      >
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
            <DialogDescription>
              Update the section details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit_section_title">Title</Label>
                <Input
                  id="edit_section_title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_section_description">
                  Description (optional)
                </Label>
                <textarea
                  id="edit_section_description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="edit_section_active"
                  checked={editIsActive}
                  onCheckedChange={setEditIsActive}
                />
                <Label htmlFor="edit_section_active">Active</Label>
              </div>
              {editError && (
                <p className="text-sm text-destructive">{editError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingSection(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
