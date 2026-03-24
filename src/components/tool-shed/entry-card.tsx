"use client";

import { useState, createElement } from "react";
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
import { MoreHorizontal, Pencil, Trash2, ChevronDown, CalendarDays } from "lucide-react";
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

function getContentPreview(format: ToolShedFormat, content: Record<string, unknown>): string {
  switch (format) {
    case "postcard":
      return (content as unknown as PostcardContent).elevator_pitch ?? "";
    case "three_two_one": {
      const learned = (content as unknown as ThreeTwoOneContent).three_learned;
      return Array.isArray(learned) ? learned[0] ?? "" : "";
    }
    case "takeover": {
      const things = (content as unknown as TakeoverContent).useful_things;
      return Array.isArray(things) ? things[0] ?? "" : "";
    }
    default:
      return "";
  }
}

// ─── Expanded Content Renderers ─────────────────────────────────────────────

function PostcardExpanded({ content }: { content: PostcardContent }) {
  return (
    <div className="space-y-4">
      {postcardFields.map((field, index) => {
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
  return (
    <div className="space-y-4">
      {/* 3 Things Learned */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <span className="text-base leading-none">📚</span>
          3 Key Takeaways
        </h4>
        <div className="space-y-2 pl-1">
          {content.three_learned.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-foreground/80 leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2 Things to Change */}
      <div className="border-t border-border/40 pt-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <span className="text-base leading-none">🔄</span>
          2 Actions I&apos;ll Take
        </h4>
        <div className="space-y-2 pl-1">
          {content.two_changes.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-foreground/80 leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 1 Question */}
      <div className="border-t border-border/40 pt-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <span className="text-base leading-none">❓</span>
          1 Question for the Team
        </h4>
        <blockquote className="ml-1 border-l-2 border-violet-300 pl-4 pr-3 text-sm text-foreground/80 italic leading-relaxed">
          {content.one_question}
        </blockquote>
      </div>
    </div>
  );
}

function TakeoverExpanded({ content }: { content: TakeoverContent }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <span className="text-base leading-none">🎯</span>
        3 Most Useful Things
      </h4>
      <div className="space-y-2 pl-1">
        {content.useful_things.map((item, i) => (
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
  const config = toolShedFormatConfig[entry.format];
  const canManage = entry.user_id === currentUserId || isAdmin;
  const preview = getContentPreview(entry.format, entry.content);
  const { bg, fg } = getAvatarColour(entry.author.full_name);

  return (
    <Card className="bg-card shadow-md rounded-xl overflow-clip transition-shadow hover:shadow-lg">
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
              <AvatarFallback style={{ backgroundColor: bg, color: fg }} className="text-xs font-semibold">
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

        {/* Event info */}
        {entry.event_name && (
          <div className="flex items-center gap-1.5 text-sm mb-3">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{entry.event_name}</span>
            {entry.event_date && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                · {formatDate(new Date(entry.event_date))}
              </span>
            )}
          </div>
        )}

        {/* Content: preview or expanded */}
        <div
          className={cn(!expanded && "cursor-pointer group/preview")}
          onClick={() => {
            if (!expanded) setExpanded(true);
          }}
          role={expanded ? undefined : "button"}
          tabIndex={expanded ? undefined : 0}
          onKeyDown={(e) => {
            if (!expanded && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setExpanded(true);
            }
          }}
        >
          {expanded ? (
            <div className="mt-1">
              <ExpandedContent format={entry.format} content={entry.content} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {preview}
              <span className="text-primary font-medium ml-1 group-hover/preview:underline">
                ...see more
              </span>
            </p>
          )}
        </div>

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
            className="flex items-center gap-1 mt-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(false)}
          >
            <ChevronDown className="h-3 w-3 rotate-180 transition-transform" />
            Show less
          </button>
        )}
      </CardContent>
    </Card>
  );
}
