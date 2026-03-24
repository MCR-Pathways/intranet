"use client";

import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CourseCard } from "./course-card";
import type { CourseEnrolment } from "@/types/database.types";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "all", label: "All Courses" },
  { value: "compliance", label: "Compliance" },
  { value: "upskilling", label: "Upskilling" },
  { value: "soft_skills", label: "Soft Skills" },
] as const;

interface CourseCatalogueProps {
  courses: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    duration_minutes: number | null;
    is_required: boolean;
  }>;
  /** User's enrolments keyed by course ID */
  enrolments: Record<string, CourseEnrolment>;
  /** Pre-selected category from URL ?category= param */
  initialCategory?: string;
}

export function CourseCatalogue({
  courses,
  enrolments,
  initialCategory,
}: CourseCatalogueProps) {
  const [activeCategory, setActiveCategory] = useState(
    initialCategory && initialCategory !== "all" ? initialCategory : "all"
  );
  const [requiredOnly, setRequiredOnly] = useState(false);

  const filtered = useMemo(() => {
    let result = courses;
    if (activeCategory !== "all") {
      result = result.filter((c) => c.category === activeCategory);
    }
    if (requiredOnly) {
      result = result.filter((c) => c.is_required);
    }
    return result;
  }, [courses, activeCategory, requiredOnly]);

  // Count courses per category for the chip labels
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: courses.length };
    for (const c of courses) {
      counts[c.category] = (counts[c.category] ?? 0) + 1;
    }
    return counts;
  }, [courses]);

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.value;
          const count = categoryCounts[cat.value] ?? 0;

          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-foreground border border-input hover:bg-accent"
              )}
            >
              {cat.label}
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isActive
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}

        <div className="h-5 w-px bg-border mx-1" />

        <button
          onClick={() => setRequiredOnly((prev) => !prev)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            requiredOnly
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card text-foreground border border-input hover:bg-accent"
          )}
        >
          Required only
        </button>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No courses match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "course" : "courses"}
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                enrolment={enrolments[course.id] ?? null}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
