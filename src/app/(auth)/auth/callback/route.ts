import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/intranet";
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
      // Check if this is a database schema error (missing types/tables)
      const errorMessage = exchangeError.message.toLowerCase();
      if (
        errorMessage.includes("user_type") ||
        errorMessage.includes("does not exist") ||
        errorMessage.includes("transaction is aborted")
      ) {
        console.error(
          "Database schema error detected - migrations may not have been run"
        );
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(
            "Database configuration error. Please contact the administrator."
          )}`
        );
      }
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
      // Use try-catch to handle potential database errors gracefully
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("induction_completed_at, user_type, status")
          .eq("id", data.user.id)
          .single();

        if (profileError) {
          // Check for database schema errors
          const errorMessage = profileError.message.toLowerCase();
          const errorCode = profileError.code || "";

          if (
            errorMessage.includes("user_type") ||
            errorMessage.includes("does not exist") ||
            errorMessage.includes("transaction is aborted") ||
            errorCode === "42704" || // undefined_object (missing type)
            errorCode === "25P02" // in_failed_sql_transaction
          ) {
            console.error(
              "Database schema error during profile fetch:",
              profileError
            );
            await supabase.auth.signOut();
            return NextResponse.redirect(
              `${origin}/login?error=${encodeURIComponent(
                "Database configuration error. Please contact the administrator."
              )}`
            );
          }

          // Profile not found is expected for new users - trigger should create it
          // If it's a different error, log it but continue
          if (profileError.code !== "PGRST116") {
            console.error("Profile fetch error:", profileError);
          }
        }

        // If profile doesn't exist yet (first login), the trigger should create it
        // Redirect to induction if not completed
        if (profile && !profile.induction_completed_at) {
          return NextResponse.redirect(`${origin}/intranet/induction`);
        }
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
        // Don't block login for unexpected errors, but log them
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
