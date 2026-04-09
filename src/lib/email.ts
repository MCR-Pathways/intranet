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

// ─── Email Theme Config ────────────────────────────────────────────────────

type EmailTheme = {
  accent: string;
  logoVariant: "light" | "dark";
};

/** Colour-coded header themes per email type. See docs/design-system.md §6. */
export const EMAIL_THEME_CONFIG: Record<string, EmailTheme> = {
  // Group A — dark headers, white logo
  mention: { accent: "#751B48", logoVariant: "light" },
  course_assigned: { accent: "#2A6075", logoVariant: "light" },
  course_overdue_digest: { accent: "#DA417C", logoVariant: "light" },
  course_overdue_manager: { accent: "#DA417C", logoVariant: "light" },
  leave_decision: { accent: "#213350", logoVariant: "light" },
  stale_leave_reminder: { accent: "#213350", logoVariant: "light" },
  // Group B — bright headers, dark blue logo
  compliance_expiry: { accent: "#F09336", logoVariant: "dark" },
  key_date_reminder: { accent: "#F09336", logoVariant: "dark" },
  certificate_earned: { accent: "#B5E046", logoVariant: "dark" },
  course_completed: { accent: "#B5E046", logoVariant: "dark" },
  welcome: { accent: "#B5E046", logoVariant: "dark" },
};

const DEFAULT_THEME: EmailTheme = { accent: "#213350", logoVariant: "light" };

// ─── Email Templates ────────────────────────────────────────────────────────

const FROM_ADDRESS = "MCR Pathways <noreply@mcrpathways.co.uk>";

export function baseTemplate(title: string, body: string, options?: { preheader?: string; emailType?: string }): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.mcrpathways.org";
  const preheaderHtml = options?.preheader
    ? `<span style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escapeHtml(options.preheader)}</span>`
    : "";

  // Resolve theme from email type
  let theme = DEFAULT_THEME;
  if (options?.emailType) {
    const configured = EMAIL_THEME_CONFIG[options.emailType];
    if (configured) {
      theme = configured;
    } else {
      logger.warn(`Unknown emailType "${options.emailType}" — using default theme. Add it to EMAIL_THEME_CONFIG in email.ts`);
    }
  }

  const logoFile = theme.logoVariant === "light" ? "mcr-logo-email-white.png" : "mcr-logo-email.png";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F2F4F7; margin: 0; padding: 0;">
      ${preheaderHtml}
      <div style="max-width: 560px; margin: 0 auto; padding: 24px 24px 0;">
        <div style="background: ${theme.accent}; padding: 20px 0; text-align: center; border-radius: 12px 12px 0 0;">
          <img src="${appUrl}/${logoFile}" alt="MCR Pathways" width="120" height="36" style="display: inline-block;" />
        </div>
        <div style="background: white; border-radius: 0 0 12px 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <div style="padding: 24px; word-break: break-word;">
            ${body}
          </div>
        </div>
        <div style="padding: 16px 0; text-align: center; font-size: 13px; color: #4b5563; line-height: 1.6;">
          <a href="${appUrl}/settings" style="color: #4b5563; text-decoration: underline;">Manage email preferences</a>
          <br />
          Something not right? Contact <a href="mailto:helpdesk@mcrpathways.org" style="color: #4b5563; text-decoration: underline;">helpdesk@mcrpathways.org</a>
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
        <p style="font-size: 14px; color: #213350;">Hi ${safeName}, you've been assigned a new course:</p>
        <div style="background: #F2F4F7; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="font-size: 16px; font-weight: 600; color: #213350; margin: 0;">${safeTitle}</p>
          ${dueLine}
        </div>
        <a href="${courseUrl}" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; border: 2px solid #213350; text-decoration: none; font-size: 14px; font-weight: 500;">View Course →</a>
      `,
      { preheader: `New course: ${courseTitle}${dueDate ? ` — due by ${dueDate}` : ""}`, emailType: "course_assigned" }
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
        <h2 style="color: #166534; font-size: 18px; margin: 0 0 8px;">Congratulations, ${safeName}!</h2>
        <p style="font-size: 14px; color: #213350;">You've completed <strong>${safeTitle}</strong> and earned a certificate.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
          <p style="font-size: 16px; font-weight: 600; color: #166534; margin: 0;">${safeTitle}</p>
          <p style="font-size: 13px; color: #166534; margin: 8px 0 0;">Certificate: ${escapeHtml(certificateNumber)}</p>
        </div>
        <a href="${certificateUrl}" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; border: 2px solid #213350; text-decoration: none; font-size: 14px; font-weight: 500;">View Certificate →</a>
      `,
      { preheader: `You earned a certificate for ${courseTitle}`, emailType: "certificate_earned" }
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
        <h2 style="color: #166534; font-size: 18px; margin: 0 0 8px;">Well done, ${safeName}!</h2>
        <p style="font-size: 14px; color: #213350;">You've completed this course.</p>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
          <p style="font-size: 16px; font-weight: 600; color: #166534; margin: 0;">${safeTitle}</p>
        </div>
        <a href="${courseUrl}" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; border: 2px solid #213350; text-decoration: none; font-size: 14px; font-weight: 500;">View Course →</a>
      `,
      { preheader: `You completed ${courseTitle}`, emailType: "course_completed" }
    ),
  };
}

export function buildWelcomeEmail(
  name: string,
  appUrl?: string
): { subject: string; html: string } {
  const safeName = escapeHtml(name);
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.mcrpathways.org";

  return {
    subject: "Welcome to the MCR Pathways Intranet",
    html: baseTemplate(
      "Welcome",
      `
        <h2 style="color: #213350; font-size: 18px; margin: 0 0 8px;">Welcome aboard, ${safeName}!</h2>
        <p style="font-size: 14px; color: #213350;">The MCR Pathways Intranet is where you'll find company news, learning courses, HR tools, and resources.</p>
        <p style="font-size: 14px; color: #213350;">To get started, you have an induction plan to work through. It'll walk you through everything you need to know.</p>
        <a href="${url}/intranet/induction" style="display: inline-block; background: #213350; color: white; padding: 10px 20px; border-radius: 8px; border: 2px solid #213350; text-decoration: none; font-size: 14px; font-weight: 500; margin-top: 8px;">Start Your Induction →</a>
      `,
      { preheader: `Welcome to the team, ${name}! Here's how to get started.`, emailType: "welcome" }
    ),
  };
}

// ─── Send Email ─────────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  html: string
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
