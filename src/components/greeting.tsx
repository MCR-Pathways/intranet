import { getCurrentUser } from "@/lib/auth";

/**
 * Personal greeting block for the home page.
 *
 * Locked design (per `memory/intranet-design-feedback.md`):
 *   - Three time buckets, sharp boundaries, Europe/London tz
 *   - Quiet typography — text-2xl semibold (Notion home reference,
 *     not Asana hero-scale, not Linear's "no greeting at all")
 *   - Server-rendered per visit; the page is force-dynamic
 *   - Suppressed for users still in induction
 *
 * Returns null (renders nothing) when:
 *   - The user isn't loaded (the page should already redirect)
 *   - The user hasn't completed induction
 *
 * Display-name resolution:
 *   profile.preferred_name → first word of profile.full_name → email
 *   prefix (before @) → no name (renders "Good morning." standalone).
 */
export async function Greeting() {
  const { user, profile } = await getCurrentUser();

  if (!user || !profile) return null;
  if (profile.induction_completed_at == null) return null;

  const greetingPrefix = computeGreetingPrefix();
  const displayName = computeDisplayName(profile, user.email ?? null);

  // The greeting IS the page H1 — replaces "News Feed" so the page has
  // one heading, not two competing ones.
  return (
    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
      {displayName ? `${greetingPrefix}, ${displayName}.` : `${greetingPrefix}.`}
    </h1>
  );
}

function computeGreetingPrefix(): string {
  // Sharp boundaries (locked): morning < 12, afternoon 12–17, evening 18+.
  // Europe/London — staff are UK-based; DST handled by Intl.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hourPart = parts.find((p) => p.type === "hour");
  const hour = parseInt(hourPart?.value ?? "0", 10);

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function computeDisplayName(
  profile: { preferred_name?: string | null; full_name?: string | null },
  email: string | null,
): string | null {
  const preferred = profile.preferred_name?.trim();
  if (preferred) return preferred;

  const firstFromFullName = profile.full_name?.trim().split(/\s+/)[0];
  if (firstFromFullName) return firstFromFullName;

  if (email) {
    const prefix = email.split("@")[0]?.trim();
    if (prefix) return prefix;
  }

  return null;
}
