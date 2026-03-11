/**
 * Editor keyboard shortcuts — single source of truth for tooltip labels.
 *
 * Follows Google Docs conventions:
 * - Mac: ⌘, ⌥ (Option), ⇧ (Shift)
 * - Windows/Linux: Ctrl, Alt, Shift
 */

// ─── Platform detection (SSR-safe) ──────────────────────────────────────

/**
 * Returns true if the user is on macOS.
 * Safe to call during SSR — returns false on the server.
 */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac/i.test(navigator.userAgent);
}

// ─── Shortcut definitions ───────────────────────────────────────────────

interface ShortcutDef {
  mac: string;
  win: string;
}

/**
 * Map of editor actions to their keyboard shortcuts.
 * Keys match toolbar button identifiers.
 */
export const EDITOR_SHORTCUTS: Record<string, ShortcutDef> = {
  bold: { mac: "⌘B", win: "Ctrl+B" },
  italic: { mac: "⌘I", win: "Ctrl+I" },
  underline: { mac: "⌘U", win: "Ctrl+U" },
  strikethrough: { mac: "⌘+Shift+S", win: "Ctrl+Shift+S" },
  code: { mac: "⌘E", win: "Ctrl+E" },
  heading1: { mac: "⌘+⌥+1", win: "Ctrl+Alt+1" },
  heading2: { mac: "⌘+⌥+2", win: "Ctrl+Alt+2" },
  heading3: { mac: "⌘+⌥+3", win: "Ctrl+Alt+3" },
  heading4: { mac: "⌘+⌥+4", win: "Ctrl+Alt+4" },
  bulletList: { mac: "⌘+Shift+8", win: "Ctrl+Shift+8" },
  orderedList: { mac: "⌘+Shift+7", win: "Ctrl+Shift+7" },
  blockquote: { mac: "⌘+Shift+B", win: "Ctrl+Shift+B" },
  link: { mac: "⌘K", win: "Ctrl+K" },
  alignLeft: { mac: "⌘+Shift+L", win: "Ctrl+Shift+L" },
  alignCentre: { mac: "⌘+Shift+E", win: "Ctrl+Shift+E" },
  alignRight: { mac: "⌘+Shift+R", win: "Ctrl+Shift+R" },
  undo: { mac: "⌘Z", win: "Ctrl+Z" },
  redo: { mac: "⌘+Shift+Z", win: "Ctrl+Shift+Z" },
  clearFormatting: { mac: "⌘+\\", win: "Ctrl+\\" },
  superscript: { mac: "⌘+.", win: "Ctrl+." },
  subscript: { mac: "⌘+,", win: "Ctrl+," },
} as const;

// ─── Tooltip label helpers ──────────────────────────────────────────────

/**
 * Returns the platform-appropriate keyboard shortcut string.
 * e.g. "⌘B" on Mac, "Ctrl+B" on Windows.
 */
export function getShortcut(key: string): string | null {
  const shortcut = EDITOR_SHORTCUTS[key];
  if (!shortcut) return null;
  return isMac() ? shortcut.mac : shortcut.win;
}

/**
 * Returns a tooltip label with optional keyboard shortcut.
 * e.g. "Bold (⌘B)" on Mac, "Bold (Ctrl+B)" on Windows.
 * If no shortcut exists for the key, returns just the label.
 */
export function getTooltipLabel(label: string, shortcutKey?: string): string {
  if (!shortcutKey) return label;
  const shortcut = getShortcut(shortcutKey);
  if (!shortcut) return label;
  return `${label} (${shortcut})`;
}
