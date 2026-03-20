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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import type { CourseSectionWithDetails, LessonImage } from "@/types/database.types";

interface SectionManagerProps {
  courseId: string;
  sections: CourseSectionWithDetails[];
  lessonImagesMap?: Record<string, LessonImage[]>;
}

export function SectionManager({
  courseId,
  sections,
  lessonImagesMap = {},
}: SectionManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSection, setEditingSection] =
    useState<CourseSectionWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<CourseSectionWithDetails | null>(null);

  // Form state for create/edit dialogs
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const sortedSections = [...sections].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const nextSortOrder =
    sortedSections.length > 0
      ? sortedSections[sortedSections.length - 1].sort_order + 1
      : 0;

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrders = sortedSections.map((s, i) => ({
      id: s.id,
      sort_order:
        i === index
          ? sortedSections[i - 1].sort_order
          : i === index - 1
            ? sortedSections[index].sort_order
            : s.sort_order,
    }));
    startTransition(async () => {
      await reorderSections(courseId, newOrders);
      toast.success("Section order saved");
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === sortedSections.length - 1) return;
    const newOrders = sortedSections.map((s, i) => ({
      id: s.id,
      sort_order:
        i === index
          ? sortedSections[i + 1].sort_order
          : i === index + 1
            ? sortedSections[index].sort_order
            : s.sort_order,
    }));
    startTransition(async () => {
      await reorderSections(courseId, newOrders);
      toast.success("Section order saved");
    });
  };

  const handleCreate = () => {
    const title = formTitle.trim();
    if (!title) return;

    startTransition(async () => {
      const result = await createSection({
        course_id: courseId,
        title,
        description: formDescription.trim() || null,
        sort_order: nextSortOrder,
      });
      if (result.success) {
        toast.success("Section created");
        setShowCreateDialog(false);
        setFormTitle("");
        setFormDescription("");
      } else {
        toast.error(result.error ?? "Failed to create section");
      }
    });
  };

  const handleUpdate = () => {
    if (!editingSection) return;
    const title = formTitle.trim();
    if (!title) return;

    startTransition(async () => {
      const result = await updateSection(editingSection.id, courseId, {
        title,
        description: formDescription.trim() || null,
      });
      if (result.success) {
        toast.success("Section updated");
        setEditingSection(null);
        setFormTitle("");
        setFormDescription("");
      } else {
        toast.error(result.error ?? "Failed to update section");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteSection(deleteTarget.id, courseId);
      if (result.success) {
        toast.success("Section deleted");
        setDeleteTarget(null);
      } else {
        toast.error(result.error ?? "Failed to delete section");
      }
    });
  };

  const openEditDialog = (section: CourseSectionWithDetails) => {
    setFormTitle(section.title);
    setFormDescription(section.description ?? "");
    setEditingSection(section);
  };

  const openCreateDialog = () => {
    setFormTitle("");
    setFormDescription("");
    setShowCreateDialog(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Course Sections ({sortedSections.length})
          </CardTitle>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />
            Add Section
          </Button>
        </CardHeader>
        <CardContent>
          {sortedSections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No sections yet. Add sections to organise this course.
            </p>
          ) : (
            <div className="space-y-2">
              {sortedSections.map((section, index) => {
                const isExpanded = expandedSections.has(section.id);
                return (
                  <div
                    key={section.id}
                    className="rounded-lg border border-border"
                  >
                    {/* Section header */}
                    <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => toggleSection(section.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => toggleSection(section.id)}
                      >
                        <p className="text-sm font-medium truncate">
                          {section.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {section.lessons.length}{" "}
                          {section.lessons.length === 1 ? "lesson" : "lessons"}
                          {section.quiz && " · Quiz"}
                        </p>
                      </div>
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
                            index === sortedSections.length - 1 || isPending
                          }
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEditDialog(section)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(section)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-border p-4 space-y-4">
                        <LessonManager
                          courseId={courseId}
                          sectionId={section.id}
                          lessons={section.lessons}
                          lessonImagesMap={lessonImagesMap}
                        />
                        <SectionQuizEditor
                          sectionId={section.id}
                          courseId={courseId}
                          quiz={section.quiz}
                        />
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
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setFormTitle("");
            setFormDescription("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
            <DialogDescription>
              Create a new section to organise lessons within this course.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-section-title">Title</Label>
              <Input
                id="create-section-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Introduction"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-section-description">
                Description (optional)
              </Label>
              <Textarea
                id="create-section-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this section"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setFormTitle("");
                setFormDescription("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formTitle.trim() || isPending}
            >
              {isPending ? "Creating..." : "Create Section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog
        open={!!editingSection}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSection(null);
            setFormTitle("");
            setFormDescription("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
            <DialogDescription>
              Update the section title and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-section-title">Title</Label>
              <Input
                id="edit-section-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Introduction"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-section-description">
                Description (optional)
              </Label>
              <Textarea
                id="edit-section-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this section"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingSection(null);
                setFormTitle("");
                setFormDescription("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formTitle.trim() || isPending}
            >
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the section &quot;
              {deleteTarget?.title}&quot;? This will also remove all lessons,
              quizzes, and completion records within this section. This action
              cannot be undone.
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
              {isPending ? "Deleting..." : "Delete Section"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
