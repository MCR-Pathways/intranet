/**
 * Shared Google service account authentication.
 *
 * Extracted from google-calendar.ts to be reused by google-drive.ts.
 * Uses GOOGLE_SERVICE_ACCOUNT_KEY env var (base64-encoded JSON key).
 */

export function getServiceAccountKey(): {
  client_email: string;
  private_key: string;
} {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyBase64) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable");
  }
  try {
    return JSON.parse(Buffer.from(keyBase64, "base64").toString("utf-8"));
  } catch (err) {
    throw new Error(
      `Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY: ${err instanceof Error ? err.message : "invalid base64 or JSON"}`
    );
  }
}

/** Mask an email address for safe logging (e.g. "a***@mcrpathways.org"). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local[0]}***@${domain}`;
}
