"use client";

import { useState, useTransition } from "react";
import { deleteExternalCourse } from "@/app/(protected)/learning/my-courses/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, ExternalLink, Clock, Calendar } from "lucide-react";
import { ExternalCourseDialog } from "./external-course-dialog";
import type { ExternalCourse } from "@/types/database.types";

interface ExternalCourseCardProps {
  course: ExternalCourse;
}

const CATEGORY_LABELS: Record<string, string> = {
  compliance: "Compliance",
  upskilling: "Upskilling",
  soft_skills: "Soft Skills",
};

const CATEGORY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  compliance: "default",
  upskilling: "secondary",
  soft_skills: "outline",
};

export function ExternalCourseCard({ course }: ExternalCourseCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      setError(null);
      const result = await deleteExternalCourse(course.id);
      if (!result.success) {
        setError(result.error ?? "Failed to delete course");
      } else {
        setDialogOpen(false);
      }
    });
  }

  const formattedDate = new Date(course.completed_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold leading-tight">{course.title}</h3>
            {course.provider && (
              <p className="mt-0.5 text-sm text-muted-foreground">{course.provider}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {course.category && (
                <Badge variant={CATEGORY_VARIANTS[course.category] ?? "outline"} className="text-xs">
                  {CATEGORY_LABELS[course.category] ?? course.category}
                </Badge>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formattedDate}
              </span>
              {course.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {course.duration_minutes >= 60
                    ? `${Math.floor(course.duration_minutes / 60)}h${course.duration_minutes % 60 > 0 ? ` ${course.duration_minutes % 60}m` : ""}`
                    : `${course.duration_minutes}m`}
                </span>
              )}
            </div>

            {course.notes && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{course.notes}</p>
            )}

            {course.certificate_url && (
              <a
                href={course.certificate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View Certificate
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <ExternalCourseDialog mode="edit" course={course} />
            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete External Course</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{course.title}&quot;? This
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {error && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                    {error}
                  </div>
                )}
                <AlertDialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                    {isPending ? "Deleting..." : "Delete"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
