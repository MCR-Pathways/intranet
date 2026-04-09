import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { sanitizeRedirectPath } from "@/lib/url";
import { rateLimiters, getClientIp } from "@/lib/ratelimit";
import { sendWelcomeEmailIfNeeded } from "@/lib/email-queue";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // Rate limit by IP — prevents OTP brute-force
  if (rateLimiters) {
    const ip = getClientIp(request);
    const { success } = await rateLimiters.auth.limit(ip);
    if (!success) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("Too many attempts. Please try again later.")}`
      );
    }
  }
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeRedirectPath(searchParams.get("next") ?? "/intranet");

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (error) {
      logger.error("OTP verification error", { error });
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("Verification failed. Please try again.")}`
      );
    }

    if (data.user) {
      const email = data.user.email || "";

      // Validate email domain
      if (!email.toLowerCase().endsWith("@mcrpathways.org")) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(
            "Only @mcrpathways.org email addresses are allowed"
          )}`
        );
      }

      // Check induction status
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, induction_completed_at")
        .eq("id", data.user.id)
        .single();

      if (profile && !profile.induction_completed_at) {
        void sendWelcomeEmailIfNeeded(data.user.id, profile.email || email, profile.full_name)
          .catch((err) => logger.error("Failed to send welcome email", { error: err }));

        return NextResponse.redirect(`${origin}/intranet/induction`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No valid token, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
