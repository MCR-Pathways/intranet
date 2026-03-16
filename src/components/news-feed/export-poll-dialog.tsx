"use client";

import { useState, useTransition, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, FileText, FileSpreadsheet, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { exportPollResults } from "@/app/(protected)/intranet/actions";
import { sanitiseCSVCell, buildCSVContent, downloadCSV, downloadBlob } from "@/lib/csv";

type ExportFormat = "csv" | "xlsx" | "pdf";

interface ExportPollDialogProps {
  postId: string;
  pollQuestion: string;
  totalVotes: number;
  closedAt: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; ext: string; icon: typeof FileText }[] = [
  { value: "csv", label: "CSV", ext: ".csv", icon: FileText },
  { value: "xlsx", label: "Excel", ext: ".xlsx", icon: FileSpreadsheet },
  { value: "pdf", label: "PDF", ext: ".pdf", icon: File },
];

function generateSlug(question: string): string {
  const slug = question.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "export";
}

export function ExportPollDialog({
  postId,
  pollQuestion,
  totalVotes,
  closedAt,
  open,
  onOpenChange,
}: ExportPollDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeIndividual, setIncludeIndividual] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [isPending, startTransition] = useTransition();

  const closedLabel = closedAt
    ? `Closed ${new Date(closedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
    : "Closed";

  const handleExport = useCallback(() => {
    if (!includeSummary && !includeIndividual) {
      toast.error("Please select at least one data section to include");
      return;
    }

    startTransition(async () => {
      const result = await exportPollResults(postId);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Failed to export results");
        return;
      }

      const d = result.data;
      const slug = generateSlug(d.question);

      if (format === "csv") {
        exportAsCSV(d, slug, includeSummary, includeIndividual, includeMetadata);
      } else if (format === "xlsx") {
        await exportAsXLSX(d, slug, includeSummary, includeIndividual, includeMetadata);
      } else {
        await exportAsPDF(d, slug, includeSummary, includeIndividual, includeMetadata);
      }

      toast.success("Poll results exported");
      onOpenChange(false);
    });
  }, [postId, format, includeSummary, includeIndividual, includeMetadata, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Poll Results</DialogTitle>
          <DialogDescription>
            {pollQuestion} &middot; {totalVotes} {totalVotes === 1 ? "vote" : "votes"} &middot; {closedLabel}
          </DialogDescription>
        </DialogHeader>

        {/* Format selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Format</p>
          <div className="grid grid-cols-3 gap-2">
            {FORMAT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormat(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                    format === opt.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <Icon className={cn("h-6 w-6", format === opt.value ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.ext}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Data inclusion checkboxes */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Include in export</p>
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={includeSummary}
                onCheckedChange={(checked) => setIncludeSummary(checked === true)}
              />
              <span className="text-sm">Summary (options, vote counts, percentages)</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={includeIndividual}
                onCheckedChange={(checked) => setIncludeIndividual(checked === true)}
              />
              <span className="text-sm">Individual responses (voter name, choice, timestamp)</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={includeMetadata}
                onCheckedChange={(checked) => setIncludeMetadata(checked === true)}
              />
              <span className="text-sm">Poll metadata (created date, closed date, author)</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isPending || (!includeSummary && !includeIndividual)}>
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-1.5 h-4 w-4" />
                Download {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Export format implementations ────────────────────────────────────────────

interface ExportData {
  question: string;
  allowMultiple: boolean;
  createdAt: string;
  closedAt: string | null;
  options: { text: string; voteCount: number; percentage: number }[];
  totalVoters: number;
  totalActiveStaff: number;
  votes: { voterName: string; optionText: string; votedAt: string }[];
}

function buildSummaryRows(d: ExportData): string[][] {
  return d.options.map((opt, i) => [
    i === 0 ? sanitiseCSVCell(d.question) : "",
    sanitiseCSVCell(opt.text),
    String(opt.voteCount),
    `${opt.percentage}%`,
    i === 0 ? String(d.totalVoters) : "",
  ]);
}

function buildIndividualRows(d: ExportData): string[][] {
  return d.votes.map((v) => [
    sanitiseCSVCell(v.voterName),
    sanitiseCSVCell(v.optionText),
    new Date(v.votedAt).toLocaleString("en-GB"),
  ]);
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function exportAsCSV(
  d: ExportData,
  slug: string,
  includeSummary: boolean,
  includeIndividual: boolean,
  includeMetadata: boolean,
) {
  const sections: string[] = [];

  if (includeMetadata) {
    sections.push(
      "METADATA",
      buildCSVContent(
        ["Field", "Value"],
        [
          ["Question", sanitiseCSVCell(d.question)],
          ["Type", d.allowMultiple ? "Multi-select" : "Single choice"],
          ["Total Voters", String(d.totalVoters)],
          ["Active Staff", String(d.totalActiveStaff)],
          ["Participation", d.totalActiveStaff > 0 ? `${Math.round((d.totalVoters / d.totalActiveStaff) * 100)}%` : "N/A"],
          ["Created", new Date(d.createdAt).toLocaleDateString("en-GB")],
          ["Closed", d.closedAt ? new Date(d.closedAt).toLocaleDateString("en-GB") : "N/A"],
        ]
      ),
      ""
    );
  }

  if (includeSummary) {
    sections.push(
      "SUMMARY",
      buildCSVContent(
        ["Question", "Option", "Votes", "Percentage", "Total Voters"],
        buildSummaryRows(d)
      ),
      ""
    );
  }

  if (includeIndividual) {
    sections.push(
      "INDIVIDUAL RESPONSES",
      buildCSVContent(
        ["Voter", "Option Chosen", "Voted At"],
        buildIndividualRows(d)
      )
    );
  }

  downloadCSV(sections.join("\n"), `poll-results-${slug}.csv`);
}

// ─── XLSX ────────────────────────────────────────────────────────────────────

async function exportAsXLSX(
  d: ExportData,
  slug: string,
  includeSummary: boolean,
  includeIndividual: boolean,
  includeMetadata: boolean,
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  if (includeMetadata) {
    const metaData = [
      ["Field", "Value"],
      ["Question", d.question],
      ["Type", d.allowMultiple ? "Multi-select" : "Single choice"],
      ["Total Voters", d.totalVoters],
      ["Active Staff", d.totalActiveStaff],
      ["Participation", d.totalActiveStaff > 0 ? `${Math.round((d.totalVoters / d.totalActiveStaff) * 100)}%` : "N/A"],
      ["Created", new Date(d.createdAt).toLocaleDateString("en-GB")],
      ["Closed", d.closedAt ? new Date(d.closedAt).toLocaleDateString("en-GB") : "N/A"],
    ];
    const metaSheet = XLSX.utils.aoa_to_sheet(metaData);
    metaSheet["!cols"] = [{ wch: 15 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, metaSheet, "Metadata");
  }

  if (includeSummary) {
    const summaryData = [
      ["Option", "Votes", "Percentage"],
      ...d.options.map((opt) => [opt.text, opt.voteCount, opt.percentage / 100]),
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }];
    // Format percentage column as % (rows start at index 1 since row 0 is header)
    for (let i = 0; i < d.options.length; i++) {
      const cell = summarySheet[XLSX.utils.encode_cell({ r: i + 1, c: 2 })];
      if (cell) cell.z = "0%";
    }
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
  }

  if (includeIndividual) {
    const individualData = [
      ["Voter", "Option Chosen", "Voted At"],
      ...d.votes.map((v) => [
        v.voterName,
        v.optionText,
        new Date(v.votedAt).toLocaleString("en-GB"),
      ]),
    ];
    const individualSheet = XLSX.utils.aoa_to_sheet(individualData);
    individualSheet["!cols"] = [{ wch: 25 }, { wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, individualSheet, "Individual Responses");
  }

  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `poll-results-${slug}.xlsx`
  );
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

// MCR brand colours as RGB arrays
const MCR_DARK_BLUE: [number, number, number] = [33, 51, 80];
const MCR_TEAL: [number, number, number] = [42, 96, 117];
const LIGHT_GREY_BG: [number, number, number] = [242, 244, 247];
const ALT_ROW_BG: [number, number, number] = [248, 249, 250];
const BAR_TRACK_GREY: [number, number, number] = [230, 232, 236];
const SEPARATOR_GREY: [number, number, number] = [220, 220, 220];
const WHITE: [number, number, number] = [255, 255, 255];

/** Convert the MCR SVG logo to a PNG data URL via an offscreen canvas. */
async function loadLogoAsDataUrl(): Promise<string | null> {
  try {
    const response = await fetch("/MCR_LOGO-1.svg");
    if (!response.ok) return null;

    const svgText = await response.text();
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    try {
      const img = new Image();
      img.src = url;
      await img.decode();

      const scale = 2; // retina quality
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

async function exportAsPDF(
  d: ExportData,
  slug: string,
  includeSummary: boolean,
  includeIndividual: boolean,
  includeMetadata: boolean,
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  interface jsPDFWithAutoTable { lastAutoTable: { finalY: number } }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const closedDate = d.closedAt ? new Date(d.closedAt).toLocaleDateString("en-GB") : "N/A";

  // ─── 1. Logo (top-right, matching MCR official documents) ───────────
  const logoDataUrl = await loadLogoAsDataUrl();
  if (logoDataUrl) {
    // Original SVG is 168x50 — scale to fit nicely in top-right
    const logoW = 50;
    const logoH = 15;
    doc.addImage(logoDataUrl, "PNG", pageWidth - margin - logoW, margin, logoW, logoH);
  }

  // ─── 2. Title area (white background, left-aligned) ─────────────────
  let y = margin + 8;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...MCR_DARK_BLUE);
  doc.text("Poll Results", margin, y);
  y += 10;

  // Question
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const questionLines = doc.splitTextToSize(d.question, contentWidth - 60);
  doc.text(questionLines, margin, y);
  y += questionLines.length * 5.5 + 4;

  // Thin dark blue line under title area
  doc.setDrawColor(...MCR_DARK_BLUE);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ─── 3. Meta line ──────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  const metaLine = `${d.totalVoters} ${d.totalVoters === 1 ? "voter" : "voters"}  ·  ${d.allowMultiple ? "Multi-select" : "Single choice"}  ·  Closed ${closedDate}`;
  doc.text(metaLine, margin, y);
  y += 8;

  // ─── 4. Participation callout box ──────────────────────────────────
  if (d.totalActiveStaff > 0) {
    const participationPct = Math.round((d.totalVoters / d.totalActiveStaff) * 100);
    doc.setFillColor(...LIGHT_GREY_BG);
    doc.roundedRect(margin, y, contentWidth, 12, 2, 2, "F");
    // Left accent stripe
    doc.setFillColor(...MCR_TEAL);
    doc.rect(margin, y, 3, 12, "F");
    doc.setFontSize(9);
    doc.setTextColor(...MCR_TEAL);
    doc.setFont("helvetica", "bold");
    doc.text(`${d.totalVoters} of ${d.totalActiveStaff} staff voted (${participationPct}% participation)`, margin + 8, y + 8);
    y += 18;
  } else {
    y += 2;
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  // ─── 5. Horizontal bar chart ───────────────────────────────────────
  if (includeSummary && d.options.length > 0) {
    const maxPercentage = Math.max(...d.options.map((o) => o.percentage), 1);
    const barHeight = 8;
    const barGap = 5;
    const labelWidth = 65;
    const barAreaWidth = contentWidth - labelWidth - 30;
    const winningVotes = Math.max(...d.options.map((o) => o.voteCount));

    for (const opt of d.options) {
      const isWinner = opt.voteCount === winningVotes && opt.voteCount > 0;

      // Option label
      doc.setFontSize(8);
      doc.setFont("helvetica", isWinner ? "bold" : "normal");
      doc.setTextColor(...MCR_DARK_BLUE);
      const label = doc.splitTextToSize(opt.text, labelWidth - 4)[0];
      doc.text(label, margin, y + 5.5);

      // Bar track
      const barX = margin + labelWidth;
      doc.setFillColor(...BAR_TRACK_GREY);
      doc.roundedRect(barX, y, barAreaWidth, barHeight, 1.5, 1.5, "F");

      // Bar fill
      const fillWidth = Math.max((opt.percentage / maxPercentage) * barAreaWidth, 0);
      if (fillWidth > 0) {
        doc.setFillColor(...(isWinner ? MCR_DARK_BLUE : MCR_TEAL));
        doc.roundedRect(barX, y, fillWidth, barHeight, 1.5, 1.5, "F");
      }

      // Percentage label
      doc.setFontSize(8);
      doc.setFont("helvetica", isWinner ? "bold" : "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`${opt.percentage}%`, barX + barAreaWidth + 3, y + 5.5);

      y += barHeight + barGap;
    }

    y += 2;
    doc.setDrawColor(...SEPARATOR_GREY);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  }

  // ─── 6. Metadata table ─────────────────────────────────────────────
  if (includeMetadata) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MCR_DARK_BLUE);
    doc.text("Metadata", margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Field", "Value"]],
      body: [
        ["Question", d.question],
        ["Type", d.allowMultiple ? "Multi-select" : "Single choice"],
        ["Total Voters", String(d.totalVoters)],
        ["Active Staff", String(d.totalActiveStaff)],
        ["Participation", d.totalActiveStaff > 0 ? `${Math.round((d.totalVoters / d.totalActiveStaff) * 100)}%` : "N/A"],
        ["Created", new Date(d.createdAt).toLocaleDateString("en-GB")],
        ["Closed", closedDate],
      ],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: MCR_DARK_BLUE, textColor: WHITE },
      alternateRowStyles: { fillColor: ALT_ROW_BG },
      margin: { left: margin, right: margin },
    });

    y = (doc as unknown as jsPDFWithAutoTable).lastAutoTable?.finalY ?? y;
    y += 6;
    doc.setDrawColor(...SEPARATOR_GREY);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  }

  // ─── 7. Summary table ──────────────────────────────────────────────
  if (includeSummary) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MCR_DARK_BLUE);
    doc.text("Summary", margin, y);
    y += 4;

    const winningVotes = Math.max(...d.options.map((o) => o.voteCount));

    autoTable(doc, {
      startY: y,
      head: [["Option", "Votes", "Percentage"]],
      body: d.options.map((opt) => [opt.text, String(opt.voteCount), `${opt.percentage}%`]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: MCR_DARK_BLUE, textColor: WHITE },
      alternateRowStyles: { fillColor: ALT_ROW_BG },
      margin: { left: margin, right: margin },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
      },
      didParseCell: (data: { section: string; row: { index: number }; cell: { styles: { fontStyle: string } } }) => {
        if (data.section === "body" && d.options[data.row.index]?.voteCount === winningVotes && winningVotes > 0) {
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    y = (doc as unknown as jsPDFWithAutoTable).lastAutoTable?.finalY ?? y;
    y += 6;
    doc.setDrawColor(...SEPARATOR_GREY);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  }

  // ─── 8. Individual responses table ─────────────────────────────────
  if (includeIndividual) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MCR_DARK_BLUE);
    doc.text("Individual Responses", margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Voter", "Option Chosen", "Voted At"]],
      body: d.votes.map((v) => [
        v.voterName,
        v.optionText,
        new Date(v.votedAt).toLocaleString("en-GB"),
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: MCR_DARK_BLUE, textColor: WHITE },
      alternateRowStyles: { fillColor: ALT_ROW_BG },
      margin: { left: margin, right: margin },
    });
  }

  // ─── 9. Footer (every page) ──────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  const exportedAt = new Date().toLocaleString("en-GB");
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(`Exported on ${exportedAt}`, margin, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  doc.save(`poll-results-${slug}.pdf`);
}
