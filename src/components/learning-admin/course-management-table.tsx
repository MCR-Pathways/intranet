"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CourseCreateDialog } from "./course-create-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Pencil,
  Plus,
  Shield,
  Lightbulb,
  Users,
} from "lucide-react";
import { formatDuration } from "@/lib/utils";
import type { Course, CourseCategory } from "@/types/database.types";

const categoryConfig: Record<
  CourseCategory,
  { label: string; icon: React.ElementType; variant: "destructive" | "default" | "secondary" }
> = {
  compliance: { label: "Compliance", icon: Shield, variant: "destructive" },
  upskilling: { label: "Upskilling", icon: Lightbulb, variant: "default" },
  soft_skills: { label: "Soft Skills", icon: Users, variant: "secondary" },
};

interface CourseManagementTableProps {
  courses: Course[];
}

export function CourseManagementTable({ courses }: CourseManagementTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (course.description ?? "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || course.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "draft" && course.status === "draft") ||
        (statusFilter === "published" && course.status === "published" && course.is_active) ||
        (statusFilter === "inactive" && course.status === "published" && !course.is_active);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [courses, searchQuery, categoryFilter, statusFilter]);

  return (
    <>
      {/* Filters and Create Button */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="compliance">Compliance</SelectItem>
            <SelectItem value="upskilling">Upskilling</SelectItem>
            <SelectItem value="soft_skills">Soft Skills</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Course
        </Button>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground w-12">
                  #
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Title
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Category
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Type
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Duration
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Last Modified
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No courses found
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course, index) => {
                  const config = categoryConfig[course.category];
                  return (
                    <tr
                      key={course.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/learning/admin/courses/${course.id}`}
                          className="font-medium hover:underline"
                        >
                          {course.title}
                        </Link>
                        {course.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {course.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {course.is_required ? (
                          <Badge variant="warning">Required</Badge>
                        ) : (
                          <Badge variant="secondary">Optional</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDuration(course.duration_minutes)}
                      </td>
                      <td className="px-4 py-3">
                        {course.status === "draft" ? (
                          <Badge variant="warning">Draft</Badge>
                        ) : course.is_active ? (
                          <Badge variant="success">Published</Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(course.updated_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          asChild
                        >
                          <Link
                            href={`/learning/admin/courses/${course.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          {filteredCourses.length} of {courses.length} courses
        </div>
      </Card>

      {/* Create Course Dialog */}
      <CourseCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}
