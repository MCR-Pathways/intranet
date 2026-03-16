/**
 * Shared CSV utilities.
 * Used by sign-in reports and poll result exports.
 */

/**
 * Sanitise a cell value for CSV export to prevent CSV injection.
 * Prefixes cells that start with formula-triggering characters
 * with a single quote to force plain-text rendering in Excel/Sheets.
 */
export function sanitiseCSVCell(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^[=+\-@\t\r\n]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * Build a CSV string from headers and rows, with proper quoting.
 * Each cell is wrapped in double quotes with internal quotes escaped.
 */
export function buildCSVContent(headers: string[], rows: string[][]): string {
  return [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
}

/**
 * Trigger a browser file download from a Blob via a programmatic link click.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Trigger a browser CSV download via a programmatic link click.
 */
export function downloadCSV(content: string, filename: string): void {
  downloadBlob(new Blob([content], { type: "text/csv;charset=utf-8;" }), filename);
}
