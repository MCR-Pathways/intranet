"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Save, CheckCircle2 } from "lucide-react";

export function UpdateProgressButton({
  enrollmentId,
  currentProgress,
}: {
  enrollmentId: string;
  currentProgress: number;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(currentProgress);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleUpdateProgress() {
    setIsLoading(true);

    try {
      const isCompleted = progress === 100;
      const now = new Date().toISOString();

      const updateData: Record<string, unknown> = {
        progress_percent: progress,
        status: isCompleted ? "completed" : progress > 0 ? "in_progress" : "enrolled",
        updated_at: now,
      };

      // Set started_at if this is the first progress update
      if (currentProgress === 0 && progress > 0) {
        updateData.started_at = now;
      }

      // Set completed_at if course is completed
      if (isCompleted) {
        updateData.completed_at = now;
      }

      const { error } = await supabase
        .from("course_enrollments")
        .update(updateData)
        .eq("id", enrollmentId);

      if (error) {
        console.error("Update error:", error);
        alert("Failed to update progress. Please try again.");
        return;
      }

      setIsEditing(false);
      router.refresh();
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update progress. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMarkComplete() {
    setProgress(100);
    setIsLoading(true);

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("course_enrollments")
        .update({
          progress_percent: 100,
          status: "completed",
          completed_at: now,
          started_at: currentProgress === 0 ? now : undefined,
          updated_at: now,
        })
        .eq("id", enrollmentId);

      if (error) {
        console.error("Update error:", error);
        alert("Failed to mark course as complete. Please try again.");
        return;
      }

      router.refresh();
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to mark course as complete. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isEditing) {
    return (
      <div className="space-y-3">
        <div>
          <Label htmlFor="progress">Update Progress (%)</Label>
          <Input
            id="progress"
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
            className="mt-1"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleUpdateProgress}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setIsEditing(false);
              setProgress(currentProgress);
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={() => setIsEditing(true)}
        className="w-full"
      >
        Update Progress
      </Button>
      <Button
        variant="secondary"
        onClick={handleMarkComplete}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark as Complete
          </>
        )}
      </Button>
    </div>
  );
}
