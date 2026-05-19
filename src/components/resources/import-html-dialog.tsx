"use client";

/**
 * Import HTML dialog for the native Plate editor.
 *
 * Reuses the same HTML→Plate walker as the WP migration script
 * (src/lib/wp-migration/html-to-plate.ts) so paste-from-anywhere produces
 * the same Plate vocabulary as a migrated article.
 *
 * No asset uploading — external image/file URLs in the pasted HTML stay
 * external. Editors can re-host individual files via the existing image /
 * file upload affordances afterwards.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { importHtmlAsPlate } from "@/app/(protected)/resources/native-actions";

const MAX_HTML_CHARS = 100_000;

interface ImportHtmlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the converted nodes + whether to replace existing content. */
  onImport: (
    value: Record<string, unknown>[],
    mode: "append" | "replace",
  ) => void;
}

export function ImportHtmlDialog({
  open,
  onOpenChange,
  onImport,
}: ImportHtmlDialogProps) {
  const [html, setHtml] = useState("");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setHtml("");
      setReplace(false);
      setBusy(false);
      setError(null);
      setWarnings([]);
    }
  }, [open]);

  const handleConvert = useCallback(async () => {
    if (!html.trim()) {
      setError("Paste some HTML to import");
      return;
    }
    setBusy(true);
    setError(null);
    setWarnings([]);
    try {
      const result = await importHtmlAsPlate(html);
      if (!result.success || !result.value) {
        setError(result.error ?? "Failed to convert HTML");
        return;
      }
      if (result.value.length === 0) {
        setError("No content was produced from the input. Check the HTML.");
        return;
      }
      onImport(result.value, replace ? "replace" : "append");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert");
    } finally {
      setBusy(false);
    }
  }, [html, replace, onImport, onOpenChange]);

  const overLimit = html.length > MAX_HTML_CHARS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import HTML</DialogTitle>
          <DialogDescription>
            Paste HTML from another source. Headings, paragraphs, lists, links,
            images, and embedded YouTube/Vimeo videos are converted to editor
            blocks. Tables are dropped to plaintext. External image and file
            URLs are kept as-is — re-host them with the editor toolbar if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-html-input">HTML</Label>
            <Textarea
              id="import-html-input"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder={`<h1>Article title</h1>\n<p>Body text…</p>\n<ul>\n  <li>Item one</li>\n  <li>Item two</li>\n</ul>`}
              rows={10}
              className="font-mono text-xs bg-card resize-y"
              disabled={busy}
            />
            <p
              className={`text-xs ${overLimit ? "text-destructive" : "text-muted-foreground"}`}
            >
              {html.length.toLocaleString()} / {MAX_HTML_CHARS.toLocaleString()} characters
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="import-html-replace"
              checked={replace}
              onCheckedChange={(checked) => setReplace(checked === true)}
              disabled={busy}
            />
            <Label
              htmlFor="import-html-replace"
              className="font-normal cursor-pointer"
            >
              Replace existing article content (default: append at the end)
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {warnings.length > 0 && (
            <details className="text-xs text-muted-foreground rounded-md border border-border bg-muted/30 p-3">
              <summary className="cursor-pointer font-medium">
                {warnings.length} conversion warning(s)
              </summary>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={busy || html.trim().length === 0 || overLimit}
          >
            {busy ? "Converting…" : "Convert and insert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
