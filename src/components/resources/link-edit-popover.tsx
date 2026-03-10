"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon } from "lucide-react";
import { isValidHttpUrl } from "@/lib/url";
import type { Editor } from "@tiptap/react";

interface LinkEditPopoverProps {
  editor: Editor;
}

/**
 * Popover for inserting or editing a link URL.
 * Sanitises URLs to https?:// only (case-insensitive, per RFC 3986).
 */
export function LinkEditPopover({ editor }: LinkEditPopoverProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const isActive = editor.isActive("link");

  function handleOpen(nextOpen: boolean) {
    if (nextOpen) {
      // Pre-fill with existing link URL if cursor is in a link
      const existingUrl = editor.getAttributes("link").href ?? "";
      setUrl(existingUrl);
    }
    setOpen(nextOpen);
  }

  function handleApply() {
    const trimmed = url.trim();

    if (!trimmed) {
      // Remove link if URL is empty
      editor.chain().focus().unsetLink().run();
      setOpen(false);
      setUrl("");
      return;
    }

    // Sanitise: only allow http:// and https:// (case-insensitive)
    if (!isValidHttpUrl(trimmed)) {
      return;
    }

    editor.chain().focus().setLink({ href: trimmed }).run();
    setOpen(false);
    setUrl("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  }

  function handleRemove() {
    editor.chain().focus().unsetLink().run();
    setOpen(false);
    setUrl("");
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={
            isActive
              ? "h-8 w-8 p-0 bg-accent text-accent-foreground"
              : "h-8 w-8 p-0"
          }
          aria-label="Insert link"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start" side="bottom">
        <div className="space-y-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={!isValidHttpUrl(url)}
            >
              Apply
            </Button>
            {isActive && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
