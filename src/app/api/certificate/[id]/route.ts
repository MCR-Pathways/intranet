import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCertificatePdf } from "@/lib/certificates";
import { logger } from "@/lib/logger";

/**
 * GET /api/certificate/[id]
 * Generates and streams a PDF certificate for a completed course.
 * The [id] parameter is the course_id.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const supabase = await createClient();

  // Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Fetch the certificate record
  const { data: certificate, error: certError } = await supabase
    .from("certificates")
    .select("id, certificate_number, issued_at, course_id, user_id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .single();

  if (certError || !certificate) {
    return NextResponse.json(
      { error: "Certificate not found. Course may not be completed." },
      { status: 404 }
    );
  }

  // Fetch user profile and course title
  const [{ data: profile }, { data: course }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single(),
    supabase
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .single(),
  ]);

  if (!profile || !course) {
    return NextResponse.json(
      { error: "Could not load certificate data" },
      { status: 500 }
    );
  }

  try {
    const pdfBuffer = await generateCertificatePdf({
      recipientName: profile.full_name ?? "Learner",
      courseTitle: course.title,
      completionDate: new Date(certificate.issued_at).toLocaleDateString(
        "en-GB",
        { day: "numeric", month: "long", year: "numeric" }
      ),
      certificateNumber: certificate.certificate_number,
    });

    const fileName = `MCR-Certificate-${course.title.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    logger.error("Failed to generate certificate PDF", { error });
    return NextResponse.json(
      { error: "Failed to generate certificate" },
      { status: 500 }
    );
  }
}
