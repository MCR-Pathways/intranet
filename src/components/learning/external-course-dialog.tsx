"use client";

import { useState, useTransition } from "react";
import {
  addExternalCourse,
  updateExternalCourse,
} from "@/app/(protected)/learning/my-courses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil } from "lucide-react";
import type { ExternalCourse, CourseCategory } from "@/types/database.types";

const PROVIDER_SUGGESTIONS = [
  "Coursera",
  "LinkedIn Learning",
  "Udemy",
  "In-person",
  "Internal Workshop",
  "Conference",
];

interface ExternalCourseDialogProps {
  mode: "create" | "edit";
  course?: ExternalCourse;
}

export function ExternalCourseDialog({ mode, course }: ExternalCourseDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState(course?.title ?? "");
  const [provider, setProvider] = useState(course?.provider ?? "");
  const [category, setCategory] = useState<CourseCategory | "">(course?.category ?? "");
  const [completedAt, setCompletedAt] = useState(course?.completed_at ?? "");
  const [durationMinutes, setDurationMinutes] = useState<string>(
    course?.duration_minutes?.toString() ?? ""
  );
  const [certificateUrl, setCertificateUrl] = useState(course?.certificate_url ?? "");
  const [notes, setNotes] = useState(course?.notes ?? "");

  function resetForm() {
    if (mode === "create") {
      setTitle("");
      setProvider("");
      setCategory("");
      setCompletedAt("");
      setDurationMinutes("");
      setCertificateUrl("");
      setNotes("");
    } else if (course) {
      setTitle(course.title);
      setProvider(course.provider ?? "");
      setCategory(course.category ?? "");
      setCompletedAt(course.completed_at);
      setDurationMinutes(course.duration_minutes?.toString() ?? "");
      setCertificateUrl(course.certificate_url ?? "");
      setNotes(course.notes ?? "");
    }
    setError(null);
  }

  function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!completedAt) {
      setError("Completion date is required");
      return;
    }

    const data = {
      title: title.trim(),
      provider: provider.trim() || null,
      category: (category || null) as CourseCategory | null,
      completed_at: completedAt,
      duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
      certificate_url: certificateUrl.trim() || null,
      notes: notes.trim() || null,
    };

    startTransition(async () => {
      setError(null);
      const result =
        mode === "create"
          ? await addExternalCourse(data)
          : await updateExternalCourse(course!.id, data);

      if (!result.success) {
        setError(result.error ?? "Something went wrong");
      } else {
        setOpen(false);
        if (mode === "create") resetForm();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Add External Course
          </Button>
        ) : (
          <Button variant="ghost" size="sm">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Log External Course" : "Edit External Course"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ext-title">Course Title *</Label>
            <Input
              id="ext-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Data Analysis"
            />
          </div>

          {/* Provider */}
          <div className="space-y-1.5">
            <Label htmlFor="ext-provider">Provider</Label>
            <Input
              id="ext-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. Coursera, LinkedIn Learning"
              list="provider-suggestions"
            />
            <datalist id="provider-suggestions">
              {PROVIDER_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          {/* Category + Date row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(val) => setCategory(val as CourseCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="upskilling">Upskilling</SelectItem>
                  <SelectItem value="soft_skills">Soft Skills</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ext-date">Date Completed *</Label>
              <Input
                id="ext-date"
                type="date"
                value={completedAt}
                onChange={(e) => setCompletedAt(e.target.value)}
              />
            </div>
          </div>

          {/* Duration + Certificate URL row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ext-duration">Duration (minutes)</Label>
              <Input
                id="ext-duration"
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g. 60"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ext-cert">Certificate URL</Label>
              <Input
                id="ext-cert"
                type="url"
                value={certificateUrl}
                onChange={(e) => setCertificateUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ext-notes">Notes</Label>
            <Textarea
              id="ext-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this course..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Add Course" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
