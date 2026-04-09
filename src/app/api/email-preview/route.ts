/**
 * Dev-only email template preview route.
 *
 * Visit /api/email-preview to see all available types.
 * Visit /api/email-preview?type=mention to preview a specific template.
 *
 * Blocked in production — returns 404.
 */

import {
  baseTemplate,
  buildCourseAssignedEmail,
  buildCertificateEarnedEmail,
  buildCourseCompletedEmail,
  buildWelcomeEmail,
  EMAIL_THEME_CONFIG,
} from "@/lib/email";

export const dynamic = "force-dynamic";

function buildPreviewHtml(emailType: string): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.mcrpathways.org";

  switch (emailType) {
    case "mention":
      return baseTemplate(
        "Mention Preview",
        `<p style="font-size: 14px; color: #213350;"><strong>Sarah Thompson</strong> mentioned you in a comment:</p>
         <div style="background: #F2F4F7; padding: 12px 16px; border-radius: 8px; margin: 12px 0; font-size: 14px; color: #374151; border-left: 3px solid #751B48;">Great work on the quarterly report, really clear summary of the key findings.</div>
         <a href="${appUrl}/intranet/post/123" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; border: 2px solid #213350; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">View Post →</a>`,
        { preheader: "Sarah Thompson mentioned you: Great work on the quarterly report...", emailType: "mention" }
      );

    case "course_assigned":
      return buildCourseAssignedEmail("Jamie Robertson", "Data Protection Essentials", "30 April 2026", `${appUrl}/learning/courses/abc`).html;

    case "course_overdue_digest":
      return baseTemplate(
        "Course Reminders",
        `<h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">Course Reminders</h2>
         <p style="font-size: 14px; color: #213350;">Hi Jamie, you have 3 courses requiring attention.</p>
         <p style="font-size: 13px; font-weight: 600; color: #dc2626; margin: 16px 0 4px;">Overdue</p>
         <ul style="font-size: 14px; color: #dc2626; padding-left: 20px; margin: 0;">
           <li style="margin: 4px 0;">Fire Safety Awareness — <strong>12 days</strong> overdue</li>
           <li style="margin: 4px 0;">Equality & Diversity — <strong>3 days</strong> overdue</li>
         </ul>
         <p style="font-size: 13px; font-weight: 600; color: #92400e; margin: 16px 0 4px;">Due soon</p>
         <ul style="font-size: 14px; color: #213350; padding-left: 20px; margin: 0;">
           <li style="margin: 4px 0;">GDPR Refresher — due in <strong>5 days</strong></li>
         </ul>
         <a href="${appUrl}/learning/my-courses" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 16px;">View My Courses →</a>`,
        { emailType: "course_overdue_digest" }
      );

    case "course_overdue_manager":
      return baseTemplate(
        "Team Overdue Courses",
        `<h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">Team Course Compliance</h2>
         <p style="font-size: 14px; color: #213350;">Hi Alex, 2 team members have overdue courses:</p>
         <div style="background: #F2F4F7; border-radius: 8px; overflow: hidden; margin: 16px 0;">
           <div style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">
             <strong style="color: #213350;">Jamie Robertson</strong>
             <span style="color: #6b7280;"> — Fire Safety Awareness</span>
             <span style="color: #dc2626; font-weight: 600;"> (12d overdue)</span>
           </div>
           <div style="padding: 8px 12px; font-size: 14px;">
             <strong style="color: #213350;">Morgan Stewart</strong>
             <span style="color: #6b7280;"> — Data Protection Essentials</span>
             <span style="color: #dc2626; font-weight: 600;"> (3d overdue)</span>
           </div>
         </div>
         <a href="${appUrl}/hr/team" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">View Team →</a>`,
        { emailType: "course_overdue_manager" }
      );

    case "certificate_earned":
      return buildCertificateEarnedEmail("Jamie Robertson", "Data Protection Essentials", "CERT-2026-0042", `${appUrl}/api/certificate/abc`).html;

    case "course_completed":
      return buildCourseCompletedEmail("Jamie Robertson", "Equality & Diversity", `${appUrl}/learning/courses/abc`).html;

    case "leave_decision_approved":
      return baseTemplate(
        "Leave Approved",
        `<h2 style="color: #166534; font-size: 18px; margin: 0 0 8px;">Leave Approved</h2>
         <p style="font-size: 14px; color: #213350;">Your annual leave request has been <strong style="color: #166534;">approved</strong>.</p>
         <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
           <p style="font-size: 14px; color: #166534; margin: 0;">14 April 2026 – 18 April 2026</p>
           <p style="font-size: 13px; color: #6b7280; margin: 8px 0 0;">Note: Enjoy your break!</p>
         </div>
         <a href="${appUrl}/hr/leave" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; border: 2px solid #213350; text-decoration: none; font-size: 14px; font-weight: 500;">View Leave →</a>`,
        { preheader: "Your annual leave has been approved", emailType: "leave_decision" }
      );

    case "leave_decision_rejected":
      return baseTemplate(
        "Leave Declined",
        `<h2 style="color: #dc2626; font-size: 18px; margin: 0 0 8px;">Leave Request Declined</h2>
         <p style="font-size: 14px; color: #213350;">Your annual leave request for <strong>14 April 2026 – 18 April 2026</strong> has been <strong style="color: #dc2626;">declined</strong>.</p>
         <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fecaca;">
           <p style="font-size: 14px; color: #991b1b; margin: 0;">Reason: We need cover for the conference that week. Could you move it to the following week?</p>
         </div>
         <p style="font-size: 13px; color: #6b7280;">Please speak to your line manager if you have any questions.</p>
         <a href="${appUrl}/hr/leave" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; border: 2px solid #213350; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">View Leave →</a>`,
        { preheader: "Your annual leave request was declined", emailType: "leave_decision" }
      );

    case "compliance_expiry":
      return baseTemplate(
        "Compliance Reminder",
        `<h2 style="color: #92400e; font-size: 18px; margin: 0 0 8px;">Document Expiry Reminder</h2>
         <p style="font-size: 14px; color: #213350;">Hi Jamie, your <strong>PVG Certificate</strong> expires in <strong style="color: #92400e;">14 days</strong>.</p>
         <p style="font-size: 14px; color: #213350;">Please arrange renewal as soon as possible.</p>`,
        { emailType: "compliance_expiry" }
      );

    case "compliance_expiry_admin":
      return baseTemplate(
        "Compliance Alert",
        `<h2 style="color: #dc2626; font-size: 18px; margin: 0 0 8px;">Compliance Document Expired</h2>
         <p style="font-size: 14px; color: #213350;">Hi Alex,</p>
         <div style="background: #fef2f2; padding: 12px 16px; border-radius: 8px; margin: 12px 0; border-left: 3px solid #dc2626;">
           <p style="font-size: 14px; color: #213350; margin: 0;"><strong>Jamie Robertson</strong> — PVG Certificate</p>
           <p style="font-size: 13px; color: #dc2626; margin: 4px 0 0; font-weight: 600;">Expired</p>
         </div>
         <a href="${appUrl}/hr/users/abc-123" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">View Employee →</a>`,
        { emailType: "compliance_expiry" }
      );

    case "stale_leave_reminder":
      return baseTemplate(
        "Stale Leave Request",
        `<h2 style="color: #92400e; font-size: 18px; margin: 0 0 8px;">Pending Leave Request</h2>
         <p style="font-size: 14px; color: #213350;">Hi Alex, a leave request needs your attention.</p>
         <div style="background: #fffbeb; padding: 12px 16px; border-radius: 8px; margin: 12px 0; border-left: 3px solid #92400e;">
           <p style="font-size: 14px; color: #213350; margin: 0;"><strong>Jamie Robertson</strong> — annual leave (14 Apr 2026 – 18 Apr 2026)</p>
           <p style="font-size: 13px; color: #92400e; margin: 4px 0 0; font-weight: 600;">Pending for 12 days</p>
         </div>
         <a href="${appUrl}/hr/leave?tab=approvals" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">Review Requests →</a>`,
        { emailType: "stale_leave_reminder" }
      );

    case "key_date_reminder":
      return baseTemplate(
        "Probation Reminder",
        `<h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">Probation Period Ending</h2>
         <p style="font-size: 14px; color: #213350;">Hi Alex,</p>
         <div style="background: #F2F4F7; padding: 12px 16px; border-radius: 8px; margin: 12px 0;">
           <p style="font-size: 14px; color: #213350; margin: 0;"><strong>Jamie Robertson</strong></p>
           <p style="font-size: 13px; color: #6b7280; margin: 4px 0 0;">Probation ends: <strong>25 April 2026</strong> (14 days)</p>
         </div>
         <p style="font-size: 14px; color: #213350;">Please arrange a review meeting before this date.</p>`,
        { emailType: "key_date_reminder" }
      );

    case "welcome":
      return buildWelcomeEmail("Jamie Robertson", appUrl).html;

    default:
      return null;
  }
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (!type) {
    const types = [
      ...Object.keys(EMAIL_THEME_CONFIG),
      "leave_decision_approved",
      "leave_decision_rejected",
      "compliance_expiry_admin",
    ];
    const links = types.map((t) => `<li><a href="?type=${t}">${t}</a></li>`).join("");

    return new Response(
      `<!DOCTYPE html><html><head><title>Email Previews</title></head>
       <body style="font-family: sans-serif; max-width: 600px; margin: 40px auto;">
         <h1>Email Template Previews</h1>
         <p>Click a type to preview:</p>
         <ul>${links}</ul>
       </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const html = buildPreviewHtml(type);
  if (!html) {
    return new Response(`Unknown email type: ${type}`, { status: 404 });
  }

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
