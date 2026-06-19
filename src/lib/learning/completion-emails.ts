// Server-only: sends/queues completion emails via the service-role client.
// Never import in a client component.
import { logger } from "@/lib/logger";
import { sendAndLogEmail } from "@/lib/email-queue";
import { buildCertificateEarnedEmail, buildCourseCompletedEmail } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/service";

/** Send course completion + certificate emails (non-blocking). */
export async function sendCompletionEmails(userId: string, courseId: string): Promise<void> {
  try {
    const service = createServiceClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://intranet.mcrpathways.org";

    // Fetch user profile and course title
    const [{ data: profile }, { data: course }] = await Promise.all([
      service.from("profiles").select("id, full_name, email").eq("id", userId).single(),
      service.from("courses").select("title").eq("id", courseId).single(),
    ]);

    if (!profile || !course) return;

    // Check if a certificate was generated (by DB trigger)
    const { data: cert } = await service
      .from("certificates")
      .select("certificate_number")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .single();

    if (cert) {
      const { subject, html } = buildCertificateEarnedEmail(
        profile.full_name,
        course.title,
        cert.certificate_number,
        `${appUrl}/api/certificate/${userId}`
      );

      await sendAndLogEmail({
        userId: profile.id,
        email: profile.email,
        emailType: "certificate_earned",
        subject,
        bodyHtml: html,
        entityId: courseId,
        entityType: "course",
      });
    } else {
      // No certificate — send a simpler completion email
      const { subject, html } = buildCourseCompletedEmail(
        profile.full_name,
        course.title,
        `${appUrl}/learning/courses/${courseId}`
      );

      await sendAndLogEmail({
        userId: profile.id,
        email: profile.email,
        emailType: "course_completed",
        subject,
        bodyHtml: html,
        entityId: courseId,
        entityType: "course",
      });
    }
  } catch (err) {
    logger.error("Failed to queue completion emails", { error: err, userId, courseId });
  }
}
