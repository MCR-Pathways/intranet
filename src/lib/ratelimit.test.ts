import { describe, it, expect, vi, beforeEach } from "vitest";

// Store original env before any imports
const originalEnv = { ...process.env };

describe("ratelimit", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  describe("when Redis is not configured", () => {
    it("exports null rateLimiters", async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const { rateLimiters } = await import("./ratelimit");
      expect(rateLimiters).toBeNull();
    });
  });

  describe("when Redis is configured", () => {
    it("exports rate limiters object with all presets", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

      const { rateLimiters } = await import("./ratelimit");
      expect(rateLimiters).not.toBeNull();
      expect(rateLimiters).toHaveProperty("auth");
      expect(rateLimiters).toHaveProperty("kiosk");
      expect(rateLimiters).toHaveProperty("webhook");
      expect(rateLimiters).toHaveProperty("ogImage");
    });
  });

  describe("createRateLimitResponse", () => {
    it("returns 429 with Retry-After header", async () => {
      const { createRateLimitResponse } = await import("./ratelimit");
      const futureReset = Date.now() + 30_000; // 30 seconds from now

      const response = createRateLimitResponse(futureReset);

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBeTruthy();

      const body = await response.json();
      expect(body.error).toBe("Too many requests");
    });

    it("sets Retry-After to at least 1 second", async () => {
      const { createRateLimitResponse } = await import("./ratelimit");
      // Reset in the past
      const pastReset = Date.now() - 5000;

      const response = createRateLimitResponse(pastReset);
      expect(response.headers.get("Retry-After")).toBe("1");
    });
  });

  describe("getClientIp", () => {
    it("extracts IP from x-forwarded-for header", async () => {
      const { getClientIp } = await import("./ratelimit");
      const request = new Request("https://example.com", {
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      });

      expect(getClientIp(request)).toBe("1.2.3.4");
    });

    it("returns 'unknown' when header is missing", async () => {
      const { getClientIp } = await import("./ratelimit");
      const request = new Request("https://example.com");

      expect(getClientIp(request)).toBe("unknown");
    });

    it("trims whitespace from IP", async () => {
      const { getClientIp } = await import("./ratelimit");
      const request = new Request("https://example.com", {
        headers: { "x-forwarded-for": " 10.0.0.1 , 10.0.0.2" },
      });

      expect(getClientIp(request)).toBe("10.0.0.1");
    });
  });
});
