"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  PlayCircle,
  BookOpen,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Course, CourseEnrolment, CourseCategory } from "@/types/database.types";
import { formatDuration } from "@/lib/utils";
import { categoryConfig } from "@/lib/learning";

function CourseCard({
  course,
  enrolment,
}: {
  course: Course;
  enrolment?: CourseEnrolment | null;
}) {
  const config = categoryConfig[course.category];
  const Icon = config.icon;

  const getStatusBadge = () => {
    if (!enrolment) return null;

    switch (enrolment.status) {
      case "completed":
        return <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "in_progress":
        return <Badge variant="warning"><PlayCircle className="h-3 w-3 mr-1" />{enrolment.progress_percent}% Complete</Badge>;
      case "enrolled":
        return <Badge variant="muted">Enrolled</Badge>;
      default:
        return null;
    }
  };

  const getDueDateBadge = () => {
    if (!enrolment?.due_date) return null;

    const dueDate = new Date(enrolment.due_date);
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (enrolment.status === "completed") return null;

    if (daysUntilDue < 0) {
      return <Badge variant="destructive">Overdue</Badge>;
    } else if (daysUntilDue <= 7) {
      return <Badge variant="warning">Due in {daysUntilDue} days</Badge>;
    }
    return null;
  };

  return (
    <Link href={`/learning/courses/${course.id}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.color}`} />
              <CardTitle className="text-base line-clamp-2">{course.title}</CardTitle>
            </div>
            {course.is_required && (
              <Badge variant="destructive" className="shrink-0">Required</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {getStatusBadge()}
            {getDueDateBadge()}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <CardDescription className="line-clamp-2 mb-4 flex-1">
            {course.description}
          </CardDescription>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(course.duration_minutes)}
            </div>
            <Badge variant="outline" className="text-xs">
              {config.label}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ category, isSearch }: { category?: string; isSearch?: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          {isSearch
            ? "No courses match your search."
            : category
              ? `No ${category.toLowerCase()} courses available yet.`
              : "No courses available yet."}
        </p>
      </CardContent>
    </Card>
  );
}

interface CourseCatalogContentProps {
  courses: Course[];
  enrolmentMap: Map<string, CourseEnrolment>;
  defaultTab: string;
}

export function CourseCatalogContent({
  courses,
  enrolmentMap,
  defaultTab,
}: CourseCatalogContentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const query = searchQuery.toLowerCase();
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        (c.description && c.description.toLowerCase().includes(query))
    );
  }, [courses, searchQuery]);

  const coursesByCategory = useMemo(() => ({
    compliance: filteredCourses.filter((c) => c.category === "compliance"),
    upskilling: filteredCourses.filter((c) => c.category === "upskilling"),
    soft_skills: filteredCourses.filter((c) => c.category === "soft_skills"),
  }), [filteredCourses]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search courses by title or description..."
          className="pl-10 pr-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Course tabs by category */}
      <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full">
        <TabsList variant="line">
          <TabsTrigger value="all">
            All Courses{isSearching ? ` (${filteredCourses.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="compliance">
            Compliance ({coursesByCategory.compliance.length})
          </TabsTrigger>
          <TabsTrigger value="upskilling">
            Upskilling ({coursesByCategory.upskilling.length})
          </TabsTrigger>
          <TabsTrigger value="soft_skills">
            Soft Skills ({coursesByCategory.soft_skills.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {filteredCourses.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  enrolment={enrolmentMap.get(course.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState isSearch={isSearching} />
          )}
        </TabsContent>

        {(["compliance", "upskilling", "soft_skills"] as const).map((cat) => (
          <TabsContent key={cat} value={cat} className="mt-6">
            {coursesByCategory[cat].length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {coursesByCategory[cat].map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    enrolment={enrolmentMap.get(course.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                category={categoryConfig[cat].label}
                isSearch={isSearching}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
