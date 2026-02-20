import { describe, it, expect } from "vitest";
import { isValidElement } from "react";
import { extractUrls, linkifyText } from "./url";

describe("extractUrls", () => {
  it("detects a single URL", () => {
    expect(extractUrls("Check out https://example.com today")).toEqual([
      "https://example.com",
    ]);
  });

  it("detects multiple URLs", () => {
    const text =
      "Visit https://foo.com and http://bar.org for more info";
    expect(extractUrls(text)).toEqual([
      "https://foo.com",
      "http://bar.org",
    ]);
  });

  it("deduplicates URLs", () => {
    const text = "See https://example.com and https://example.com again";
    expect(extractUrls(text)).toEqual(["https://example.com"]);
  });

  it("returns empty array for text with no URLs", () => {
    expect(extractUrls("Hello world, no links here")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(extractUrls("")).toEqual([]);
  });

  it("detects URL at start of text", () => {
    expect(extractUrls("https://start.com is great")).toEqual([
      "https://start.com",
    ]);
  });

  it("detects URL at end of text", () => {
    expect(extractUrls("Check this out: https://end.com")).toEqual([
      "https://end.com",
    ]);
  });

  it("detects URLs with paths and query strings", () => {
    expect(
      extractUrls("Go to https://example.com/path?q=test&page=1")
    ).toEqual(["https://example.com/path?q=test&page=1"]);
  });

  it("ignores non-http protocols", () => {
    expect(extractUrls("Use ftp://files.com or data:text")).toEqual([]);
  });

  it("handles URL followed by closing paren", () => {
    // Closing paren and bracket are excluded by the regex
    const urls = extractUrls("See https://example.com) for details");
    expect(urls).toEqual(["https://example.com"]);
  });

  it("strips trailing period from URL", () => {
    expect(extractUrls("Visit https://example.com.")).toEqual([
      "https://example.com",
    ]);
  });

  it("strips trailing comma from URL", () => {
    expect(extractUrls("Check https://example.com, then continue")).toEqual([
      "https://example.com",
    ]);
  });

  it("strips trailing question mark used as sentence punctuation", () => {
    expect(extractUrls("Is it https://example.com?")).toEqual([
      "https://example.com",
    ]);
  });

  it("preserves query string but strips trailing period", () => {
    expect(
      extractUrls("See https://example.com/path?q=1.")
    ).toEqual(["https://example.com/path?q=1"]);
  });

  it("strips trailing exclamation mark", () => {
    expect(extractUrls("Wow https://example.com!")).toEqual([
      "https://example.com",
    ]);
  });

  it("strips trailing semicolon", () => {
    expect(extractUrls("Link: https://example.com; more text")).toEqual([
      "https://example.com",
    ]);
  });

  it("strips multiple trailing punctuation characters", () => {
    expect(extractUrls("Really?! https://example.com...")).toEqual([
      "https://example.com",
    ]);
  });
});

describe("linkifyText", () => {
  it("returns plain text when no URLs", () => {
    const result = linkifyText("Hello world");
    expect(result).toEqual(["Hello world"]);
  });

  it("wraps a URL in an anchor element", () => {
    const result = linkifyText("Visit https://example.com today");
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("Visit ");
    expect(isValidElement(result[1])).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = result[1] as any;
    expect(el.props.href).toBe("https://example.com");
    expect(el.props.target).toBe("_blank");
    expect(el.props.rel).toBe("noopener noreferrer");
    expect(el.props.children).toBe("https://example.com");
    expect(result[2]).toBe(" today");
  });

  it("handles multiple URLs", () => {
    const result = linkifyText(
      "See https://a.com and https://b.com here"
    );
    // "See " + <a> + " and " + <a> + " here"
    expect(result).toHaveLength(5);
    expect(result[0]).toBe("See ");
    expect(isValidElement(result[1])).toBe(true);
    expect(result[2]).toBe(" and ");
    expect(isValidElement(result[3])).toBe(true);
    expect(result[4]).toBe(" here");
  });

  it("handles URL at start of text", () => {
    const result = linkifyText("https://start.com is great");
    expect(isValidElement(result[0])).toBe(true);
    expect(result[1]).toBe(" is great");
  });

  it("handles URL at end of text", () => {
    const result = linkifyText("Check https://end.com");
    expect(result[0]).toBe("Check ");
    expect(isValidElement(result[1])).toBe(true);
  });

  it("handles text that is just a URL", () => {
    const result = linkifyText("https://only.com");
    expect(result).toHaveLength(1);
    expect(isValidElement(result[0])).toBe(true);
  });

  it("keeps invalid URLs as plain text", () => {
    // javascript: protocol should be rejected by sanitizeUrl
    const result = linkifyText("Click javascript:alert(1) here");
    // No http(s) prefix, so the regex won't even match it
    expect(result).toEqual(["Click javascript:alert(1) here"]);
  });

  it("strips trailing period from URL and keeps it as text", () => {
    const result = linkifyText("Visit https://example.com.");
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("Visit ");
    expect(isValidElement(result[1])).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = result[1] as any;
    expect(el.props.href).toBe("https://example.com");
    expect(el.props.children).toBe("https://example.com");
    expect(result[2]).toBe(".");
  });

  it("strips trailing comma from URL and keeps surrounding text", () => {
    const result = linkifyText("Check https://example.com, then go");
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("Check ");
    expect(isValidElement(result[1])).toBe(true);
    expect(result[2]).toBe(", then go");
  });
});
