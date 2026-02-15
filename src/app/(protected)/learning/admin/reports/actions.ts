"use server";

import { requireLDAdmin } from "@/lib/auth";

interface ReportFilters {
  courseId?: string;
  teamId?: string;
  userType?: string;
  status?: string;
}

export async function exportReportCSV(filters: ReportFilters) {
  const { supabase } = await requireLDAdmin();

  // Build enrollment query with profile joins
  let query = supabase
    .from("course_enrollments")
    .select(
      "id, status, progress_percent, score, enrolled_at, completed_at, due_date, user_id, course_id"
    );

  if (filters.courseId) {
    query = query.eq("course_id", filters.courseId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data: enrollments, error: enrollError } = await query;

  if (enrollError) {
    return { success: false, error: enrollError.message, csv: null };
  }

  if (!enrollments || enrollments.length === 0) {
    return { success: false, error: "No data to export", csv: null };
  }

  // Get user profiles
  const userIds = [...new Set(enrollments.map((e) => e.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, user_type, team_id")
    .in("id", userIds);

  // Get courses
  const courseIds = [...new Set(enrollments.map((e) => e.course_id))];
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, category")
    .in("id", courseIds);

  // Get teams for filtering
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name");

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
  const courseMap = new Map(courses?.map((c) => [c.id, c]) ?? []);
  const teamMap = new Map(teams?.map((t) => [t.id, t]) ?? []);

  // Apply profile-level filters
  let filteredEnrollments = enrollments;
  if (filters.teamId) {
    filteredEnrollments = filteredEnrollments.filter((e) => {
      const profile = profileMap.get(e.user_id);
      return profile?.team_id === filters.teamId;
    });
  }
  if (filters.userType) {
    filteredEnrollments = filteredEnrollments.filter((e) => {
      const profile = profileMap.get(e.user_id);
      return profile?.user_type === filters.userType;
    });
  }

  // Build CSV
  const headers = [
    "User Name",
    "Email",
    "User Type",
    "Team",
    "Course",
    "Category",
    "Status",
    "Progress %",
    "Score",
    "Enrolled At",
    "Completed At",
    "Due Date",
  ];

  const rows = filteredEnrollments.map((e) => {
    const profile = profileMap.get(e.user_id);
    const course = courseMap.get(e.course_id);
    const team = profile?.team_id ? teamMap.get(profile.team_id) : null;

    return [
      profile?.full_name ?? "",
      profile?.email ?? "",
      profile?.user_type ?? "",
      team?.name ?? "",
      course?.title ?? "",
      course?.category ?? "",
      e.status,
      e.progress_percent.toString(),
      e.score?.toString() ?? "",
      e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString("en-GB") : "",
      e.completed_at
        ? new Date(e.completed_at).toLocaleDateString("en-GB")
        : "",
      e.due_date ? new Date(e.due_date).toLocaleDateString("en-GB") : "",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return { success: true, error: null, csv: csvContent };
}
