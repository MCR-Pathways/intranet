/**
 * Vercel Cron job: Generate daily reminder emails.
 *
 * Runs daily at ~7am UTC Mon-Fri (7am GMT winter, 8am BST summer).
 * Queries overdue/approaching courses and queues digest emails.
 * The process-emails Cron job sends them on the next ~15-min run.
 *
 * Security: Requires CRON_SECRET Bearer token (set by Vercel automatically).
 */

import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";
import { timingSafeTokenCompare } from "@/lib/auth";
import { queueEmail } from "@/lib/email-queue";
import { buildCourseOverdueEmail, baseTemplate } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // ── Verify CRON_SECRET ──────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error("CRON_SECRET not configured");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") ?? "";

  if (!timingSafeTokenCompare(token, cronSecret)) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.mcrpathways.org";
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  let learningReminders = 0;

  // ── L&D: Overdue / Approaching Course Reminders ─────────────
  try {
    // Fetch all non-completed enrolments with due dates
    const { data: enrolments } = await supabase
      .from("course_enrolments")
      .select("user_id, course_id, due_date, status")
      .not("due_date", "is", null)
      .not("status", "in", '("completed","dropped")');

    if (enrolments && enrolments.length > 0) {
      // Fetch profiles and courses for context
      const userIds = [...new Set(enrolments.map((e) => e.user_id))];
      const courseIds = [...new Set(enrolments.map((e) => e.course_id))];

      const [{ data: profiles }, { data: courses }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, line_manager_id")
          .in("id", userIds),
        supabase.from("courses").select("id, title").in("id", courseIds),
      ]);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p])
      );
      const courseMap = new Map(
        (courses ?? []).map((c) => [c.id, c])
      );

      // Group by user: { userId: { approaching: [...], overdue: [...] } }
      const userDigests = new Map<
        string,
        { approaching: { title: string; daysUntil: number }[]; overdue: { title: string; daysOverdue: number }[] }
      >();

      // Manager escalations (7d overdue)
      const managerEscalations = new Map<
        string,
        { learnerName: string; courseTitle: string; daysOverdue: number }[]
      >();

      for (const enrolment of enrolments) {
        const dueDate = new Date(enrolment.due_date + "T00:00:00");
        const diffMs = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / 86400000);
        const course = courseMap.get(enrolment.course_id);
        const profile = profileMap.get(enrolment.user_id);

        if (!course || !profile) continue;

        // Approaching (1-7 days until due)
        if (diffDays > 0 && diffDays <= 7) {
          const digest = userDigests.get(enrolment.user_id) ?? { approaching: [], overdue: [] };
          digest.approaching.push({ title: course.title, daysUntil: diffDays });
          userDigests.set(enrolment.user_id, digest);
        }

        // Overdue (past due)
        if (diffDays < 0) {
          const daysOverdue = Math.abs(diffDays);
          const digest = userDigests.get(enrolment.user_id) ?? { approaching: [], overdue: [] };
          digest.overdue.push({ title: course.title, daysOverdue });
          userDigests.set(enrolment.user_id, digest);

          // Manager escalation at 7d+ overdue
          if (daysOverdue >= 7 && profile.line_manager_id) {
            const items = managerEscalations.get(profile.line_manager_id as string) ?? [];
            items.push({
              learnerName: profile.full_name,
              courseTitle: course.title,
              daysOverdue,
            });
            managerEscalations.set(profile.line_manager_id as string, items);
          }
        }
      }

      // Queue learner digest emails
      for (const [userId, digest] of userDigests) {
        const profile = profileMap.get(userId);
        if (!profile) continue;

        const allItems = [
          ...digest.approaching.map((i) => `<li>${i.title} — due in ${i.daysUntil} day${i.daysUntil !== 1 ? "s" : ""}</li>`),
          ...digest.overdue.map((i) => `<li style="color: #dc2626;">${i.title} — ${i.daysOverdue} day${i.daysOverdue !== 1 ? "s" : ""} overdue</li>`),
        ];

        if (allItems.length === 0) continue;

        const subject =
          digest.overdue.length > 0
            ? `${digest.overdue.length} overdue course${digest.overdue.length !== 1 ? "s" : ""} need your attention`
            : `${digest.approaching.length} course${digest.approaching.length !== 1 ? "s" : ""} due soon`;

        const html = baseTemplate(
          "Course Reminders",
          `<h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">Course Reminders</h2>
           <p style="color: #6b7280; font-size: 14px;">Hi ${profile.full_name},</p>
           <p style="font-size: 14px; color: #213350;">You have ${allItems.length} course${allItems.length !== 1 ? "s" : ""} requiring attention:</p>
           <ul style="font-size: 14px; color: #213350; padding-left: 20px; margin: 12px 0;">
             ${allItems.join("")}
           </ul>
           <a href="${appUrl}/learning/my-courses" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">View My Courses →</a>`
        );

        await queueEmail({
          userId,
          email: profile.email,
          emailType: "course_overdue_digest",
          subject,
          bodyHtml: html,
          entityId: today, // Use date as entity_id for daily dedup
          entityType: "daily_reminder",
        });
        learningReminders++;
      }

      // Queue manager escalation emails
      for (const [managerId, items] of managerEscalations) {
        const { data: manager } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", managerId)
          .single();

        if (!manager) continue;

        const itemsHtml = items
          .map(
            (i) =>
              `<li>${i.learnerName} — <strong>${i.courseTitle}</strong> (${i.daysOverdue} days overdue)</li>`
          )
          .join("");

        const subject = `${items.length} team member${items.length !== 1 ? "s have" : " has"} overdue courses`;
        const html = baseTemplate(
          "Team Overdue Courses",
          `<h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">Team Course Compliance</h2>
           <p style="color: #6b7280; font-size: 14px;">Hi ${manager.full_name},</p>
           <p style="font-size: 14px; color: #213350;">${items.length} team member${items.length !== 1 ? "s have" : " has"} overdue courses:</p>
           <ul style="font-size: 14px; color: #213350; padding-left: 20px; margin: 12px 0;">
             ${itemsHtml}
           </ul>
           <a href="${appUrl}/hr/team" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">View Team →</a>`
        );

        await queueEmail({
          userId: managerId,
          email: manager.email,
          emailType: "course_overdue_manager",
          subject,
          bodyHtml: html,
          entityId: today,
          entityType: "daily_reminder",
        });
        learningReminders++;
      }
    }
  } catch (err) {
    logger.error("Failed to generate learning reminders", { error: err });
  }

  // HR reminders (added in PR 3)
  const hrReminders = 0;

  logger.info("Daily reminders generated", {
    learningReminders,
    hrReminders,
  });
  return Response.json({ learningReminders, hrReminders });
}
