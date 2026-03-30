"use client";

import { useMemo, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    sectionCount: number;
    lessonCount: number;
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
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let result = courses;

    // Text search on title and description
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          (c.description?.toLowerCase().includes(query) ?? false)
      );
    }

    if (activeCategory !== "all") {
      result = result.filter((c) => c.category === activeCategory);
    }
    if (requiredOnly) {
      result = result.filter((c) => c.is_required);
    }
    return result;
  }, [courses, activeCategory, requiredOnly, searchQuery]);

  // Count courses per category for the chip labels
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: courses.length };
    for (const c of courses) {
      counts[c.category] = (counts[c.category] ?? 0) + 1;
    }
    return counts;
  }, [courses]);

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-9 bg-card"
        />
        {hasSearch && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </button>
        )}
      </div>

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
            <BookOpen className="h-10 w-10 text-muted-foreground/50 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              {hasSearch
                ? "No courses match your search."
                : "No courses match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {hasSearch
              ? `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`
              : `${filtered.length} ${filtered.length === 1 ? "course" : "courses"}`}
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
