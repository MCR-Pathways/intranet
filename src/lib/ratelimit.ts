import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Graceful degradation: if Redis is not configured, rate limiting is disabled.
// This allows local development without Upstash.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Pre-configured rate limiters for each endpoint category.
 * Returns null when Redis is not configured (graceful degradation).
 */
export const rateLimiters = redis
  ? {
      /** Auth confirm — strict, prevents OTP brute-force. 5 requests per 15 minutes per IP. */
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "15 m"),
        prefix: "rl:auth",
      }),

      /** Kiosk check-in — moderate, shared tablet with multiple users. 30 requests per minute per IP. */
      kiosk: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        prefix: "rl:kiosk",
      }),

      /** Webhooks — generous, allows Google's burst pattern. 100 requests per minute per resource. */
      webhook: new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(100, "1 m"),
        prefix: "rl:webhook",
      }),

      /** OG image proxy + certificate PDF — moderate, prevents SSRF/CPU abuse. 50 requests per minute per IP + user. */
      ogImage: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(50, "1 m"),
        prefix: "rl:og",
      }),
    }
  : null;

/**
 * Create a standardised 429 response with Retry-After header.
 */
export function createRateLimitResponse(resetTimestamp: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetTimestamp - Date.now()) / 1000));

  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    }
  );
}

/**
 * Extract client IP from request headers (Vercel sets x-forwarded-for).
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}
