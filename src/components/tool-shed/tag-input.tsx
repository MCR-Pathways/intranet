"use client";

import { useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  maxTags?: number;
  placeholder?: string;
}

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  maxTags = 5,
  placeholder = "Add a tag...",
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (!trimmed) return;
      if (trimmed.length > 30) return;
      if (tags.includes(trimmed)) return;
      if (tags.length >= maxTags) return;

      onChange([...tags, trimmed]);
      setInputValue("");
      setShowSuggestions(false);
    },
    [tags, onChange, maxTags]
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    }
    if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const filteredSuggestions = inputValue.trim()
    ? suggestions
        .filter(
          (s) =>
            s.toLowerCase().includes(inputValue.toLowerCase()) &&
            !tags.includes(s.toLowerCase())
        )
        .slice(0, 5)
    : [];

  const atLimit = tags.length >= maxTags;

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Tags display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="muted" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay to allow suggestion click
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder={atLimit ? `Maximum ${maxTags} tags reached` : placeholder}
          disabled={atLimit}
          className="bg-card"
        />
        {!atLimit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {tags.length}/{maxTags}
          </span>
        )}

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-1 shadow-md">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur
                  addTag(suggestion);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
