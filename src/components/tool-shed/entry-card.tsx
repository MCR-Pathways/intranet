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
import { MoreHorizontal, Pencil, Trash2, ChevronUp } from "lucide-react";
import {
  toolShedFormatConfig,
  postcardFields,
  type ToolShedFormat,
  type PostcardContent,
  type ThreeTwoOneContent,
  type TakeoverContent,
} from "@/lib/learning";
import { timeAgo, getInitials, filterAvatarUrl, getAvatarColour } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { ToolShedEntryWithAuthor } from "@/app/(protected)/learning/tool-shed/actions";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EntryCardProps {
  entry: ToolShedEntryWithAuthor;
  currentUserId: string;
  isAdmin: boolean;
  onEdit: (entry: ToolShedEntryWithAuthor) => void;
  onDelete: (id: string) => void;
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
      {postcardFields.map((field) => (
        <div key={field.key} className="space-y-1">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <span>{field.emoji}</span>
            <span>{field.label}</span>
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed pl-6">
            {content[field.key]}
          </p>
        </div>
      ))}
    </div>
  );
}

function ThreeTwoOneExpanded({ content }: { content: ThreeTwoOneContent }) {
  return (
    <div className="space-y-5">
      {/* 3 Things Learned */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">📚 3 Things I Learned</h4>
        <ol className="space-y-1.5 pl-6">
          {content.three_learned.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* 2 Things to Change */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">🔄 2 Things I&apos;ll Change</h4>
        <ol className="space-y-1.5 pl-6">
          {content.two_changes.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/10 text-xs font-semibold text-warning mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* 1 Question */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">❓ 1 Question Raised</h4>
        <blockquote className="ml-6 border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground italic leading-relaxed">
          {content.one_question}
        </blockquote>
      </div>
    </div>
  );
}

function TakeoverExpanded({ content }: { content: TakeoverContent }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">🎯 3 Most Useful Things</h4>
      <ol className="space-y-2 pl-6">
        {content.useful_things.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/10 text-xs font-semibold text-warning mt-0.5">
              {i + 1}
            </span>
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ol>
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

        {/* Header: author + time + kebab */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage
                src={filterAvatarUrl(entry.author.avatar_url) ?? undefined}
                alt={entry.author.full_name}
              />
              <AvatarFallback style={{ backgroundColor: bg, color: fg }} className="text-xs font-semibold">
                {getInitials(entry.author.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
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
          <p className="text-sm text-muted-foreground mb-2">
            <span className="font-medium">{entry.event_name}</span>
            {entry.event_date && (
              <span className="ml-2 text-xs">
                · {formatDate(new Date(entry.event_date))}
              </span>
            )}
          </p>
        )}

        {/* Content: preview or expanded */}
        <div
          className={expanded ? "" : "cursor-pointer"}
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
            <div className="mt-2">
              <ExpandedContent format={entry.format} content={entry.content} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {preview}
            </p>
          )}
        </div>

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(expanded ? entry.tags : entry.tags.slice(0, 3)).map((tag) => (
              <Badge key={tag} variant="muted" className="text-xs">
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

        {/* Collapse button */}
        {expanded && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-xs text-muted-foreground"
            onClick={() => setExpanded(false)}
          >
            <ChevronUp className="h-3 w-3 mr-1" />
            Show less
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
