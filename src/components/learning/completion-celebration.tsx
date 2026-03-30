"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Award } from "lucide-react";
import Link from "next/link";

interface CompletionCelebrationProps {
  courseTitle: string;
  courseId: string;
  hasCertificate?: boolean;
}

export function CompletionCelebration({
  courseTitle,
  courseId,
  hasCertificate = false,
}: CompletionCelebrationProps) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    // Strip ?completed=true from URL so refresh doesn't re-trigger
    const url = new URL(window.location.href);
    url.searchParams.delete("completed");
    window.history.replaceState({}, "", url.pathname);
  }, []);

  return (
    <Card className="border-green-500 bg-green-50">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center py-4">
          <CheckCircle2 className="h-12 w-12 text-green-600 mb-4" />
          <h2 className="text-xl font-semibold text-green-800 mb-1">
            Well done!
          </h2>
          <p className="text-green-700 mb-6">
            You've completed {courseTitle}.
          </p>
          <div className="flex items-center gap-3">
            {hasCertificate && (
              <Button asChild>
                <a href={`/api/certificate/${courseId}`} download>
                  <Award className="h-4 w-4 mr-2" />
                  Download Certificate
                </a>
              </Button>
            )}
            <Button asChild variant={hasCertificate ? "outline" : "default"}>
              <Link href="/learning">Back to My Learning</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
