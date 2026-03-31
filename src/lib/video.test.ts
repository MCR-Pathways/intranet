import { describe, it, expect } from "vitest";
import { getEmbedUrl } from "./video";

describe("getEmbedUrl", () => {
  // ─── YouTube ────────────────────────────────────────────────────────────────

  it("converts standard YouTube watch URL", () => {
    expect(getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
  });

  it("converts YouTube watch URL with extra params", () => {
    expect(
      getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx0")
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("handles v= not being the first query param", () => {
    expect(
      getEmbedUrl("https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ")
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("converts youtu.be short URL", () => {
    expect(getEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
  });

  it("converts YouTube Shorts URL", () => {
    expect(getEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
  });

  it("converts YouTube Live URL", () => {
    expect(getEmbedUrl("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
  });

  it("converts YouTube embed URL", () => {
    expect(getEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
  });

  it("handles mobile YouTube URL", () => {
    expect(getEmbedUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
  });

  it("preserves timestamp from ?t= param", () => {
    expect(
      getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=120");
  });

  it("preserves timestamp from youtu.be URL", () => {
    expect(getEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=45")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=45"
    );
  });

  // ─── Vimeo ──────────────────────────────────────────────────────────────────

  it("converts Vimeo URL", () => {
    expect(getEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789"
    );
  });

  it("converts Vimeo private URL with hash", () => {
    expect(getEmbedUrl("https://vimeo.com/123456789/abcdef")).toBe(
      "https://player.vimeo.com/video/123456789?h=abcdef"
    );
  });

  // ─── Non-video / invalid URLs ───────────────────────────────────────────────

  it("returns empty for non-video URL", () => {
    expect(getEmbedUrl("https://example.com/page")).toBe("");
  });

  it("returns empty for YouTube channel URL", () => {
    expect(getEmbedUrl("https://www.youtube.com/@channel")).toBe("");
  });

  it("returns empty for YouTube playlist URL", () => {
    expect(getEmbedUrl("https://www.youtube.com/playlist?list=PLx0")).toBe("");
  });

  it("returns empty for invalid URL", () => {
    expect(getEmbedUrl("not-a-url")).toBe("");
  });

  it("returns empty for javascript: protocol", () => {
    expect(getEmbedUrl("javascript:alert(1)")).toBe("");
  });

  it("returns empty for data: protocol", () => {
    expect(getEmbedUrl("data:text/html,<h1>Hi</h1>")).toBe("");
  });

  it("returns empty for empty string", () => {
    expect(getEmbedUrl("")).toBe("");
  });
});
