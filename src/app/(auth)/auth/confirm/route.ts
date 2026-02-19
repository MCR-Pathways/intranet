import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/intranet";

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (error) {
      logger.error("OTP verification error", { error });
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
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
        .select("induction_completed_at")
        .eq("id", data.user.id)
        .single();

      if (profile && !profile.induction_completed_at) {
        return NextResponse.redirect(`${origin}/intranet/induction`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No valid token, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
