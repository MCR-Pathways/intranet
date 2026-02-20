"use client";

import { useState, useTransition } from "react";
import { updateCourse } from "@/app/(protected)/learning/admin/courses/actions";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { Course, CourseCategory } from "@/types/database.types";

interface CourseEditFormProps {
  course: Course;
}

export function CourseEditForm({ course }: CourseEditFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [category, setCategory] = useState<CourseCategory>(course.category);
  const [durationMinutes, setDurationMinutes] = useState(
    course.duration_minutes?.toString() ?? ""
  );
  const [isRequired, setIsRequired] = useState(course.is_required);
  const [passingScore, setPassingScore] = useState(
    course.passing_score?.toString() ?? ""
  );
  const [dueDaysFromStart, setDueDaysFromStart] = useState(
    course.due_days_from_start?.toString() ?? ""
  );
  const [contentUrl, setContentUrl] = useState(course.content_url ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updateCourse(course.id, {
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
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to update course");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit_title">Title</Label>
              <Input
                id="edit_title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit_description">Description</Label>
              <textarea
                id="edit_description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit_category">Category</Label>
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
                <Label htmlFor="edit_duration">Duration (minutes)</Label>
                <Input
                  id="edit_duration"
                  type="number"
                  min="0"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit_passing_score">Passing Score</Label>
                <Input
                  id="edit_passing_score"
                  type="number"
                  min="0"
                  max="100"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit_due_days">
                  Due Days from Start
                  <InfoTooltip text="Number of days from enrolment date before this course is due" />
                </Label>
                <Input
                  id="edit_due_days"
                  type="number"
                  min="0"
                  value={dueDaysFromStart}
                  onChange={(e) => setDueDaysFromStart(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit_content_url">External Content URL</Label>
              <Input
                id="edit_content_url"
                type="url"
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="edit_is_required">
                Required Course
                <InfoTooltip text="Required courses must be completed by all assigned users" />
              </Label>
              <Switch
                id="edit_is_required"
                checked={isRequired}
                onCheckedChange={setIsRequired}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && (
              <p className="text-sm text-green-600">Course updated successfully</p>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
