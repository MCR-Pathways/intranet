import { Resend } from "resend";
import { logger } from "@/lib/logger";

// Graceful fallback when RESEND_API_KEY is not configured
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export { resend };

export type EmailTemplate =
  | "courseAssigned"
  | "courseOverdue"
  | "certificateEarned";

export interface EmailData {
  courseAssigned: {
    courseName: string;
    courseUrl: string;
    assignedBy: string;
  };
  courseOverdue: {
    courseName: string;
    courseUrl: string;
    dueDate: string;
  };
  certificateEarned: {
    courseName: string;
    certificateUrl: string;
  };
}

const FROM_ADDRESS =
  "MCR Pathways Learning <learning@mcrpathways.org>";

function wrapInLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1B2B4B;padding:24px 32px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;font-size:20px;color:#ffffff;font-weight:bold;letter-spacing:1px;">MCR Pathways Learning</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:0;">
              <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">MCR Pathways &mdash; Unlocking the potential of disadvantaged young people</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getEmailHtml<T extends EmailTemplate>(
  template: T,
  data: EmailData[T]
): string {
  switch (template) {
    case "courseAssigned": {
      const d = data as EmailData["courseAssigned"];
      return wrapInLayout(`
        <h2 style="margin:0 0 16px;font-size:22px;color:#1B2B4B;">Course Assigned</h2>
        <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">
          You have been assigned a new course by <strong>${escapeHtml(d.assignedBy)}</strong>.
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
          <strong>Course:</strong> ${escapeHtml(d.courseName)}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background-color:#1B2B4B;border-radius:6px;padding:12px 24px;">
              <a href="${escapeHtml(d.courseUrl)}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;">View Course</a>
            </td>
          </tr>
        </table>
      `);
    }
    case "courseOverdue": {
      const d = data as EmailData["courseOverdue"];
      return wrapInLayout(`
        <h2 style="margin:0 0 16px;font-size:22px;color:#1B2B4B;">Course Overdue</h2>
        <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">
          Your assigned course is now overdue. Please complete it as soon as possible.
        </p>
        <p style="margin:0 0 8px;font-size:15px;color:#334155;line-height:1.6;">
          <strong>Course:</strong> ${escapeHtml(d.courseName)}
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
          <strong>Due date:</strong> ${escapeHtml(d.dueDate)}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background-color:#1B2B4B;border-radius:6px;padding:12px 24px;">
              <a href="${escapeHtml(d.courseUrl)}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;">View Course</a>
            </td>
          </tr>
        </table>
      `);
    }
    case "certificateEarned": {
      const d = data as EmailData["certificateEarned"];
      return wrapInLayout(`
        <h2 style="margin:0 0 16px;font-size:22px;color:#1B2B4B;">Congratulations!</h2>
        <p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.6;">
          Well done! You have successfully completed the following course:
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
          <strong>Course:</strong> ${escapeHtml(d.courseName)}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background-color:#1B2B4B;border-radius:6px;padding:12px 24px;">
              <a href="${escapeHtml(d.certificateUrl)}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;">View Certificate</a>
            </td>
          </tr>
        </table>
      `);
    }
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

export function getEmailSubject<T extends EmailTemplate>(
  template: T,
  data: EmailData[T]
): string {
  switch (template) {
    case "courseAssigned": {
      const d = data as EmailData["courseAssigned"];
      return `New course assigned: ${d.courseName}`;
    }
    case "courseOverdue": {
      const d = data as EmailData["courseOverdue"];
      return `Course overdue: ${d.courseName}`;
    }
    case "certificateEarned": {
      const d = data as EmailData["certificateEarned"];
      return `Certificate earned: ${d.courseName}`;
    }
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

export async function sendEmail<T extends EmailTemplate>(
  to: string,
  template: T,
  data: EmailData[T]
): Promise<{ success: boolean; error: string | null }> {
  if (!resend) {
    logger.warn("RESEND_API_KEY is not configured — email not sent", {
      to,
      template,
    });
    return { success: true, error: null };
  }

  try {
    const html = getEmailHtml(template, data);
    const subject = getEmailSubject(template, data);

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error("Failed to send email via Resend", {
        to,
        template,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.info("Email sent successfully", { to, template });
    return { success: true, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error sending email";
    logger.error("Email sending threw an exception", {
      to,
      template,
      error: message,
    });
    return { success: false, error: message };
  }
}

/** Escape HTML special characters to prevent injection in email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
