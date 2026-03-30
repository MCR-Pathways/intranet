"use client";

import { useState, useTransition } from "react";
import { publishCourse } from "@/app/(protected)/learning/admin/courses/actions";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Loader2, Rocket, AlertTriangle } from "lucide-react";

interface CoursePublishBannerProps {
  courseId: string;
  status: "draft" | "published";
}

export function CoursePublishBanner({
  courseId,
  status,
}: CoursePublishBannerProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showWarningDialog, setShowWarningDialog] = useState(false);

  if (status !== "draft") return null;

  const handlePublish = () => {
    setError(null);
    startTransition(async () => {
      const result = await publishCourse(courseId);
      if (result.success) {
        if (result.warnings && result.warnings.length > 0) {
          setWarnings(result.warnings);
          setShowWarningDialog(true);
        }
        toast.success("Course published");
      } else {
        setError(result.error ?? "Failed to publish course.");
        toast.error(result.error ?? "Failed to publish course");
      }
    });
  };

  return (
    <>
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">
                  This course is a draft
                </p>
                <p className="text-sm text-amber-700">
                  It is not visible to learners. Add content and publish when
                  ready.
                </p>
              </div>
            </div>
            <Button
              onClick={handlePublish}
              disabled={isPending}
              className="shrink-0"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Publish Course
                </>
              )}
            </Button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Publish warnings dialog — shown after successful publish if issues were found */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Course published with notes
            </AlertDialogTitle>
            <AlertDialogDescription>
              The course is live, but you might want to address these:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground px-1">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">&#8226;</span>
                {w}
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <Button onClick={() => setShowWarningDialog(false)}>
              Got it
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
