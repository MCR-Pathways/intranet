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
import { baseTemplate } from "@/lib/email";

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

  // ── HR: Compliance Expiry + Stale Leave + Key Dates ───────
  let hrReminders = 0;

  try {
    // Compliance document expiry (30d, 7d, expired)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000).toISOString().split("T")[0];
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];

    const { data: expiringDocs } = await supabase
      .from("compliance_documents")
      .select("id, profile_id, expiry_date, document_type_id")
      .not("expiry_date", "is", null)
      .lte("expiry_date", thirtyDaysFromNow)
      .not("status", "in", '("not_applicable")');

    if (expiringDocs && expiringDocs.length > 0) {
      const profileIds = [...new Set(expiringDocs.map((d) => d.profile_id))];
      const docTypeIds = [...new Set(expiringDocs.map((d) => d.document_type_id))];

      const [{ data: docProfiles }, { data: docTypes }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", profileIds),
        supabase.from("compliance_document_types").select("id, name").in("id", docTypeIds),
      ]);

      const profileLookup = new Map((docProfiles ?? []).map((p) => [p.id, p]));
      const typeLookup = new Map((docTypes ?? []).map((t) => [t.id, t]));

      // Fetch HR admins for escalation
      const { data: hrAdmins } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_hr_admin", true)
        .eq("status", "active");

      for (const doc of expiringDocs) {
        const profile = profileLookup.get(doc.profile_id);
        const docType = typeLookup.get(doc.document_type_id);
        if (!profile || !docType) continue;

        const expiryDate = new Date(doc.expiry_date + "T00:00:00");
        const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000);

        // Employee notification (30d and 7d)
        if (daysUntil > 0) {
          const subject = `${docType.name} expires in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;
          const html = baseTemplate(
            "Compliance Reminder",
            `<h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">Document Expiry Reminder</h2>
             <p style="color: #6b7280; font-size: 14px;">Hi ${profile.full_name},</p>
             <p style="font-size: 14px; color: #213350;">Your <strong>${docType.name}</strong> expires in <strong>${daysUntil} day${daysUntil !== 1 ? "s" : ""}</strong>. Please arrange renewal.</p>`
          );

          await queueEmail({
            userId: profile.id,
            email: profile.email,
            emailType: "compliance_expiry",
            subject,
            bodyHtml: html,
            entityId: `${doc.id}-${daysUntil <= 7 ? "7d" : "30d"}`,
            entityType: "compliance_document",
          });
          hrReminders++;
        }

        // HR admin escalation (7d or expired)
        if (daysUntil <= 7) {
          for (const admin of hrAdmins ?? []) {
            const statusText = daysUntil <= 0 ? "has expired" : `expires in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;
            const subject = `${profile.full_name}'s ${docType.name} ${statusText}`;
            const html = baseTemplate(
              "Compliance Alert",
              `<h2 style="color: ${daysUntil <= 0 ? "#dc2626" : "#92400e"}; font-size: 18px; margin: 0 0 8px;">Compliance Document ${daysUntil <= 0 ? "Expired" : "Expiring"}</h2>
               <p style="color: #6b7280; font-size: 14px;">Hi ${admin.full_name},</p>
               <p style="font-size: 14px; color: #213350;"><strong>${profile.full_name}</strong>'s <strong>${docType.name}</strong> ${statusText}.</p>`
            );

            await queueEmail({
              userId: admin.id,
              email: admin.email,
              emailType: "compliance_expiry",
              subject,
              bodyHtml: html,
              entityId: `${doc.id}-admin-${daysUntil <= 0 ? "expired" : "7d"}`,
              entityType: "compliance_document",
            });
            hrReminders++;
          }
        }
      }
    }

    // Stale leave requests (pending > 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const { data: staleLeave } = await supabase
      .from("leave_requests")
      .select("id, profile_id, leave_type, created_at")
      .eq("status", "pending")
      .lt("created_at", sevenDaysAgo);

    if (staleLeave && staleLeave.length > 0) {
      // Bulk-fetch requester profiles
      const requesterIds = [...new Set(staleLeave.map((r) => r.profile_id))];
      const { data: requesters } = await supabase
        .from("profiles")
        .select("id, full_name, line_manager_id")
        .in("id", requesterIds);

      const requesterMap = new Map((requesters ?? []).map((r) => [r.id, r]));

      // Bulk-fetch manager profiles
      const managerIds = [...new Set(
        (requesters ?? [])
          .map((r) => r.line_manager_id)
          .filter((id): id is string => !!id)
      )];
      const { data: managers } = managerIds.length > 0
        ? await supabase.from("profiles").select("id, full_name, email").in("id", managerIds)
        : { data: [] };

      const managerMap = new Map((managers ?? []).map((m) => [m.id, m]));

      for (const req of staleLeave) {
        const requester = requesterMap.get(req.profile_id);
        if (!requester?.line_manager_id) continue;

        const manager = managerMap.get(requester.line_manager_id as string);
        if (!manager) continue;

        const daysPending = Math.ceil((now.getTime() - new Date(req.created_at).getTime()) / 86400000);
        const subject = `Leave request from ${requester.full_name} pending ${daysPending} days`;
        const html = baseTemplate(
          "Stale Leave Request",
          `<h2 style="color: #92400e; font-size: 18px; margin: 0 0 8px;">Pending Leave Request</h2>
           <p style="color: #6b7280; font-size: 14px;">Hi ${manager.full_name},</p>
           <p style="font-size: 14px; color: #213350;"><strong>${requester.full_name}</strong> has a leave request that's been pending for <strong>${daysPending} days</strong>. Please review it.</p>
           <a href="${appUrl}/hr/leave?tab=approvals" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 16px;">Review Requests →</a>`
        );

        await queueEmail({
          userId: manager.id,
          email: manager.email,
          emailType: "stale_leave_reminder",
          subject,
          bodyHtml: html,
          entityId: req.id,
          entityType: "leave_request",
        });
        hrReminders++;
      }
    }

    // Key dates: probation end (14d) and work anniversaries (7d)
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 86400000).toISOString().split("T")[0];
    const { data: probationProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, probation_end_date, line_manager_id")
      .not("probation_end_date", "is", null)
      .lte("probation_end_date", fourteenDaysFromNow)
      .gte("probation_end_date", today)
      .eq("status", "active");

    if (probationProfiles && probationProfiles.length > 0) {
      // Bulk-fetch managers for all probation profiles
      const probManagerIds = [...new Set(
        probationProfiles
          .map((p) => p.line_manager_id)
          .filter((id): id is string => !!id)
      )];
      const { data: probManagers } = probManagerIds.length > 0
        ? await supabase.from("profiles").select("id, full_name, email").in("id", probManagerIds)
        : { data: [] };

      const probManagerMap = new Map((probManagers ?? []).map((m) => [m.id, m]));

      for (const p of probationProfiles) {
        if (!p.line_manager_id) continue;
        const mgr = probManagerMap.get(p.line_manager_id as string);
        if (!mgr) continue;

        const daysUntil = Math.ceil((new Date(p.probation_end_date + "T00:00:00").getTime() - now.getTime()) / 86400000);
        const subject = `${p.full_name}'s probation ends in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;
        const html = baseTemplate(
          "Probation Reminder",
          `<h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">Probation Period Ending</h2>
           <p style="color: #6b7280; font-size: 14px;">Hi ${mgr.full_name},</p>
           <p style="font-size: 14px; color: #213350;"><strong>${p.full_name}</strong>'s probation period ends in <strong>${daysUntil} day${daysUntil !== 1 ? "s" : ""}</strong>. Please arrange a review meeting.</p>`
        );

        await queueEmail({
          userId: mgr.id,
          email: mgr.email,
          emailType: "key_date_reminder",
          subject,
          bodyHtml: html,
          entityId: `probation-${p.id}`,
          entityType: "key_date",
        });
        hrReminders++;
      }
    }
  } catch (err) {
    logger.error("Failed to generate HR reminders", { error: err });
  }

  logger.info("Daily reminders generated", {
    learningReminders,
    hrReminders,
  });
  return Response.json({ learningReminders, hrReminders });
}
