import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that don't require authentication
const publicRoutes = ["/login", "/auth/callback", "/auth/confirm"];

// Module access by user type
const moduleAccess: Record<string, string[]> = {
  "/hr": ["staff"],
  "/sign-in": ["staff"],
  "/learning": ["staff", "pathways_coordinator"],
  "/intranet": ["staff", "pathways_coordinator"],
};

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

  // Fetch user profile for permission checks
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type, induction_completed_at, status")
    .eq("id", user.id)
    .single();

  // If no profile exists yet, allow access (trigger should create it)
  if (!profile) {
    return supabaseResponse;
  }

  // Check if user needs to complete induction
  const needsInduction =
    !profile.induction_completed_at &&
    profile.status === "pending_induction";

  // Allow access to induction page for users who need it
  if (pathname.startsWith("/intranet/induction")) {
    return supabaseResponse;
  }

  // Redirect to induction if not completed (except for dashboard which shows limited view)
  if (needsInduction && !pathname.startsWith("/dashboard")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/intranet/induction";
    return NextResponse.redirect(redirectUrl);
  }

  // Check module access
  for (const [modulePath, allowedTypes] of Object.entries(moduleAccess)) {
    if (pathname.startsWith(modulePath)) {
      if (!allowedTypes.includes(profile.user_type)) {
        // Redirect to dashboard if user doesn't have access
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/dashboard";
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  // Root path redirect
  if (pathname === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = needsInduction ? "/intranet/induction" : "/dashboard";
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
