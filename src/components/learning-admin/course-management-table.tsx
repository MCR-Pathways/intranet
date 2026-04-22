"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { CourseCreateDialog } from "./course-create-dialog";
import { duplicateCourse } from "@/app/(protected)/learning/admin/courses/actions";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { createRowNumberColumn } from "@/components/ui/data-table-row-number";
import {
  Search,
  Pencil,
  Copy,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatDuration } from "@/lib/utils";
import { categoryConfig } from "@/lib/learning";
import type { Course } from "@/types/database.types";

interface CourseManagementTableProps {
  courses: Course[];
}

export function CourseManagementTable({ courses }: CourseManagementTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<Course | null>(null);
  const [isDuplicating, startDuplicateTransition] = useTransition();

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
          {row.original.updated_at ? formatDate(new Date(row.original.updated_at)) : "N/A"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const course = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${course.title}`}
                title="Actions"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/learning/admin/courses/${course.id}`}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setDuplicateTarget(course)}
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
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

      {/* Duplicate Confirmation Dialog */}
      <AlertDialog
        open={!!duplicateTarget}
        onOpenChange={(open) => {
          if (!open) setDuplicateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Course</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a draft copy of &ldquo;{duplicateTarget?.title}&rdquo;
              including all sections, lessons, and quiz questions. Enrolments and
              learner progress will not be copied.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogClose>
            <Button
              disabled={isDuplicating}
              onClick={() => {
                if (!duplicateTarget) return;
                startDuplicateTransition(async () => {
                  const result = await duplicateCourse(duplicateTarget.id);
                  if (result.success && result.newCourseId) {
                    toast.success("Course duplicated");
                    setDuplicateTarget(null);
                    window.location.href = `/learning/admin/courses/${result.newCourseId}`;
                  } else {
                    toast.error(result.error || "Failed to duplicate course");
                  }
                });
              }}
            >
              {isDuplicating ? "Duplicating..." : "Duplicate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
