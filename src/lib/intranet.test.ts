import { describe, it, expect } from "vitest";
import {
  validateFile,
  isImageType,
  ATTACHMENT_MAX_SIZE_BYTES,
  validateKudosCategories,
  buildKudosSentenceParts,
  kudosSentencePlain,
  kudosNotificationTitle,
  KUDOS_CATEGORIES,
  type KudosCategory,
} from "@/lib/intranet";

// =============================================
// validateFile
// =============================================

describe("validateFile", () => {
  const createFile = (name: string, size: number, type: string): File => {
    const file = new File(["x"], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
  };

  it("returns null for a valid JPEG image", () => {
    expect(validateFile(createFile("photo.jpg", 1024, "image/jpeg"))).toBeNull();
  });

  it("returns null for a valid PNG image", () => {
    expect(validateFile(createFile("photo.png", 1024, "image/png"))).toBeNull();
  });

  it("returns null for a valid GIF image", () => {
    expect(validateFile(createFile("anim.gif", 1024, "image/gif"))).toBeNull();
  });

  it("returns null for a valid WebP image", () => {
    expect(validateFile(createFile("photo.webp", 1024, "image/webp"))).toBeNull();
  });

  it("returns null for a valid PDF document", () => {
    expect(validateFile(createFile("doc.pdf", 1024, "application/pdf"))).toBeNull();
  });

  it("returns null for a valid DOCX document", () => {
    expect(validateFile(createFile("doc.docx", 1024, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toBeNull();
  });

  it("returns null for a valid DOC document", () => {
    expect(validateFile(createFile("doc.doc", 1024, "application/msword"))).toBeNull();
  });

  it("returns error for file exceeding 50MB", () => {
    const result = validateFile(createFile("big.jpg", ATTACHMENT_MAX_SIZE_BYTES + 1, "image/jpeg"));
    expect(result).toContain("too large");
  });

  it("includes filename in error message", () => {
    const result = validateFile(createFile("huge-video.mp4", ATTACHMENT_MAX_SIZE_BYTES + 1, "video/mp4"));
    expect(result).toContain("huge-video.mp4");
  });

  it("returns error for unsupported type", () => {
    const result = validateFile(createFile("script.js", 1024, "application/javascript"));
    expect(result).toContain("unsupported file type");
  });

  it("returns error for executable", () => {
    const result = validateFile(createFile("virus.exe", 1024, "application/x-executable"));
    expect(result).toContain("unsupported file type");
  });

  it("returns size error before type error (size checked first)", () => {
    const result = validateFile(createFile("big-bad.exe", ATTACHMENT_MAX_SIZE_BYTES + 1, "application/x-executable"));
    expect(result).toContain("too large");
  });
});

// =============================================
// isImageType
// =============================================

describe("isImageType", () => {
  it("returns true for image/jpeg", () => {
    expect(isImageType("image/jpeg")).toBe(true);
  });

  it("returns true for image/png", () => {
    expect(isImageType("image/png")).toBe(true);
  });

  it("returns true for image/gif", () => {
    expect(isImageType("image/gif")).toBe(true);
  });

  it("returns true for image/webp", () => {
    expect(isImageType("image/webp")).toBe(true);
  });

  it("returns false for application/pdf", () => {
    expect(isImageType("application/pdf")).toBe(false);
  });

  it("returns false for application/msword", () => {
    expect(isImageType("application/msword")).toBe(false);
  });

  it("returns false for unknown type", () => {
    expect(isImageType("text/plain")).toBe(false);
  });
});

// =============================================
// validateKudosCategories
// =============================================

describe("validateKudosCategories", () => {
  it("rejects an empty selection", () => {
    expect(validateKudosCategories([])).toEqual({
      ok: false,
      error: "Pick a category for your kudos.",
    });
  });

  it("rejects more than two categories", () => {
    const result = validateKudosCategories([
      KUDOS_CATEGORIES.EXTRA_MILE,
      KUDOS_CATEGORIES.TEAM_PLAYER,
      KUDOS_CATEGORIES.BRIGHT_IDEA,
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown category value", () => {
    expect(validateKudosCategories(["Not a category"]).ok).toBe(false);
  });

  it("rejects 'Thank you' combined with another category", () => {
    const result = validateKudosCategories([
      KUDOS_CATEGORIES.THANK_YOU,
      KUDOS_CATEGORIES.TEAM_PLAYER,
    ]);
    expect(result.ok).toBe(false);
  });

  it("accepts 'Thank you' on its own", () => {
    expect(validateKudosCategories([KUDOS_CATEGORIES.THANK_YOU])).toEqual({
      ok: true,
      categories: [KUDOS_CATEGORIES.THANK_YOU],
    });
  });

  it("accepts a valid pair and de-duplicates", () => {
    const result = validateKudosCategories([
      KUDOS_CATEGORIES.EXTRA_MILE,
      KUDOS_CATEGORIES.EXTRA_MILE,
      KUDOS_CATEGORIES.TEAM_PLAYER,
    ]);
    expect(result).toEqual({
      ok: true,
      categories: [KUDOS_CATEGORIES.EXTRA_MILE, KUDOS_CATEGORIES.TEAM_PLAYER],
    });
  });
});

// =============================================
// Kudos sentence model
// =============================================

describe("kudosSentencePlain", () => {
  it("one recipient, one category", () => {
    expect(
      kudosSentencePlain("Marc", ["Aimee"], [KUDOS_CATEGORIES.EXTRA_MILE]),
    ).toBe("Marc sent kudos to Aimee for going the extra mile");
  });

  it("joins recipients with commas and a trailing 'and'", () => {
    expect(
      kudosSentencePlain(
        "Marc",
        ["Aimee", "Chris", "Dev"],
        [KUDOS_CATEGORIES.TEAM_PLAYER],
      ),
    ).toBe("Marc sent kudos to Aimee, Chris and Dev for being a team player");
  });

  it("joins two categories with 'and', dropping the second connector", () => {
    expect(
      kudosSentencePlain(
        "Marc",
        ["Aimee"],
        [KUDOS_CATEGORIES.EXTRA_MILE, KUDOS_CATEGORIES.TEAM_PLAYER],
      ),
    ).toBe(
      "Marc sent kudos to Aimee for going the extra mile and being a team player",
    );
  });

  it("uses the 'to' connector for Thank you", () => {
    expect(
      kudosSentencePlain("Marc", ["Aimee"], [KUDOS_CATEGORIES.THANK_YOU]),
    ).toBe("Marc sent kudos to Aimee to say thank you");
  });
});

describe("buildKudosSentenceParts", () => {
  it("bolds the sender, recipients, and category bodies only", () => {
    const parts = buildKudosSentenceParts(
      "Marc",
      ["Aimee", "Chris"],
      [KUDOS_CATEGORIES.EXTRA_MILE],
    );
    const bold = parts.filter((p) => p.bold).map((p) => p.text);
    expect(bold).toEqual(["Marc", "Aimee", "Chris", "going the extra mile"]);
  });

  it("drops an unknown category instead of throwing (deprecation drift)", () => {
    expect(
      kudosSentencePlain("Marc", ["Aimee"], ["Ghost" as KudosCategory]),
    ).toBe("Marc sent kudos to Aimee");
    expect(kudosNotificationTitle("Marc", ["Ghost" as KudosCategory])).toBe(
      "Marc sent you kudos",
    );
  });
});

describe("kudosNotificationTitle", () => {
  it("phrases the title in the second person", () => {
    expect(
      kudosNotificationTitle("Marc", [KUDOS_CATEGORIES.EXTRA_MILE]),
    ).toBe("Marc sent you kudos for going the extra mile");
  });

  it("covers two categories", () => {
    expect(
      kudosNotificationTitle("Marc", [
        KUDOS_CATEGORIES.EXTRA_MILE,
        KUDOS_CATEGORIES.TEAM_PLAYER,
      ]),
    ).toBe("Marc sent you kudos for going the extra mile and being a team player");
  });

  it("uses the 'to' connector for Thank you", () => {
    expect(kudosNotificationTitle("Marc", [KUDOS_CATEGORIES.THANK_YOU])).toBe(
      "Marc sent you kudos to say thank you",
    );
  });
});
