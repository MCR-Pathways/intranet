import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    console.error("OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Code exchange error:", exchangeError);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
      );
    }

    if (data.user) {
      const email = data.user.email || "";

      // Validate email domain
      if (!email.toLowerCase().endsWith("@mcrpathways.org")) {
        // Sign out the user since they're not from the allowed domain
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(
            "Only @mcrpathways.org email addresses are allowed"
          )}`
        );
      }

      // Check if user has completed induction
      const { data: profile } = await supabase
        .from("profiles")
        .select("induction_completed_at, user_type, status")
        .eq("id", data.user.id)
        .single();

      // If profile doesn't exist yet (first login), the trigger should create it
      // Redirect to induction if not completed
      if (profile && !profile.induction_completed_at) {
        return NextResponse.redirect(`${origin}/intranet/induction`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
