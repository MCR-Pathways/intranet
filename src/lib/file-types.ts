/**
 * File-type colour and icon mapping for document attachments.
 *
 * Applies the established file-type colour convention — Adobe Acrobat red
 * for PDF, Microsoft Word blue for DOC/DOCX, Excel green for XLSX/CSV,
 * PowerPoint orange for PPT/PPTX, neutral slate for TXT and unknown.
 *
 * Used by the news-feed attachment card, document lightbox toolbar, and
 * composer chip. Resources file element will adopt this in a later PR
 * (tracked in news-feed-drive-media-backlog.md).
 *
 * Convention: Tailwind colour-scale class strings (matches the tonal-pill
 * badge pattern from docs/design-system.md Section 1.8). No CSS custom
 * properties needed — the convention IS Tailwind utilities.
 */

import {
  FileText,
  FileSpreadsheet,
  Presentation,
  type LucideIcon,
} from "lucide-react";

export type FileTypeKey = "pdf" | "doc" | "sheet" | "slide" | "text";

export interface FileTypeConfig {
  /** Stable key for variant logic and analytics */
  key: FileTypeKey;
  /** Lucide icon component */
  Icon: LucideIcon;
  /** Short label shown in card meta line (e.g. "PDF", "DOCX") */
  label: string;
  /** Tailwind classes for the icon container background tint */
  bgClass: string;
  /** Tailwind classes for the icon foreground colour */
  fgClass: string;
}

const PDF_CONFIG: FileTypeConfig = {
  key: "pdf",
  Icon: FileText,
  label: "PDF",
  bgClass: "bg-red-50 dark:bg-red-950/30",
  fgClass: "text-red-700 dark:text-red-400",
};

const DOC_CONFIG: FileTypeConfig = {
  key: "doc",
  Icon: FileText,
  label: "DOC",
  bgClass: "bg-blue-50 dark:bg-blue-950/30",
  fgClass: "text-blue-700 dark:text-blue-400",
};
const DOCX_CONFIG: FileTypeConfig = { ...DOC_CONFIG, label: "DOCX" };

const XLSX_CONFIG: FileTypeConfig = {
  key: "sheet",
  Icon: FileSpreadsheet,
  label: "XLSX",
  bgClass: "bg-green-50 dark:bg-green-950/30",
  fgClass: "text-green-700 dark:text-green-400",
};
const XLS_CONFIG: FileTypeConfig = { ...XLSX_CONFIG, label: "XLS" };
const CSV_CONFIG: FileTypeConfig = { ...XLSX_CONFIG, label: "CSV" };

const PPTX_CONFIG: FileTypeConfig = {
  key: "slide",
  Icon: Presentation,
  label: "PPTX",
  bgClass: "bg-orange-50 dark:bg-orange-950/30",
  fgClass: "text-orange-700 dark:text-orange-400",
};
const PPT_CONFIG: FileTypeConfig = { ...PPTX_CONFIG, label: "PPT" };

const TXT_CONFIG: FileTypeConfig = {
  key: "text",
  Icon: FileText,
  label: "TXT",
  bgClass: "bg-slate-100 dark:bg-slate-800/40",
  fgClass: "text-slate-600 dark:text-slate-400",
};

const FALLBACK_CONFIG: FileTypeConfig = {
  ...TXT_CONFIG,
  label: "FILE",
};

const MIME_TO_CONFIG: Record<string, FileTypeConfig> = {
  "application/pdf": PDF_CONFIG,
  "application/msword": DOC_CONFIG,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    DOCX_CONFIG,
  "application/vnd.ms-excel": XLS_CONFIG,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    XLSX_CONFIG,
  "text/csv": CSV_CONFIG,
  "application/vnd.ms-powerpoint": PPT_CONFIG,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    PPTX_CONFIG,
  "text/plain": TXT_CONFIG,
};

const EXT_TO_CONFIG: Record<string, FileTypeConfig> = {
  pdf: PDF_CONFIG,
  doc: DOC_CONFIG,
  docx: DOCX_CONFIG,
  xls: XLS_CONFIG,
  xlsx: XLSX_CONFIG,
  csv: CSV_CONFIG,
  ppt: PPT_CONFIG,
  pptx: PPTX_CONFIG,
  txt: TXT_CONFIG,
};

function getExtension(fileName: string | null | undefined): string {
  if (!fileName) return "";
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : "";
}

/**
 * Resolve mime + filename to the visual config used to render the file-type
 * icon. Falls back to extension if mime is missing or generic, then to a
 * neutral slate config when neither is recognised.
 */
export function resolveFileType(
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
): FileTypeConfig {
  if (mimeType && Object.hasOwn(MIME_TO_CONFIG, mimeType)) {
    return MIME_TO_CONFIG[mimeType];
  }
  const ext = getExtension(fileName);
  if (ext && Object.hasOwn(EXT_TO_CONFIG, ext)) {
    return EXT_TO_CONFIG[ext];
  }
  return FALLBACK_CONFIG;
}
