"use client";

import { useState, useRef, createElement } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Pencil, Trash2, ChevronDown } from "lucide-react";
import {
  toolShedFormatConfig,
  postcardFields,
  type ToolShedFormat,
  type PostcardContent,
  type ThreeTwoOneContent,
  type TakeoverContent,
} from "@/lib/learning";
import { timeAgo, getInitials, filterAvatarUrl, getAvatarColour, cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { ToolShedEntryWithAuthor } from "@/app/(protected)/learning/tool-shed/actions";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EntryCardProps {
  entry: ToolShedEntryWithAuthor;
  currentUserId: string;
  isAdmin: boolean;
  onEdit: (entry: ToolShedEntryWithAuthor) => void;
  onDelete: (id: string) => void;
  onTagClick?: (tag: string) => void;
}

// ─── Content Preview ────────────────────────────────────────────────────────

function getContentPreview(
  format: ToolShedFormat,
  content: Record<string, unknown>,
  eventName?: string | null
): string {
  let preview = "";
  switch (format) {
    case "postcard": {
      const pc = content as unknown as PostcardContent;
      preview = [pc.elevator_pitch, pc.lightbulb_moment, pc.programme_impact, pc.golden_nugget]
        .find((v) => typeof v === "string" && v.trim()) ?? "";
      break;
    }
    case "three_two_one": {
      const tto = content as unknown as ThreeTwoOneContent;
      const allItems = [
        ...(Array.isArray(tto.three_learned) ? tto.three_learned : []),
        ...(Array.isArray(tto.two_changes) ? tto.two_changes : []),
        typeof tto.one_question === "string" ? tto.one_question : "",
      ];
      preview = allItems.find((v) => typeof v === "string" && v.trim()) ?? "";
      break;
    }
    case "takeover": {
      const tk = content as unknown as TakeoverContent;
      const items = Array.isArray(tk.useful_things) ? tk.useful_things : [];
      preview = items.find((v) => typeof v === "string" && v.trim()) ?? "";
      break;
    }
  }
  // Fallback for partial drafts
  return preview || eventName || "Draft in progress";
}

// ─── Expanded Content Renderers ─────────────────────────────────────────────

function PostcardExpanded({ content }: { content: PostcardContent }) {
  const filledFields = postcardFields.filter((f) => content[f.key]?.trim());
  return (
    <div className="space-y-4">
      {filledFields.map((field, index) => {
        const isGoldenNugget = field.key === "golden_nugget";
        return (
          <div
            key={field.key}
            className={cn(
              index > 0 && "border-t border-border/40 pt-4",
              isGoldenNugget && "rounded-lg bg-amber-50/40 p-3 border-t-0"
            )}
          >
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <span className="text-base leading-none">{field.emoji}</span>
              <span>{field.label}</span>
            </h4>
            <p className="text-sm text-foreground/80 leading-relaxed pl-6">
              {content[field.key]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ThreeTwoOneExpanded({ content }: { content: ThreeTwoOneContent }) {
  const learned = (content.three_learned ?? []).filter((s) => s?.trim());
  const changes = (content.two_changes ?? []).filter((s) => s?.trim());
  const question = content.one_question?.trim() || "";

  return (
    <div className="space-y-4">
      {/* 3 Things Learned */}
      {learned.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <span className="text-base leading-none">📚</span>
            {learned.length} Key Takeaway{learned.length !== 1 ? "s" : ""}
          </h4>
          <div className="space-y-2 pl-1">
            {learned.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground/80 leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2 Things to Change */}
      {changes.length > 0 && (
        <div className={cn(learned.length > 0 && "border-t border-border/40 pt-4", "space-y-2")}>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <span className="text-base leading-none">🔄</span>
            {changes.length} Action{changes.length !== 1 ? "s" : ""} I&apos;ll Take
          </h4>
          <div className="space-y-2 pl-1">
            {changes.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground/80 leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1 Question */}
      {question && (
        <div className={cn((learned.length > 0 || changes.length > 0) && "border-t border-border/40 pt-4", "space-y-2")}>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <span className="text-base leading-none">❓</span>
            1 Question for the Team
          </h4>
          <blockquote className="ml-1 border-l-2 border-emerald-300 pl-4 pr-3 text-sm text-foreground/80 italic leading-relaxed">
            {question}
          </blockquote>
        </div>
      )}
    </div>
  );
}

function TakeoverExpanded({ content }: { content: TakeoverContent }) {
  const things = (content.useful_things ?? []).filter((s) => s?.trim());
  if (things.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <span className="text-base leading-none">🎯</span>
        {things.length} Most Useful Thing{things.length !== 1 ? "s" : ""}
      </h4>
      <div className="space-y-2 pl-1">
        {things.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 mt-0.5">
              {i + 1}
            </span>
            <span className="text-sm text-foreground/80 leading-relaxed">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpandedContent({
  format,
  content,
}: {
  format: ToolShedFormat;
  content: Record<string, unknown>;
}) {
  switch (format) {
    case "postcard":
      return <PostcardExpanded content={content as unknown as PostcardContent} />;
    case "three_two_one":
      return <ThreeTwoOneExpanded content={content as unknown as ThreeTwoOneContent} />;
    case "takeover":
      return <TakeoverExpanded content={content as unknown as TakeoverContent} />;
    default:
      return null;
  }
}

// ─── Entry Card ─────────────────────────────────────────────────────────────

export function EntryCard({
  entry,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
  onTagClick,
}: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const config = toolShedFormatConfig[entry.format];
  const canManage = entry.user_id === currentUserId || isAdmin;
  const preview = getContentPreview(entry.format, entry.content, entry.event_name);
  const { bg, fg } = getAvatarColour(entry.author.full_name);

  const handleExpand = () => {
    setExpanded(true);
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  return (
    <Card ref={cardRef} id={entry.id} className={cn("bg-card shadow-md rounded-xl overflow-clip transition-shadow hover:shadow-lg border-l-4", config.accent.border)}>
      <CardContent className="p-5">
        {/* Draft badge */}
        {!entry.is_published && (
          <Badge variant="warning" className="mb-3">
            Draft
          </Badge>
        )}

        {/* Header: author + format badge + time + kebab */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage
                src={filterAvatarUrl(entry.author.avatar_url) ?? undefined}
                alt={entry.author.full_name}
              />
              <AvatarFallback className={cn("text-xs font-semibold", bg, fg)}>
                {getInitials(entry.author.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {entry.author.preferred_name || entry.author.full_name}
              </p>
              {entry.author.job_title && (
                <p className="text-xs text-muted-foreground truncate">
                  {entry.author.job_title}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={config.badgeVariant} className="gap-1">
              {createElement(config.icon, { className: "h-3 w-3" })}
              {config.shortLabel}
            </Badge>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {timeAgo(entry.created_at)}
            </span>

            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label={`Actions for ${entry.title}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onEdit(entry)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onDelete(entry.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Event context */}
        {entry.event_name && (
          <div className="flex items-baseline gap-2 mb-2 min-w-0">
            <p className="text-[15px] font-semibold leading-snug truncate">
              {entry.event_name}
            </p>
            {entry.event_date && (
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                &middot; {formatDate(new Date(entry.event_date))}
              </span>
            )}
          </div>
        )}

        {/* Content: preview or expanded */}
        {expanded ? (
          <div className="mt-1">
            <ExpandedContent format={entry.format} content={entry.content} />
          </div>
        ) : (
          <div
            className="cursor-pointer group/preview"
            onClick={handleExpand}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleExpand();
              }
            }}
          >
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {preview}
            </p>
            <span className="text-sm text-primary font-medium mt-1 inline-flex items-center gap-1 group-hover/preview:underline">
              <ChevronDown className="h-3.5 w-3.5" />
              Show more
            </span>
          </div>
        )}

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className={cn("flex flex-wrap gap-1.5 mt-3", expanded && "border-t border-border/40 pt-3")}>
            {(expanded ? entry.tags : entry.tags.slice(0, 3)).map((tag) => (
              <Badge
                key={tag}
                variant="muted"
                className={cn(
                  "text-xs font-medium",
                  onTagClick && "cursor-pointer hover:bg-muted-foreground/20 transition-colors"
                )}
                onClick={(e) => {
                  if (onTagClick) {
                    e.stopPropagation();
                    onTagClick(tag);
                  }
                }}
              >
                {tag}
              </Badge>
            ))}
            {!expanded && entry.tags.length > 3 && (
              <span className="text-xs text-muted-foreground self-center">
                +{entry.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Collapse toggle */}
        {expanded && (
          <button
            type="button"
            className="flex items-center gap-1 mt-3 text-sm font-medium text-primary hover:underline transition-colors"
            onClick={() => setExpanded(false)}
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            Show less
          </button>
        )}
      </CardContent>
    </Card>
  );
}
