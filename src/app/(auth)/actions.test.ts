import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy: Mock createClient() from @/lib/supabase/server
 * since signOutAction uses it directly (not getCurrentUser).
 */

const mockSignOut = vi.hoisted(() => vi.fn());

const mockSupabase = vi.hoisted(() => ({
  auth: { signOut: mockSignOut },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { signOutAction } from "@/app/(auth)/actions";
import { redirect } from "next/navigation";

describe("signOutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("calls supabase.auth.signOut()", async () => {
    await signOutAction();

    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it("redirects to /login after sign out", async () => {
    await signOutAction();

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("calls signOut before redirect", async () => {
    const callOrder: string[] = [];
    mockSignOut.mockImplementation(async () => {
      callOrder.push("signOut");
      return { error: null };
    });
    vi.mocked(redirect).mockImplementation((() => {
      callOrder.push("redirect");
    }) as never);

    await signOutAction();

    expect(callOrder).toEqual(["signOut", "redirect"]);
  });
});
