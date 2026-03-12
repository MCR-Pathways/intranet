/**
 * Shared validation utilities for server actions and renderers.
 */

/**
 * Validate that a string is a valid CSS hex colour (#RGB or #RRGGBB).
 * Only allows hex values — rejects named colours, rgb(), and other formats
 * to prevent CSS injection via style attributes.
 */
export function isValidHexColour(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/** UUID v4 format regex (case-insensitive). */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a valid UUID format.
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
