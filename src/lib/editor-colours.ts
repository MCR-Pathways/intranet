/**
 * Curated colour palettes for the article editor.
 *
 * Text colours use bold Tailwind shades for readability on white backgrounds.
 * Highlight colours use light/pastel shades so overlaid text remains legible.
 */

export interface EditorColour {
  /** Display label (e.g. "Red") */
  label: string;
  /** CSS colour value (e.g. "#DC2626"). Null means "remove colour". */
  value: string | null;
}

// ─── Text colours ───────────────────────────────────────────────────────

export const TEXT_COLOURS: EditorColour[] = [
  { label: "Default", value: null },
  { label: "Black", value: "#171717" },
  { label: "Dark grey", value: "#525252" },
  { label: "Grey", value: "#A3A3A3" },
  { label: "Red", value: "#DC2626" },
  { label: "Orange", value: "#EA580C" },
  { label: "Amber", value: "#D97706" },
  { label: "Green", value: "#16A34A" },
  { label: "Blue", value: "#2563EB" },
  { label: "Purple", value: "#9333EA" },
  { label: "Pink", value: "#DB2777" },
];

// ─── Highlight colours ──────────────────────────────────────────────────

export const HIGHLIGHT_COLOURS: EditorColour[] = [
  { label: "None", value: null },
  { label: "Yellow", value: "#FEF08A" },
  { label: "Green", value: "#BBF7D0" },
  { label: "Blue", value: "#BFDBFE" },
  { label: "Purple", value: "#DDD6FE" },
  { label: "Pink", value: "#FBCFE8" },
  { label: "Red", value: "#FECACA" },
  { label: "Orange", value: "#FED7AA" },
  { label: "Grey", value: "#E5E5E5" },
];
