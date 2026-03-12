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
