/**
 * Shared validation utilities for server actions and renderers.
 *
 * Three text-length tiers:
 *   SHORT  (200)  — titles, names, single-line inputs
 *   MEDIUM (2000) — reasons, notes, comments, general free-text
 *   LONG   (5000) — legally-significant fields (FWR, RTW, exit interviews)
 */

// ── Hex colour ──────────────────────────────────────────────────────

/**
 * Validate that a string is a valid CSS hex colour (#RGB or #RRGGBB).
 * Only allows hex values — rejects named colours, rgb(), and other formats
 * to prevent CSS injection via style attributes.
 */
export function isValidHexColour(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

// ── UUID ────────────────────────────────────────────────────────────

/** UUID v4 format regex (case-insensitive). */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a valid UUID format.
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// ── Text length ─────────────────────────────────────────────────────

/** Single-line inputs: titles, names, short labels. */
export const MAX_SHORT_TEXT_LENGTH = 200;

/** Multi-line free-text: reasons, notes, comments. */
export const MAX_MEDIUM_TEXT_LENGTH = 2000;

/** Legally-significant long-form fields: FWR, RTW, exit interviews. */
export const MAX_LONG_TEXT_LENGTH = 5000;

/**
 * Returns an error message if `value` exceeds `maxLength`, or `null` if OK.
 *
 * The message includes both the current length and the maximum so the user
 * knows the exact overshoot.
 */
export function validateTextLength(
  value: string,
  maxLength: number,
): string | null {
  if (value.length > maxLength) {
    return `Text is ${value.length.toLocaleString()} characters, which exceeds the maximum of ${maxLength.toLocaleString()} characters.`;
  }
  return null;
}
