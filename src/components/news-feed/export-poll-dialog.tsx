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
import { sanitiseCSVCell, buildCSVContent, downloadCSV } from "@/lib/csv";

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
  return question.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
      ...d.options.map((opt) => [opt.text, opt.voteCount, `${opt.percentage}%`]),
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }];
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
  const blob = new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `poll-results-${slug}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

async function exportAsPDF(
  d: ExportData,
  slug: string,
  includeSummary: boolean,
  includeIndividual: boolean,
  includeMetadata: boolean,
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(16);
  doc.text("Poll Results", 14, y);
  y += 8;

  // Question
  doc.setFontSize(11);
  doc.setTextColor(100);
  const questionLines = doc.splitTextToSize(d.question, pageWidth - 28);
  doc.text(questionLines, 14, y);
  y += questionLines.length * 5 + 4;

  // Meta line
  doc.setFontSize(9);
  doc.setTextColor(150);
  const metaLine = `${d.totalVoters} ${d.totalVoters === 1 ? "voter" : "voters"} · ${d.allowMultiple ? "Multi-select" : "Single choice"} · Closed ${d.closedAt ? new Date(d.closedAt).toLocaleDateString("en-GB") : "N/A"}`;
  doc.text(metaLine, 14, y);
  y += 10;

  doc.setTextColor(0);

  if (includeMetadata) {
    doc.setFontSize(12);
    doc.text("Metadata", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Field", "Value"]],
      body: [
        ["Question", d.question],
        ["Type", d.allowMultiple ? "Multi-select" : "Single choice"],
        ["Total Voters", String(d.totalVoters)],
        ["Created", new Date(d.createdAt).toLocaleDateString("en-GB")],
        ["Closed", d.closedAt ? new Date(d.closedAt).toLocaleDateString("en-GB") : "N/A"],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 51, 80] },
      margin: { left: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  if (includeSummary) {
    doc.setFontSize(12);
    doc.text("Summary", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Option", "Votes", "Percentage"]],
      body: d.options.map((opt) => [opt.text, String(opt.voteCount), `${opt.percentage}%`]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 51, 80] },
      margin: { left: 14 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  if (includeIndividual) {
    doc.setFontSize(12);
    doc.text("Individual Responses", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Voter", "Option Chosen", "Voted At"]],
      body: d.votes.map((v) => [
        v.voterName,
        v.optionText,
        new Date(v.votedAt).toLocaleString("en-GB"),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 51, 80] },
      margin: { left: 14 },
    });
  }

  doc.save(`poll-results-${slug}.pdf`);
}
