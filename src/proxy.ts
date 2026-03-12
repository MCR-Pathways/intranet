import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that don't require authentication
const publicRoutes = ["/login", "/auth/callback", "/auth/confirm", "/kiosk"];

// Module access by user type and external status
// Internal staff: full access to all modules
// External staff (PCs): Learning + Intranet only
// Staff-only modules (no external access): HR, Sign-In
const internalOnlyModules = ["/hr", "/sign-in"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // Static files like favicon, images
  ) {
    return NextResponse.next();
  }

  // Get session and user
  const { supabaseResponse, user, supabase } = await updateSession(request);

  // Redirect to login if not authenticated
  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Read claims from JWT — synced by DB trigger, no round-trip needed
  const claims = user.app_metadata as {
    user_type?: string;
    status?: string;
    induction_completed_at?: string | null;
    department?: string | null;
    is_hr_admin?: boolean;
    is_ld_admin?: boolean;
    is_systems_admin?: boolean;
    is_external?: boolean;
    is_content_editor?: boolean;
  };

  let profile: {
    user_type: string;
    status: string;
    induction_completed_at: string | null;
    is_external: boolean;
  };

  if (claims.user_type) {
    // Fast path: read from JWT claims
    profile = {
      user_type: claims.user_type,
      status: claims.status ?? "pending_induction",
      induction_completed_at: claims.induction_completed_at ?? null,
      is_external: claims.is_external ?? false,
    };
  } else {
    // Fallback: pre-migration session without claims — query the DB
    const { data: dbProfile } = await supabase
      .from("profiles")
      .select("user_type, induction_completed_at, status, is_external")
      .eq("id", user.id)
      .single();

    if (!dbProfile) {
      return supabaseResponse;
    }

    profile = {
      user_type: dbProfile.user_type,
      status: dbProfile.status,
      induction_completed_at: dbProfile.induction_completed_at,
      is_external: dbProfile.is_external ?? false,
    };
  }

  // Check if user needs to complete induction
  const needsInduction =
    !profile.induction_completed_at &&
    profile.status === "pending_induction";

  // Allow access to induction pages only for users who still need induction.
  // Completed users are redirected away (covers sub-routes like /intranet/induction/gdpr
  // which have no page-level guard). The needsInduction check also prevents redirect
  // loops for new_user types who lack /intranet module access.
  if (pathname.startsWith("/intranet/induction")) {
    if (needsInduction) {
      return supabaseResponse;
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/intranet";
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect to induction if not completed
  if (needsInduction) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/intranet/induction";
    return NextResponse.redirect(redirectUrl);
  }

  // Check module access
  if (profile.user_type === "staff") {
    // External staff (PCs) can only access Learning + Intranet
    if (profile.is_external) {
      if (internalOnlyModules.some((mod) => pathname.startsWith(mod))) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/intranet";
        return NextResponse.redirect(redirectUrl);
      }
    }
    // Internal staff: full access — no redirect needed
  } else {
    // Non-staff (new_user): if induction is pending, they were already redirected
    // above at line 107. Here they've completed induction but haven't been
    // promoted to staff yet — allow /intranet as a landing page, block the rest.
    const staffOnlyModules = ["/hr", "/sign-in", "/learning"];
    if (staffOnlyModules.some((mod) => pathname.startsWith(mod))) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/intranet";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Root path redirect
  if (pathname === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = needsInduction ? "/intranet/induction" : "/intranet";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
