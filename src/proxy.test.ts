import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Mock strategy for proxy (Next.js request handler):
 * We mock `@/lib/supabase/middleware` → `updateSession` to control:
 *   - Whether a user is authenticated (user object or null)
 *   - The user's app_metadata (JWT claims) for permission checks
 *
 * The proxy reads claims from user.app_metadata. When claims are
 * missing (pre-migration session), it falls back to a DB query via the
 * Supabase client returned from updateSession.
 */

const mockGetUser = vi.hoisted(() => vi.fn());
const mockSingle = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

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

import { proxy } from "@/proxy";

/** Helper: create a NextRequest for a given pathname */
function createRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

/** Helper: set up mocks for an authenticated user with JWT claims */
function mockAuthenticatedUser(claims: {
  user_type: string;
  induction_completed_at: string | null;
  status: string;
}) {
  mockGetUser.mockReturnValue({
    id: "user-1",
    app_metadata: {
      user_type: claims.user_type,
      status: claims.status,
      induction_completed_at: claims.induction_completed_at,
    },
  });
}

/** Helper: check if a response is a redirect to a given path */
function expectRedirectTo(response: NextResponse, expectedPath: string) {
  expect(response.status).toBe(307);
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  expect(new URL(location!).pathname).toBe(expectedPath);
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("public routes", () => {
    it("allows /login without authentication", async () => {
      const response = await proxy(createRequest("/login"));
      expect(response.status).toBe(200);
    });

    it("allows /auth/callback without authentication", async () => {
      const response = await proxy(createRequest("/auth/callback"));
      expect(response.status).toBe(200);
    });

    it("allows /auth/confirm without authentication", async () => {
      const response = await proxy(createRequest("/auth/confirm"));
      expect(response.status).toBe(200);
    });
  });

  describe("static files and API routes", () => {
    it("allows /_next paths", async () => {
      const response = await proxy(createRequest("/_next/static/chunk.js"));
      expect(response.status).toBe(200);
    });

    it("allows paths with file extensions", async () => {
      const response = await proxy(createRequest("/favicon.ico"));
      expect(response.status).toBe(200);
    });

    it("allows /api routes", async () => {
      const response = await proxy(createRequest("/api/health"));
      expect(response.status).toBe(200);
    });
  });

  describe("authentication", () => {
    it("redirects to /login when not authenticated", async () => {
      mockGetUser.mockReturnValue(null);

      const response = await proxy(createRequest("/intranet"));

      expectRedirectTo(response, "/login");
      const location = new URL(response.headers.get("location")!);
      expect(location.searchParams.get("next")).toBe("/intranet");
    });

    it("preserves the intended destination in the redirect URL", async () => {
      mockGetUser.mockReturnValue(null);

      const response = await proxy(createRequest("/learning/courses"));

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
      });

      const response = await proxy(createRequest("/hr/users"));
      expect(response.status).toBe(200);
    });

    it("redirects pathways_coordinator away from /hr", async () => {
      mockAuthenticatedUser({
        user_type: "pathways_coordinator",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await proxy(createRequest("/hr/users"));
      expectRedirectTo(response, "/intranet");
    });

    it("redirects pathways_coordinator away from /sign-in", async () => {
      mockAuthenticatedUser({
        user_type: "pathways_coordinator",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await proxy(createRequest("/sign-in"));
      expectRedirectTo(response, "/intranet");
    });

    it("allows pathways_coordinator to access /learning", async () => {
      mockAuthenticatedUser({
        user_type: "pathways_coordinator",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await proxy(createRequest("/learning/courses"));
      expect(response.status).toBe(200);
    });

    it("allows pathways_coordinator to access /intranet", async () => {
      mockAuthenticatedUser({
        user_type: "pathways_coordinator",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await proxy(createRequest("/intranet"));
      expect(response.status).toBe(200);
    });

    it("allows staff to access /learning", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await proxy(createRequest("/learning"));
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

      const response = await proxy(createRequest("/learning"));
      expectRedirectTo(response, "/intranet/induction");
    });

    it("allows pending_induction users to access /intranet/induction", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: null,
        status: "pending_induction",
      });

      const response = await proxy(createRequest("/intranet/induction"));
      expect(response.status).toBe(200);
    });

    it("allows pending_induction users to access induction sub-pages", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: null,
        status: "pending_induction",
      });

      const response = await proxy(
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

      const response = await proxy(createRequest("/intranet"));
      expectRedirectTo(response, "/intranet/induction");
    });

    it("redirects completed users away from induction sub-pages", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await proxy(
        createRequest("/intranet/induction/gdpr")
      );
      expectRedirectTo(response, "/intranet");
    });

    it("redirects completed users away from /intranet/induction root", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await proxy(
        createRequest("/intranet/induction")
      );
      expectRedirectTo(response, "/intranet");
    });
  });

  describe("sign-in access", () => {
    it("allows staff to access /sign-in", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await proxy(createRequest("/sign-in"));
      expect(response.status).toBe(200);
    });

    it("allows staff to access routes without signing in today", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await proxy(createRequest("/intranet"));
      expect(response.status).toBe(200);
    });
  });

  describe("root redirect", () => {
    it("redirects / to /intranet for active staff", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: "2024-01-01",
        status: "active",
      });

      const response = await proxy(createRequest("/"));
      expectRedirectTo(response, "/intranet");
    });

    it("redirects / to /intranet/induction for pending users", async () => {
      mockAuthenticatedUser({
        user_type: "staff",
        induction_completed_at: null,
        status: "pending_induction",
      });

      const response = await proxy(createRequest("/"));
      expectRedirectTo(response, "/intranet/induction");
    });
  });

  describe("missing claims (fallback to DB)", () => {
    it("falls back to DB query when JWT claims are missing", async () => {
      mockGetUser.mockReturnValue({ id: "old-user", app_metadata: {} });
      mockSingle.mockResolvedValue({
        data: {
          user_type: "staff",
          status: "active",
          induction_completed_at: "2024-01-01",
        },
        error: null,
      });
      mockEq.mockReturnValue({ single: mockSingle });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const response = await proxy(createRequest("/intranet"));
      expect(response.status).toBe(200);
      expect(mockFrom).toHaveBeenCalledWith("profiles");
    });

    it("allows access when no profile exists (new user, trigger should create it)", async () => {
      mockGetUser.mockReturnValue({ id: "new-user", app_metadata: {} });
      mockSingle.mockResolvedValue({ data: null, error: null });
      mockEq.mockReturnValue({ single: mockSingle });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const response = await proxy(createRequest("/intranet"));
      expect(response.status).toBe(200);
    });

    it("enforces module access even with fallback DB query", async () => {
      mockGetUser.mockReturnValue({ id: "old-user", app_metadata: {} });
      mockSingle.mockResolvedValue({
        data: {
          user_type: "pathways_coordinator",
          status: "active",
          induction_completed_at: "2024-01-01",
        },
        error: null,
      });
      mockEq.mockReturnValue({ single: mockSingle });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const response = await proxy(createRequest("/hr/users"));
      expectRedirectTo(response, "/intranet");
    });
  });
});
