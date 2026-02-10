"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface InductionItemPageProps {
  itemId: string;
  title: string;
  description: string;
  type: "document" | "course" | "task";
  category: string;
  isCompleted: boolean;
  userId: string;
  children: React.ReactNode;
}

export function InductionItemPage({
  itemId,
  title,
  description,
  type,
  category,
  isCompleted,
  userId,
  children,
}: InductionItemPageProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(isCompleted);

  const supabase = createClient();

  const confirmationMessage =
    type === "document"
      ? `Have you read and understood "${title}"? This will mark it as complete.`
      : type === "course"
        ? `Have you completed the "${title}" course? This will mark it as complete.`
        : `Have you completed "${title}"? This will mark it as complete.`;

  const handleMarkComplete = async () => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("induction_progress").insert({
        user_id: userId,
        item_id: itemId,
      });

      if (error) {
        // If unique constraint violation, item is already completed
        if (error.code === "23505") {
          setCompleted(true);
          window.location.href = "/intranet/induction";
        } else {
          console.error("Error marking item complete:", error);
        }
        return;
      }

      setCompleted(true);
      window.location.href = "/intranet/induction";
    } catch (err) {
      console.error("Error marking item complete:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/intranet/induction"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Induction Checklist
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {category}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {type === "document"
                ? "Document"
                : type === "course"
                  ? "Course"
                  : "Task"}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        {completed && (
          <Badge variant="success" className="flex items-center gap-1 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed
          </Badge>
        )}
      </div>

      {/* Content area */}
      <Card>
        <CardContent className="pt-6">{children}</CardContent>
      </Card>

      {/* Mark as complete button */}
      {!completed ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Ready to mark as complete?
            </CardTitle>
            <CardDescription>
              {type === "document"
                ? "Once you have read and understood the content above, mark this item as complete."
                : type === "course"
                  ? "Once you have completed the course, mark this item as complete."
                  : "Once you have finished this task, mark this item as complete."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>Mark as Complete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Completion</AlertDialogTitle>
                  <AlertDialogDescription>
                    {confirmationMessage}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </AlertDialogClose>
                  <Button
                    onClick={handleMarkComplete}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Saving..." : "Yes, mark as complete"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-status-active/30 bg-status-active/5">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 text-status-active" />
            <p className="text-sm font-medium">
              This item has been completed.{" "}
              <Link
                href="/intranet/induction"
                className="text-primary hover:underline"
              >
                Return to checklist
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
