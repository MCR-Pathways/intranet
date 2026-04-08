/**
 * Email notification utilities using Resend.
 *
 * Provides email template builders and the sendEmail() function.
 * Emails are sent immediately via sendAndLogEmail() in email-queue.ts
 * and logged to the email_notifications table as an audit trail.
 *
 * Server-only — requires RESEND_API_KEY environment variable.
 */

import { logger } from "@/lib/logger";

// ─── Resend Client ──────────────────────────────────────────────────────────

let resendClient: import("resend").Resend | null = null;

async function getResendClient() {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not configured — emails will not be sent");
    return null;
  }

  const { Resend } = await import("resend");
  resendClient = new Resend(apiKey);
  return resendClient;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Escape user-supplied strings for safe HTML interpolation. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Email Templates ────────────────────────────────────────────────────────

const FROM_ADDRESS = "MCR Pathways <noreply@mcrpathways.co.uk>";

export function baseTemplate(title: string, body: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F2F4F7; margin: 0; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <div style="background: #213350; padding: 20px 24px; text-align: center;">
          <span style="color: white; font-size: 18px; font-weight: 700;">MCR Pathways</span>
        </div>
        <div style="padding: 24px;">
          ${body}
        </div>
        <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
          MCR Pathways Intranet · This is an automated message
        </div>
      </div>
    </body>
    </html>
  `;
}

export function buildCourseAssignedEmail(
  learnerName: string,
  courseTitle: string,
  dueDate: string | null,
  courseUrl: string
): { subject: string; html: string } {
  const safeName = escapeHtml(learnerName);
  const safeTitle = escapeHtml(courseTitle);
  const dueLine = dueDate
    ? `<p style="color: #92400e; font-size: 14px;">Due by: <strong>${escapeHtml(dueDate)}</strong></p>`
    : "";

  return {
    subject: `New course assigned: ${courseTitle}`,
    html: baseTemplate(
      "Course Assigned",
      `
        <h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">New Course Assigned</h2>
        <p style="color: #6b7280; font-size: 14px;">Hi ${safeName},</p>
        <p style="font-size: 14px; color: #213350;">You've been assigned a new course:</p>
        <div style="background: #F2F4F7; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="font-size: 16px; font-weight: 600; color: #213350; margin: 0;">${safeTitle}</p>
          ${dueLine}
        </div>
        <a href="${courseUrl}" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">View Course →</a>
      `
    ),
  };
}

export function buildCourseOverdueEmail(
  learnerName: string,
  courseTitle: string,
  daysRemaining: number,
  courseUrl: string
): { subject: string; html: string } {
  const safeName = escapeHtml(learnerName);
  const safeTitle = escapeHtml(courseTitle);
  const urgency = daysRemaining <= 1 ? "due tomorrow" : `due in ${daysRemaining} days`;

  return {
    subject: `Reminder: ${courseTitle} is ${urgency}`,
    html: baseTemplate(
      "Course Reminder",
      `
        <h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">Course Reminder</h2>
        <p style="color: #6b7280; font-size: 14px;">Hi ${safeName},</p>
        <p style="font-size: 14px; color: #213350;">Your course <strong>${safeTitle}</strong> is ${urgency}. Please complete it to stay compliant.</p>
        <a href="${courseUrl}" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 16px;">Continue Course →</a>
      `
    ),
  };
}

export function buildCertificateEarnedEmail(
  learnerName: string,
  courseTitle: string,
  certificateNumber: string,
  certificateUrl: string
): { subject: string; html: string } {
  const safeName = escapeHtml(learnerName);
  const safeTitle = escapeHtml(courseTitle);
  return {
    subject: `Certificate earned: ${courseTitle}`,
    html: baseTemplate(
      "Certificate Earned",
      `
        <h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">Congratulations!</h2>
        <p style="color: #6b7280; font-size: 14px;">Hi ${safeName},</p>
        <p style="font-size: 14px; color: #213350;">You've completed <strong>${safeTitle}</strong> and earned a certificate.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
          <p style="font-size: 14px; font-weight: 600; color: #166534; margin: 0;">Certificate of Completion</p>
          <p style="font-size: 12px; color: #166534; margin: 4px 0 0;">${escapeHtml(certificateNumber)}</p>
        </div>
        <a href="${certificateUrl}" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">View Certificate →</a>
      `
    ),
  };
}

export function buildCourseCompletedEmail(
  learnerName: string,
  courseTitle: string,
  courseUrl: string
): { subject: string; html: string } {
  const safeName = escapeHtml(learnerName);
  const safeTitle = escapeHtml(courseTitle);
  return {
    subject: `Course completed: ${courseTitle}`,
    html: baseTemplate(
      "Course Completed",
      `
        <h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">Well done!</h2>
        <p style="color: #6b7280; font-size: 14px;">Hi ${safeName},</p>
        <p style="font-size: 14px; color: #213350;">You've completed <strong>${safeTitle}</strong>.</p>
        <a href="${courseUrl}" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 16px;">View Course →</a>
      `
    ),
  };
}

// ─── Send Email ─────────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options?: { headers?: Record<string, string> }
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getResendClient();
    if (!client) {
      return { success: false, error: "Resend client not configured" };
    }

    const { error } = await client.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      ...(options?.headers ? { headers: options.headers } : {}),
    });

    if (error) {
      logger.error("Failed to send email", { to, subject, error });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("Email send error", {
      to,
      subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
