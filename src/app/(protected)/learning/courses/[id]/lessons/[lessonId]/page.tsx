import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { CourseLesson } from "@/types/database.types";
import { MarkCompleteButton } from "./mark-complete-button";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id: courseId, lessonId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch the course
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, is_active")
    .eq("id", courseId)
    .eq("is_active", true)
    .single();

  if (!course) {
    notFound();
  }

  // Fetch all active lessons for navigation
  const { data: allLessons } = await supabase
    .from("course_lessons")
    .select("id, course_id, title, content, video_url, sort_order, is_active")
    .eq("course_id", courseId)
    .eq("is_active", true)
    .order("sort_order");

  const lessons = (allLessons as CourseLesson[]) ?? [];
  const currentIndex = lessons.findIndex((l) => l.id === lessonId);

  if (currentIndex === -1) {
    notFound();
  }

  const lesson = lessons[currentIndex];
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  // Check if this lesson is completed
  const { data: completion } = await supabase
    .from("lesson_completions")
    .select("id")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .single();

  const isCompleted = !!completion;

  // Check enrollment
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .single();

  if (!enrollment) {
    redirect(`/learning/courses/${courseId}`);
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href={`/learning/courses/${courseId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {course.title}
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Lesson {currentIndex + 1} of {lessons.length}
        </span>
      </div>

      {/* Lesson content */}
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight mb-6">
          {lesson.title}
        </h1>

        {/* Video embed */}
        {lesson.video_url && getEmbedUrl(lesson.video_url) && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="aspect-video">
                <iframe
                  src={getEmbedUrl(lesson.video_url)}
                  className="w-full h-full rounded-lg"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lesson text content */}
        {lesson.content && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                {lesson.content}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mark Complete + Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            {prevLesson ? (
              <Button variant="outline" asChild>
                <Link
                  href={`/learning/courses/${courseId}/lessons/${prevLesson.id}`}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Link>
              </Button>
            ) : (
              <div />
            )}
          </div>

          <MarkCompleteButton
            lessonId={lessonId}
            courseId={courseId}
            isCompleted={isCompleted}
          />

          <div>
            {nextLesson ? (
              <Button variant="outline" asChild>
                <Link
                  href={`/learning/courses/${courseId}/lessons/${nextLesson.id}`}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href={`/learning/courses/${courseId}`}>
                  Back to Course
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Convert YouTube/Vimeo URLs to embeddable URLs */
function getEmbedUrl(url: string): string {
  // Protocol validation — only allow http/https
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }
  } catch {
    return "";
  }

  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
  );
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // Return as-is for other URLs (already validated as http/https)
  return url;
}
