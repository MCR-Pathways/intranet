import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load .env.test (playwright.config.ts also loads it, but globalSetup runs in its own worker)
dotenv.config({ path: path.resolve(__dirname, "..", ".env.test") });

/**
 * Global setup for E2E tests.
 *
 * For each test role, we:
 * 1. Generate a magic link via Supabase admin API (gets a hashed_token)
 * 2. Open a browser, visit the app's /auth/confirm?token_hash=...&type=magiclink
 *    (this verifies the OTP on the app domain, setting proper auth cookies via @supabase/ssr)
 * 3. Save the storageState to a JSON file
 */

// These are standard Supabase local dev keys (same for every `supabase start` instance).
// Loaded from .env.test via playwright.config.ts dotenv setup.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

// Test user accounts (from seed migration 00043)
// coordinator = external staff (is_external: true, user_type: staff)
export const TEST_USERS = {
  hrAdmin: {
    id: "a0000000-0000-4000-8000-000000000001",
    email: "eleanor.macgregor@mcrpathways.org",
  },
  lineManager: {
    id: "a0000000-0000-4000-8000-000000000060",
    email: "james.crawford@mcrpathways.org",
  },
  staff: {
    id: "a0000000-0000-4000-8000-000000000070",
    email: "zara.ahmed@mcrpathways.org",
  },
  coordinator: {
    id: "a0000000-0000-4000-8000-000000000074",
    email: "mark.davidson@mcrpathways.org",
  },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;

const AUTH_DIR = path.join(__dirname, ".auth");

export function authFile(role: TestUserRole) {
  return path.join(AUTH_DIR, `${role}.json`);
}

async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const browser = await chromium.launch();

  for (const [role, user] of Object.entries(TEST_USERS)) {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });

    if (error || !data?.properties?.hashed_token) {
      throw new Error(
        `Failed to generate magic link for ${role} (${user.email}): ${error?.message ?? "no hashed_token"}`
      );
    }

    // Visit the app's /auth/confirm endpoint (NOT the Supabase verify URL)
    // This ensures cookies are set on the app domain (127.0.0.1:3000)
    const confirmUrl = `${APP_URL}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`;

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(confirmUrl, { waitUntil: "networkidle", timeout: 15_000 });

    // Save the authenticated storage state
    await context.storageState({ path: authFile(role as TestUserRole) });
    await context.close();

    console.log(`Auth state saved for: ${role} (${user.email})`);
  }

  await browser.close();
}

export default globalSetup;
