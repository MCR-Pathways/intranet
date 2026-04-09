import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  baseTemplate,
  escapeHtml,
  buildWelcomeEmail,
  buildCourseAssignedEmail,
  buildCertificateEarnedEmail,
  buildCourseCompletedEmail,
  EMAIL_THEME_CONFIG,
} from "@/lib/email";
import { logger } from "@/lib/logger";

describe("escapeHtml", () => {
  it("escapes all 5 HTML characters", () => {
    expect(escapeHtml('&<>"\'')).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("leaves safe strings unchanged", () => {
    expect(escapeHtml("Hello world")).toBe("Hello world");
  });
});

describe("EMAIL_THEME_CONFIG", () => {
  it("has entries for all active email types", () => {
    const expectedTypes = [
      "mention", "course_assigned", "course_overdue_digest", "course_overdue_manager",
      "leave_decision", "stale_leave_reminder", "compliance_expiry", "key_date_reminder",
      "certificate_earned", "course_completed", "welcome",
    ];
    for (const type of expectedTypes) {
      expect(EMAIL_THEME_CONFIG[type]).toBeDefined();
    }
  });

  it("Group A types use light logo variant", () => {
    const groupA = ["mention", "course_assigned", "course_overdue_digest", "course_overdue_manager", "leave_decision", "stale_leave_reminder"];
    for (const type of groupA) {
      expect(EMAIL_THEME_CONFIG[type].logoVariant).toBe("light");
    }
  });

  it("Group B types use dark logo variant", () => {
    const groupB = ["compliance_expiry", "key_date_reminder", "certificate_earned", "course_completed", "welcome"];
    for (const type of groupB) {
      expect(EMAIL_THEME_CONFIG[type].logoVariant).toBe("dark");
    }
  });
});

describe("baseTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses default Dark Blue theme when no emailType provided", () => {
    const html = baseTemplate("Test", "<p>Body</p>");
    expect(html).toContain("background: #213350");
    expect(html).toContain("mcr-logo-email-white.png");
  });

  it("applies correct accent colour for a Group A type", () => {
    const html = baseTemplate("Test", "<p>Body</p>", { emailType: "mention" });
    expect(html).toContain("background: #751B48");
    expect(html).toContain("mcr-logo-email-white.png");
  });

  it("applies correct accent colour for a Group B type", () => {
    const html = baseTemplate("Test", "<p>Body</p>", { emailType: "certificate_earned" });
    expect(html).toContain("background: #B5E046");
    expect(html).toContain("mcr-logo-email.png");
  });

  it("uses white logo for Group A types", () => {
    const html = baseTemplate("Test", "<p>Body</p>", { emailType: "course_assigned" });
    expect(html).toContain("mcr-logo-email-white.png");
  });

  it("uses dark logo for Group B types", () => {
    const html = baseTemplate("Test", "<p>Body</p>", { emailType: "compliance_expiry" });
    expect(html).toContain("/mcr-logo-email.png");
    expect(html).not.toContain("mcr-logo-email-white.png");
  });

  it("logs warning for unknown emailType", () => {
    baseTemplate("Test", "<p>Body</p>", { emailType: "nonexistent_type" });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("nonexistent_type")
    );
  });

  it("falls back to default theme for unknown emailType", () => {
    const html = baseTemplate("Test", "<p>Body</p>", { emailType: "nonexistent_type" });
    expect(html).toContain("background: #213350");
  });

  it("renders preheader when provided", () => {
    const html = baseTemplate("Test", "<p>Body</p>", { preheader: "Preview text" });
    expect(html).toContain("Preview text");
    expect(html).toContain("display: none");
  });

  it("omits preheader when not provided", () => {
    const html = baseTemplate("Test", "<p>Body</p>");
    expect(html).not.toContain("mso-hide: all");
  });

  it("escapes the title in the HTML title tag", () => {
    const html = baseTemplate("<script>alert('xss')</script>", "<p>Body</p>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("renders footer with preferences link and helpdesk contact", () => {
    const html = baseTemplate("Test", "<p>Body</p>");
    expect(html).toContain("Manage email preferences");
    expect(html).toContain("Something not right?");
    expect(html).toContain("helpdesk@mcrpathways.org");
    expect(html).toContain("/settings");
  });

  it("does not contain MCR Pathways Intranet text in footer", () => {
    const html = baseTemplate("Test", "<p>Body</p>");
    expect(html).not.toContain("MCR Pathways Intranet");
  });

  it("uses contained header with rounded corners", () => {
    const html = baseTemplate("Test", "<p>Body</p>");
    expect(html).toContain("border-radius: 12px 12px 0 0");
    expect(html).toContain("border-radius: 0 0 12px 12px");
  });

  it("includes body content", () => {
    const html = baseTemplate("Test", "<p>Hello world</p>");
    expect(html).toContain("<p>Hello world</p>");
  });
});

describe("buildWelcomeEmail", () => {
  it("returns correct subject", () => {
    const { subject } = buildWelcomeEmail("Jamie");
    expect(subject).toBe("Welcome to the MCR Pathways Intranet");
  });

  it("includes the user name in greeting", () => {
    const { html } = buildWelcomeEmail("Jamie Robertson");
    expect(html).toContain("Welcome aboard, Jamie Robertson!");
  });

  it("references the induction plan", () => {
    const { html } = buildWelcomeEmail("Jamie");
    expect(html).toContain("induction plan");
    expect(html).toContain("/intranet/induction");
    expect(html).toContain("Start Your Induction");
  });

  it("uses Green theme", () => {
    const { html } = buildWelcomeEmail("Jamie");
    expect(html).toContain("background: #B5E046");
  });

  it("escapes HTML in name", () => {
    const { html } = buildWelcomeEmail('<script>alert("xss")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("buildCourseAssignedEmail", () => {
  it("uses Teal theme", () => {
    const { html } = buildCourseAssignedEmail("Jamie", "Test Course", null, "https://example.com");
    expect(html).toContain("background: #2A6075");
  });
});

describe("buildCertificateEarnedEmail", () => {
  it("uses Green theme", () => {
    const { html } = buildCertificateEarnedEmail("Jamie", "Test Course", "CERT-001", "https://example.com");
    expect(html).toContain("background: #B5E046");
  });

  it("includes personalised congratulatory heading", () => {
    const { html } = buildCertificateEarnedEmail("Jamie", "Test Course", "CERT-001", "https://example.com");
    expect(html).toContain("Congratulations, Jamie!");
  });

  it("shows course title prominently in certificate box", () => {
    const { html } = buildCertificateEarnedEmail("Jamie", "Test Course", "CERT-001", "https://example.com");
    expect(html).toContain("font-size: 16px");
    expect(html).toContain("Test Course");
  });
});

describe("buildCourseCompletedEmail", () => {
  it("uses Green theme", () => {
    const { html } = buildCourseCompletedEmail("Jamie", "Test Course", "https://example.com");
    expect(html).toContain("background: #B5E046");
  });

  it("includes personalised heading", () => {
    const { html } = buildCourseCompletedEmail("Jamie", "Test Course", "https://example.com");
    expect(html).toContain("Well done, Jamie!");
  });

  it("includes course title in styled box", () => {
    const { html } = buildCourseCompletedEmail("Jamie", "Test Course", "https://example.com");
    expect(html).toContain("Test Course");
    expect(html).toContain("#f0fdf4");
  });
});
