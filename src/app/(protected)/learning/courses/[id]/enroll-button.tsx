"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Loader2, BookOpen } from "lucide-react";

export function EnrollButton({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleEnroll() {
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("course_enrollments")
        .insert({
          user_id: userId,
          course_id: courseId,
          status: "enrolled",
          progress_percent: 0,
        });

      if (error) {
        console.error("Enrollment error:", error);
        alert("Failed to enroll in course. Please try again.");
        return;
      }

      router.refresh();
    } catch (err) {
      console.error("Enrollment error:", err);
      alert("Failed to enroll in course. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button onClick={handleEnroll} disabled={isLoading} className="w-full">
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Enrolling...
        </>
      ) : (
        <>
          <BookOpen className="h-4 w-4 mr-2" />
          Enroll Now
        </>
      )}
    </Button>
  );
}
