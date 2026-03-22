"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { CourseCreateDialog } from "./course-create-dialog";
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
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { createRowNumberColumn } from "@/components/ui/data-table-row-number";
import {
  Search,
  Pencil,
  Plus,
  Copy,
  Loader2,
} from "lucide-react";
import { formatDate, formatDuration } from "@/lib/utils";
import { categoryConfig } from "@/lib/learning";
import { duplicateCourse } from "@/app/(protected)/learning/admin/courses/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Course } from "@/types/database.types";

interface CourseManagementTableProps {
  courses: Course[];
}

export function CourseManagementTable({ courses }: CourseManagementTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const router = useRouter();

  async function handleDuplicate(courseId: string) {
    setDuplicatingId(courseId);
    try {
      const result = await duplicateCourse(courseId);
      if (result.success && result.courseId) {
        toast.success("Course duplicated successfully");
        router.push(`/learning/admin/courses/${result.courseId}`);
      } else {
        toast.error(result.error ?? "Failed to duplicate course");
      }
    } finally {
      setDuplicatingId(null);
    }
  }

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

  const columns = useMemo<ColumnDef<Course>[]>(() => [
    createRowNumberColumn<Course>(),
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => {
        const course = row.original;
        return (
          <div>
            <Link
              href={`/learning/admin/courses/${course.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {course.title}
            </Link>
            {course.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {course.description}
              </p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const config = categoryConfig[row.original.category];
        return <Badge variant={config.badgeVariant}>{config.label}</Badge>;
      },
      enableSorting: false,
    },
    {
      id: "type",
      accessorFn: (row) => (row.is_required ? 1 : 0),
      header: "Type",
      cell: ({ row }) =>
        row.original.is_required ? (
          <Badge variant="warning">Required</Badge>
        ) : (
          <Badge variant="secondary">Optional</Badge>
        ),
      enableSorting: false,
    },
    {
      accessorKey: "duration_minutes",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Duration" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDuration(row.original.duration_minutes)}
        </span>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => {
        if (row.status === "draft") return "draft";
        return row.is_active ? "published" : "inactive";
      },
      header: "Status",
      cell: ({ row }) => {
        const course = row.original;
        if (course.status === "draft") return <Badge variant="warning">Draft</Badge>;
        if (course.is_active) return <Badge variant="success">Published</Badge>;
        return <Badge variant="destructive">Inactive</Badge>;
      },
      enableSorting: false,
    },
    {
      accessorKey: "updated_at",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Modified" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {formatDate(new Date(row.original.updated_at))}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
            <Link href={`/learning/admin/courses/${row.original.id}`}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={duplicatingId === row.original.id}
            onClick={() => handleDuplicate(row.original.id)}
          >
            {duplicatingId === row.original.id ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            Duplicate
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ], []);

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
      <DataTable
        columns={columns}
        data={filteredCourses}
        totalCount={courses.length}
        emptyMessage="No courses found"
        initialSorting={[{ id: "title", desc: false }]}
      />

      {/* Create Course Dialog */}
      <CourseCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}
