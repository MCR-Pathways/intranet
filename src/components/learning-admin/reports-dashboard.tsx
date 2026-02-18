"use client";

import { useState, useMemo, useTransition } from "react";
import { exportReportCSV } from "@/app/(protected)/learning/admin/reports/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Users,
  CheckCircle2,
  AlertTriangle,
  Download,
  BarChart3,
} from "lucide-react";

interface EnrollmentData {
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
}

interface TeamData {
  id: string;
  name: string;
}

interface ReportsDashboardProps {
  enrollments: EnrollmentData[];
  courses: CourseData[];
  profiles: ProfileData[];
  teams: TeamData[];
}

export function ReportsDashboard({
  enrollments,
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
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      if (courseFilter !== "all" && e.course_id !== courseFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;

      const profile = profileMap.get(e.user_id);
      if (!profile) return false;
      if (teamFilter !== "all" && profile.team_id !== teamFilter) return false;
      if (userTypeFilter !== "all" && profile.user_type !== userTypeFilter)
        return false;

      return true;
    });
  }, [
    enrollments,
    courseFilter,
    teamFilter,
    userTypeFilter,
    statusFilter,
    profileMap,
  ]);

  // Overview stats
  const stats = useMemo(() => {
    const now = new Date();
    const total = filteredEnrollments.length;
    const completed = filteredEnrollments.filter(
      (e) => e.status === "completed"
    ).length;
    const overdue = filteredEnrollments.filter(
      (e) =>
        e.status !== "completed" && e.due_date && new Date(e.due_date) < now
    ).length;
    const activeCourses = courses.filter((c) => c.is_active).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, overdue, activeCourses, completionRate };
  }, [filteredEnrollments, courses]);

  // Per-course breakdown
  const courseStats = useMemo(() => {
    const statsMap = new Map<
      string,
      {
        title: string;
        category: string;
        enrolled: number;
        completed: number;
        overdue: number;
        avgScore: number | null;
      }
    >();

    const now = new Date();

    for (const course of courses) {
      const courseEnrollments = filteredEnrollments.filter(
        (e) => e.course_id === course.id
      );
      const completedEnrollments = courseEnrollments.filter(
        (e) => e.status === "completed"
      );
      const scores = completedEnrollments
        .map((e) => e.score)
        .filter((s): s is number => s !== null);
      const overdueCount = courseEnrollments.filter(
        (e) =>
          e.status !== "completed" && e.due_date && new Date(e.due_date) < now
      ).length;

      if (courseEnrollments.length > 0) {
        statsMap.set(course.id, {
          title: course.title,
          category: course.category,
          enrolled: courseEnrollments.length,
          completed: completedEnrollments.length,
          overdue: overdueCount,
          avgScore:
            scores.length > 0
              ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
              : null,
        });
      }
    }

    return Array.from(statsMap.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }, [courses, filteredEnrollments]);

  // Per-user breakdown
  const userStats = useMemo(() => {
    const statsMap = new Map<
      string,
      {
        name: string;
        email: string;
        userType: string;
        team: string;
        enrolled: number;
        completed: number;
        overdue: number;
      }
    >();

    const now = new Date();

    for (const profile of profiles) {
      const userEnrollments = filteredEnrollments.filter(
        (e) => e.user_id === profile.id
      );

      if (userEnrollments.length > 0) {
        const completedCount = userEnrollments.filter(
          (e) => e.status === "completed"
        ).length;
        const overdueCount = userEnrollments.filter(
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
          enrolled: userEnrollments.length,
          completed: completedCount,
          overdue: overdueCount,
        });
      }
    }

    return Array.from(statsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [profiles, filteredEnrollments, teamMap]);

  const handleExportCSV = () => {
    startTransition(async () => {
      const result = await exportReportCSV({
        courseId: courseFilter !== "all" ? courseFilter : undefined,
        teamId: teamFilter !== "all" ? teamFilter : undefined,
        userType: userTypeFilter !== "all" ? userTypeFilter : undefined,
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

  const categoryLabels: Record<string, string> = {
    compliance: "Compliance",
    upskilling: "Upskilling",
    soft_skills: "Soft Skills",
  };

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
                  Total Enrollments
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
                  <SelectItem value="all">All User Types</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="pathways_coordinator">
                    Pathways Coordinator
                  </SelectItem>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Course Completion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Course
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                    Enrolled
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                    Completed
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                    Rate
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                    Overdue
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                    Avg Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {courseStats.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No enrollment data
                    </td>
                  </tr>
                ) : (
                  courseStats.map((cs) => (
                    <tr
                      key={cs.title}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{cs.title}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {categoryLabels[cs.category] ?? cs.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">{cs.enrolled}</td>
                      <td className="px-4 py-3 text-right">{cs.completed}</td>
                      <td className="px-4 py-3 text-right">
                        {cs.enrolled > 0
                          ? Math.round((cs.completed / cs.enrolled) * 100)
                          : 0}
                        %
                      </td>
                      <td className="px-4 py-3 text-right">
                        {cs.overdue > 0 ? (
                          <span className="text-red-600 font-medium">
                            {cs.overdue}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {cs.avgScore !== null ? `${cs.avgScore}%` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Per-User Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Learner Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Team
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                    Enrolled
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                    Completed
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                    Overdue
                  </th>
                </tr>
              </thead>
              <tbody>
                {userStats.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No learner data
                    </td>
                  </tr>
                ) : (
                  userStats.map((us) => (
                    <tr
                      key={us.email}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{us.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {us.email}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {us.team || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">{us.enrolled}</td>
                      <td className="px-4 py-3 text-right">{us.completed}</td>
                      <td className="px-4 py-3 text-right">
                        {us.overdue > 0 ? (
                          <span className="text-red-600 font-medium">
                            {us.overdue}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            {userStats.length} learners
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
