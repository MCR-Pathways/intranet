import { describe, it, expect, vi, beforeEach } from "vitest";

// Set the Algolia env (read at module load) and create the client spies before
// `@/lib/algolia` is imported. vi.hoisted runs above the import below.
const mocks = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID = "test-app";
  process.env.ALGOLIA_ADMIN_KEY = "test-admin";
  return { saveObjects: vi.fn(), deleteObjects: vi.fn() };
});

vi.mock("algoliasearch", () => ({
  algoliasearch: () => ({
    saveObjects: mocks.saveObjects,
    deleteObjects: mocks.deleteObjects,
  }),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  buildPostRecord,
  resolveSearchAuthorName,
  indexPost,
  removePostFromIndex,
  NEWS_INDEX,
} from "@/lib/algolia";

describe("buildPostRecord", () => {
  it("builds a news record with the excerpt taken from the body's first line", () => {
    const record = buildPostRecord({
      postId: "post-1",
      content: "First line of the post\nMore body text here",
      authorName: "Priya Shah",
      createdAt: "2026-06-20T10:00:00.000Z",
    });
    expect(record).toMatchObject({
      objectID: "post-1",
      postId: "post-1",
      excerpt: "First line of the post",
      authorName: "Priya Shah",
      createdAt: "2026-06-20T10:00:00.000Z",
      createdAtTimestamp: new Date("2026-06-20T10:00:00.000Z").getTime(),
      _type: "news",
    });
    expect(record.content).toContain("First line of the post");
  });

  it("folds the poll question into searchable content but keeps the body as the excerpt", () => {
    const record = buildPostRecord({
      postId: "poll-1",
      content: "Quick one for the team",
      pollQuestion: "Should we move the all-hands to Thursday?",
      authorName: "A",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(record.excerpt).toBe("Quick one for the team");
    expect(record.content).toContain("Should we move the all-hands to Thursday?");
  });

  it("truncates over-long content to the Algolia byte cap", () => {
    const record = buildPostRecord({
      postId: "post-2",
      content: "x".repeat(20000),
      authorName: "A",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(Buffer.byteLength(record.content, "utf8")).toBeLessThanOrEqual(8000);
  });

  it("clips a long single-line excerpt to 120 chars plus a 2-char ellipsis", () => {
    const record = buildPostRecord({
      postId: "post-3",
      content: "y".repeat(400),
      authorName: "A",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(record.excerpt.length).toBeLessThanOrEqual(122); // 120 + " …"
    expect(record.excerpt.endsWith(" …")).toBe(true);
  });
});

describe("resolveSearchAuthorName", () => {
  it("prefers preferred_name", () => {
    expect(
      resolveSearchAuthorName({ preferred_name: "Pri", full_name: "Priya Shah" })
    ).toBe("Pri");
  });

  it("falls back to full_name when preferred_name is blank", () => {
    expect(
      resolveSearchAuthorName({ preferred_name: "   ", full_name: "Priya Shah" })
    ).toBe("Priya Shah");
  });

  it("handles the array form of the to-one join", () => {
    expect(
      resolveSearchAuthorName([{ preferred_name: null, full_name: "Sam Lee" }])
    ).toBe("Sam Lee");
  });

  it("falls back to the org name when the author is missing or empty", () => {
    expect(resolveSearchAuthorName(null)).toBe("MCR Pathways");
    expect(resolveSearchAuthorName([])).toBe("MCR Pathways");
    expect(
      resolveSearchAuthorName({ preferred_name: null, full_name: null })
    ).toBe("MCR Pathways");
  });
});

describe("indexPost", () => {
  beforeEach(() => mocks.saveObjects.mockClear());

  it("upserts the built record to the news index", async () => {
    await indexPost({
      postId: "post-1",
      content: "Hello",
      authorName: "A",
      createdAt: "2026-06-20T10:00:00.000Z",
    });
    expect(mocks.saveObjects).toHaveBeenCalledTimes(1);
    const arg = mocks.saveObjects.mock.calls[0][0];
    expect(arg.indexName).toBe(NEWS_INDEX);
    expect(arg.objects[0].objectID).toBe("post-1");
  });
});

describe("removePostFromIndex", () => {
  beforeEach(() => mocks.deleteObjects.mockClear());

  it("deletes the post by objectID from the news index", async () => {
    await removePostFromIndex("post-9");
    expect(mocks.deleteObjects).toHaveBeenCalledWith({
      indexName: NEWS_INDEX,
      objectIDs: ["post-9"],
    });
  });
});
