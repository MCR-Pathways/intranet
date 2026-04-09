import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockSendEmail = vi.hoisted(() =>
  vi.fn<() => Promise<{ success: boolean; error?: string }>>()
);

const mockInsert = vi.hoisted(() => vi.fn());
const _mockSelect = vi.hoisted(() => vi.fn());
const _mockEq = vi.hoisted(() => vi.fn());
const mockSingle = vi.hoisted(() => vi.fn());

const mockFrom = vi.hoisted(() =>
  vi.fn((table: string) => {
    if (table === "email_preferences") {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.single = mockSingle;
      return chain;
    }
    return { insert: mockInsert };
  })
);

const mockCreateServiceClient = vi.hoisted(() =>
  vi.fn(() => ({ from: mockFrom }))
);

vi.mock("@/lib/email", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { sendAndLogEmail } from "@/lib/email-queue";

// ── Test data ────────────────────────────────────────────────────────────────

const baseParams = {
  userId: "user-123",
  email: "test@mcrpathways.co.uk",
  emailType: "leave_decision",
  subject: "Leave approved",
  bodyHtml: "<p>Your leave was approved</p>",
  entityId: "leave-456",
  entityType: "leave_request",
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("sendAndLogEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: preference check returns no row (default enabled)
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("skips send when user has disabled the email type", async () => {
    // Use an optional type (mention) and mock preference as disabled
    mockSingle.mockResolvedValue({ data: { enabled: false }, error: null });

    const result = await sendAndLogEmail({
      ...baseParams,
      emailType: "mention", // optional type — can be disabled
    });

    expect(result).toEqual({ success: true, sent: false });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("always sends mandatory email types regardless of preference", async () => {
    // Even if preference row says disabled, mandatory types send
    mockSingle.mockResolvedValue({ data: { enabled: false }, error: null });
    mockSendEmail.mockResolvedValue({ success: true });

    const result = await sendAndLogEmail(baseParams); // leave_decision is mandatory

    expect(result).toEqual({ success: true, sent: true });
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("sends email and logs as sent on success", async () => {
    mockSendEmail.mockResolvedValue({ success: true });

    const result = await sendAndLogEmail(baseParams);

    expect(result).toEqual({ success: true, sent: true });
    expect(mockSendEmail).toHaveBeenCalledWith(
      "test@mcrpathways.co.uk",
      "Leave approved",
      "<p>Your leave was approved</p>"
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        email_type: "leave_decision",
        status: "sent",
        retry_count: 0,
      })
    );
    // sent_at should be set for successful sends
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.sent_at).toBeTruthy();
  });

  it("logs as failed when send fails", async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: "Resend API error" });

    const result = await sendAndLogEmail(baseParams);

    expect(result).toEqual({ success: false, sent: false, error: "Resend API error" });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        sent_at: null,
        error_message: "Resend API error",
        retry_count: 0,
      })
    );
  });

  it("returns success when email sent but audit insert fails", async () => {
    mockSendEmail.mockResolvedValue({ success: true });
    mockInsert.mockResolvedValue({ error: { message: "DB insert failed" } });

    const result = await sendAndLogEmail(baseParams);

    expect(result).toEqual({ success: true, sent: true });
  });

  it("stores recipient email in metadata", async () => {
    mockSendEmail.mockResolvedValue({ success: true });

    await sendAndLogEmail(baseParams);

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.metadata.recipient_email).toBe("test@mcrpathways.co.uk");
  });
});
