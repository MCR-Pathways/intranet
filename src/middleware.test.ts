import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Mock strategy for middleware:
 * We mock `@/lib/supabase/middleware` → `updateSession` to control:
 *   - Whether a user is authenticated (user object or null)
 *   - The Supabase client used for profile fetching
 *
 * The middleware then uses the returned supabase client to call:
 *   supabase.from("profiles").select("user_type, induction_completed_at, status, last_sign_in_date")
 *     .eq("id", user.id).single()
 */

const mockSingle = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn().mockImplementation(async (request: NextRequest) => {
    const supabaseResponse = NextResponse.next({ request });
    const user = mockGetUser();
    return {
      supabaseResponse,
      user,
      supabase: { from: mockFrom },
    };
  }),
}));

import { middleware } from "@/middleware";

/** Today's date in YYYY-MM-DD format (matches middleware logic) */
const TODAY = new Date().toISOString().split("T")[0];

/** Yesterday's date in YYYY-MM-DD format */
const YESTERDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
})();

/** Helper: create a NextRequest for a given pathname */
function createRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

/** Helper: set up mocks for an authenticated user with a profile */
function mockAuthenticatedUser(profile: {
  user_type: string;
  induction_completed_at: string | null;
  status: string;
  last_sign_in_date?: string | null;
}) {
  mockGetUser.mockReturnValue({ id: "user-1" });
  mockSingle.mockResolvedValue({ data: profile, error: null });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

/** Helper: check if a response is a redirect to a given path */
function expectRedirectTo(response: NextResponse, expectedPath: string) {
  expect(response.status).toBe(307);
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  expect(new URL(location!).pathname).toBe(expectedPath);
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("public routes", () => {
    it("allows /login without authentication", async () => {
      const response = await middleware(createRequest("/login"));
      expect(response.status).toBe(200);
    });

    it("allows /auth/callback without authentication", async () => {
      const response = await middleware(createRequest("/auth/callback"));
      expect(response.status).toBe(200);
    });

    it("allows /auth/confirm without authentication", async () => {
      const response = await middleware(createRequest("/auth/confirm"));
      expect(response.status).toBe(200);
    });
  });

  describe("static files and API routes", () => {
    it("allows /_next paths", async () => {
      const response = await middleware(createRequest("/_next/static/chunk.js"));
      expect(response.status).toBe(200);
    });

    it("allows paths with file extensions", async () => {
      const response = await middleware(createRequest("/favicon.ico"));
      expect(response.status).toBe(200);
    });

    it("allows /api routes", async () => {
      const response = await middleware(createRequest("/api/health"));
      expect(response.status).toBe(200);
    });
  });

  describe("authentication", () => {
    it("redirects to /login when not authenticated", async () => {
      mockGetUser.mockReturnValue(null);

      const response = await middleware(createRequest("/intranet"));

      expectRedirectTo(response, "/login");
      const location = new URL(response.headers.get("location")!);
      expect(location.searchParams.get("next")).toBe("/intranet");
    });

    it("preserves the intended destination in the redirect URL", async () => {
      mockGetUser.mockReturnValue(null);

      const response = await middleware(createRequest("/learning/courses"));

      expectRedirectTo(response, "/login");
      const location = new URL(response.headers.get("location")!);
      expect(location.searchParams.get("next")).toBe("/learning/courses");
    });
  });

  describe("module access", () => {
    it("allows staff to access /hr", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
        last_sign_in_date: TODAY,
      });

      const response = await middleware(createRequest("/hr/users"));
      expect(response.status).toBe(200);
    });

    it("redirects pathways_coordinator away from /hr", async () => {
      mockAuthenticatedUser({
        user_type: "pathways_coordinator",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await middleware(createRequest("/hr/users"));
      expectRedirectTo(response, "/intranet");
    });

    it("redirects pathways_coordinator away from /sign-in", async () => {
      mockAuthenticatedUser({
        user_type: "pathways_coordinator",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await middleware(createRequest("/sign-in"));
      expectRedirectTo(response, "/intranet");
    });

    it("allows pathways_coordinator to access /learning", async () => {
      mockAuthenticatedUser({
        user_type: "pathways_coordinator",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await middleware(createRequest("/learning/courses"));
      expect(response.status).toBe(200);
    });

    it("allows pathways_coordinator to access /intranet", async () => {
      mockAuthenticatedUser({
        user_type: "pathways_coordinator",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await middleware(createRequest("/intranet"));
      expect(response.status).toBe(200);
    });

    it("allows staff to access /learning", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
        last_sign_in_date: TODAY,
      });

      const response = await middleware(createRequest("/learning"));
      expect(response.status).toBe(200);
    });
  });

  describe("induction redirects", () => {
    it("redirects pending_induction users to /intranet/induction from protected routes", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: null,
        status: "pending_induction",
      });

      const response = await middleware(createRequest("/learning"));
      expectRedirectTo(response, "/intranet/induction");
    });

    it("allows pending_induction users to access /intranet/induction", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: null,
        status: "pending_induction",
      });

      const response = await middleware(createRequest("/intranet/induction"));
      expect(response.status).toBe(200);
    });

    it("allows pending_induction users to access induction sub-pages", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: null,
        status: "pending_induction",
      });

      const response = await middleware(
        createRequest("/intranet/induction/welcome")
      );
      expect(response.status).toBe(200);
    });

    it("redirects pending_induction users from /intranet to induction", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: null,
        status: "pending_induction",
      });

      const response = await middleware(createRequest("/intranet"));
      expectRedirectTo(response, "/intranet/induction");
    });
  });

  describe("sign-in access", () => {
    it("allows staff to access /sign-in", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
        last_sign_in_date: null,
      });

      const response = await middleware(createRequest("/sign-in"));
      expect(response.status).toBe(200);
    });

    it("does not force sign-in redirect — staff can access routes without signing in", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
        last_sign_in_date: null,
      });

      const response = await middleware(createRequest("/intranet"));
      expect(response.status).toBe(200);
    });

    it("does not force sign-in redirect — staff with yesterday's date can access routes", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
        last_sign_in_date: YESTERDAY,
      });

      const response = await middleware(createRequest("/intranet"));
      expect(response.status).toBe(200);
    });
  });

  describe("root redirect", () => {
    it("redirects / to /intranet for active staff", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
        last_sign_in_date: null,
      });

      const response = await middleware(createRequest("/"));
      expectRedirectTo(response, "/intranet");
    });

    it("redirects / to /intranet for active staff with today's sign-in", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
        last_sign_in_date: TODAY,
      });

      const response = await middleware(createRequest("/"));
      expectRedirectTo(response, "/intranet");
    });

    it("redirects / to /intranet/induction for pending users", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: null,
        status: "pending_induction",
      });

      const response = await middleware(createRequest("/"));
      expectRedirectTo(response, "/intranet/induction");
    });
  });

  describe("no profile", () => {
    it("allows access when no profile exists (new user, trigger should create it)", async () => {
      mockGetUser.mockReturnValue({ id: "new-user" });
      mockSingle.mockResolvedValue({ data: null, error: null });
      mockEq.mockReturnValue({ single: mockSingle });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const response = await middleware(createRequest("/intranet"));
      expect(response.status).toBe(200);
    });
  });
});
