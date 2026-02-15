"use client";

import { useState, useTransition } from "react";
import { createCourse } from "@/app/(protected)/learning/admin/courses/actions";
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
import { Switch } from "@/components/ui/switch";
import type { CourseCategory } from "@/types/database.types";

interface CourseCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CourseCreateDialog({
  open,
  onOpenChange,
}: CourseCreateDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CourseCategory>("upskilling");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [passingScore, setPassingScore] = useState("");
  const [dueDaysFromStart, setDueDaysFromStart] = useState("");
  const [contentUrl, setContentUrl] = useState("");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("upskilling");
    setDurationMinutes("");
    setIsRequired(false);
    setPassingScore("");
    setDueDaysFromStart("");
    setContentUrl("");
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createCourse({
        title,
        description: description || null,
        category,
        duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
        is_required: isRequired,
        passing_score: passingScore ? parseInt(passingScore) : null,
        due_days_from_start: dueDaysFromStart
          ? parseInt(dueDaysFromStart)
          : null,
        content_url: contentUrl || null,
      });

      if (result.success) {
        resetForm();
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to create course");
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Create Course</DialogTitle>
          <DialogDescription>
            Add a new course to the learning catalogue.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Data Protection & GDPR"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the course..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as CourseCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="upskilling">Upskilling</SelectItem>
                    <SelectItem value="soft_skills">Soft Skills</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="0"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="e.g. 45"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="passing_score">Passing Score</Label>
                <Input
                  id="passing_score"
                  type="number"
                  min="0"
                  max="100"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                  placeholder="e.g. 80"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="due_days">Due Days from Start</Label>
                <Input
                  id="due_days"
                  type="number"
                  min="0"
                  value={dueDaysFromStart}
                  onChange={(e) => setDueDaysFromStart(e.target.value)}
                  placeholder="e.g. 30"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content_url">External Content URL</Label>
              <Input
                id="content_url"
                type="url"
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_required">Required Course</Label>
              <Switch
                id="is_required"
                checked={isRequired}
                onCheckedChange={setIsRequired}
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
              {isPending ? "Creating..." : "Create Course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
