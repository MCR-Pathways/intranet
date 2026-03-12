"use client";

import { useState, useMemo, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { exportReportCSV } from "@/app/(protected)/learning/admin/reports/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  BookOpen,
  Users,
  CheckCircle2,
  AlertTriangle,
  Download,
  BarChart3,
} from "lucide-react";

interface EnrolmentData {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  progress_percent: number;
  score: number | null;
  completed_at: string | null;
  due_date: string | null;
}

interface CourseData {
  id: string;
  title: string;
  category: string;
  is_active: boolean;
  is_required: boolean;
}

interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  user_type: string;
  team_id: string | null;
  status: string;
  is_external: boolean;
}

interface TeamData {
  id: string;
  name: string;
}

interface CourseStat {
  title: string;
  category: string;
  enrolled: number;
  completed: number;
  overdue: number;
  avgScore: number | null;
}

interface UserStat {
  name: string;
  email: string;
  userType: string;
  team: string;
  enrolled: number;
  completed: number;
  overdue: number;
}

interface ReportsDashboardProps {
  enrolments: EnrolmentData[];
  courses: CourseData[];
  profiles: ProfileData[];
  teams: TeamData[];
}

export function ReportsDashboard({
  enrolments,
  courses,
  profiles,
  teams,
}: ReportsDashboardProps) {
  const [courseFilter, setCourseFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [userTypeFilter, setUserTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );
  const teamMap = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  // Apply filters
  const filteredEnrolments = useMemo(() => {
    return enrolments.filter((e) => {
      if (courseFilter !== "all" && e.course_id !== courseFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;

      const profile = profileMap.get(e.user_id);
      if (!profile) return false;
      if (teamFilter !== "all" && profile.team_id !== teamFilter) return false;
      if (userTypeFilter === "internal" && profile.is_external) return false;
      if (userTypeFilter === "external" && !profile.is_external) return false;

      return true;
    });
  }, [
    enrolments,
    courseFilter,
    teamFilter,
    userTypeFilter,
    statusFilter,
    profileMap,
  ]);

  // Overview stats
  const stats = useMemo(() => {
    const now = new Date();
    const total = filteredEnrolments.length;
    const completed = filteredEnrolments.filter(
      (e) => e.status === "completed"
    ).length;
    const overdue = filteredEnrolments.filter(
      (e) =>
        e.status !== "completed" && e.due_date && new Date(e.due_date) < now
    ).length;
    const activeCourses = courses.filter((c) => c.is_active).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, overdue, activeCourses, completionRate };
  }, [filteredEnrolments, courses]);

  // Per-course breakdown
  const courseStats = useMemo(() => {
    const statsMap = new Map<string, CourseStat>();
    const now = new Date();

    for (const course of courses) {
      const courseEnrolments = filteredEnrolments.filter(
        (e) => e.course_id === course.id
      );
      const completedEnrolments = courseEnrolments.filter(
        (e) => e.status === "completed"
      );
      const scores = completedEnrolments
        .map((e) => e.score)
        .filter((s): s is number => s !== null);
      const overdueCount = courseEnrolments.filter(
        (e) =>
          e.status !== "completed" && e.due_date && new Date(e.due_date) < now
      ).length;

      if (courseEnrolments.length > 0) {
        statsMap.set(course.id, {
          title: course.title,
          category: course.category,
          enrolled: courseEnrolments.length,
          completed: completedEnrolments.length,
          overdue: overdueCount,
          avgScore:
            scores.length > 0
              ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
              : null,
        });
      }
    }

    return Array.from(statsMap.values());
  }, [courses, filteredEnrolments]);

  // Per-user breakdown
  const userStats = useMemo(() => {
    const statsMap = new Map<string, UserStat>();
    const now = new Date();

    for (const profile of profiles) {
      const userEnrolments = filteredEnrolments.filter(
        (e) => e.user_id === profile.id
      );

      if (userEnrolments.length > 0) {
        const completedCount = userEnrolments.filter(
          (e) => e.status === "completed"
        ).length;
        const overdueCount = userEnrolments.filter(
          (e) =>
            e.status !== "completed" &&
            e.due_date &&
            new Date(e.due_date) < now
        ).length;
        const team = profile.team_id ? teamMap.get(profile.team_id) : null;

        statsMap.set(profile.id, {
          name: profile.full_name,
          email: profile.email,
          userType: profile.user_type,
          team: team?.name ?? "",
          enrolled: userEnrolments.length,
          completed: completedCount,
          overdue: overdueCount,
        });
      }
    }

    return Array.from(statsMap.values());
  }, [profiles, filteredEnrolments, teamMap]);

  const handleExportCSV = () => {
    startTransition(async () => {
      const result = await exportReportCSV({
        courseId: courseFilter !== "all" ? courseFilter : undefined,
        teamId: teamFilter !== "all" ? teamFilter : undefined,
        isExternal: userTypeFilter === "external" ? true : userTypeFilter === "internal" ? false : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });

      if (result.success && result.csv) {
        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `learning-report-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    });
  };

  // Column definitions for Course Completion table
  const courseColumns = useMemo<ColumnDef<CourseStat>[]>(() => {
    const categoryLabels: Record<string, string> = {
      compliance: "Compliance",
      upskilling: "Upskilling",
      soft_skills: "Soft Skills",
    };

    return [
    createRowNumberColumn<CourseStat>(),
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Course" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.title}</span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="secondary">
          {categoryLabels[row.original.category] ?? row.original.category}
        </Badge>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "enrolled",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Enrolled" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.original.enrolled}</div>
      ),
    },
    {
      accessorKey: "completed",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Completed" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.original.completed}</div>
      ),
    },
    {
      id: "rate",
      accessorFn: (row) => row.enrolled > 0 ? Math.round((row.completed / row.enrolled) * 100) : 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Rate" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <div className="text-right">{getValue<number>()}%</div>
      ),
    },
    {
      accessorKey: "overdue",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Overdue" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.overdue > 0 ? (
            <span className="text-red-600 font-medium">{row.original.overdue}</span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </div>
      ),
    },
    {
      id: "avgScore",
      accessorFn: (row) => row.avgScore ?? -1,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Avg Score" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.avgScore !== null ? `${row.original.avgScore}%` : "—"}
        </div>
      ),
    },
  ];
  }, []);

  // Column definitions for Learner Progress table
  const userColumns = useMemo<ColumnDef<UserStat>[]>(() => [
    createRowNumberColumn<UserStat>(),
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.email}</span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "team",
      header: "Team",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.team || "—"}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "enrolled",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Enrolled" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.original.enrolled}</div>
      ),
    },
    {
      accessorKey: "completed",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Completed" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.original.completed}</div>
      ),
    },
    {
      accessorKey: "overdue",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Overdue" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.overdue > 0 ? (
            <span className="text-red-600 font-medium">{row.original.overdue}</span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats.activeCourses}</p>
                <p className="text-sm text-muted-foreground">Active Courses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">
                  Total Enrolments
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.completionRate}%</p>
                <p className="text-sm text-muted-foreground">
                  Completion Rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{stats.overdue}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={userTypeFilter}
                onValueChange={setUserTypeFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All User Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  <SelectItem value="internal">Internal Staff</SelectItem>
                  <SelectItem value="external">External Staff</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="enrolled">Enrolled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={isPending}
            >
              <Download className="h-4 w-4 mr-2" />
              {isPending ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-Course Table */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <BarChart3 className="h-5 w-5" />
          Course Completion
        </h3>
        <DataTable
          columns={courseColumns}
          data={courseStats}
          emptyMessage="No enrolment data"
          initialSorting={[{ id: "title", desc: false }]}
        />
      </div>

      {/* Per-User Table */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <Users className="h-5 w-5" />
          Learner Progress
        </h3>
        <DataTable
          columns={userColumns}
          data={userStats}
          emptyMessage="No learner data"
          initialSorting={[{ id: "name", desc: false }]}
        />
      </div>
    </div>
  );
}
