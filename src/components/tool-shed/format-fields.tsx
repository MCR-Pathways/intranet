"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  postcardFields,
  type ToolShedFormat,
  type PostcardContent,
  type ThreeTwoOneContent,
  type TakeoverContent,
} from "@/lib/learning";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type FormatContent = PostcardContent | ThreeTwoOneContent | TakeoverContent;

interface FormatFieldsProps {
  format: ToolShedFormat;
  content: Partial<FormatContent>;
  onChange: (content: FormatContent) => void;
}

// ─── Placeholder Config ─────────────────────────────────────────────────────

const THREE_LEARNED_PLACEHOLDERS = [
  "A key concept or idea that stuck with you...",
  "Something that challenged your thinking...",
  "A practical skill or technique you picked up...",
];

const TWO_CHANGES_PLACEHOLDERS = [
  "One thing you'll start doing differently...",
  "Another change you'll bring to your work...",
];

const TAKEOVER_PLACEHOLDERS = [
  "The most impactful takeaway from the session...",
  "Something that surprised you or shifted your perspective...",
  "A practical tip the team can use straightaway...",
];

// ─── Postcard Fields ────────────────────────────────────────────────────────

function PostcardFields({
  content,
  onChange,
}: {
  content: Partial<PostcardContent>;
  onChange: (c: PostcardContent) => void;
}) {
  const update = (key: keyof PostcardContent, value: string) => {
    onChange({
      elevator_pitch: content.elevator_pitch ?? "",
      lightbulb_moment: content.lightbulb_moment ?? "",
      programme_impact: content.programme_impact ?? "",
      golden_nugget: content.golden_nugget ?? "",
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      {postcardFields.map((field) => {
        const isGoldenNugget = field.key === "golden_nugget";
        return (
          <div
            key={field.key}
            className={cn(
              "space-y-1.5",
              isGoldenNugget && "rounded-lg bg-amber-50/50 p-3"
            )}
          >
            <Label htmlFor={`postcard-${field.key}`} className="flex items-center gap-1.5">
              <span>{field.emoji}</span>
              <span>{field.label}</span>
            </Label>
            <Textarea
              id={`postcard-${field.key}`}
              placeholder={field.hint}
              value={content[field.key] ?? ""}
              onChange={(e) => update(field.key, e.target.value)}
              rows={3}
              maxLength={500}
              className="bg-card resize-none"
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── 3-2-1 Fields ───────────────────────────────────────────────────────────

function ThreeTwoOneFields({
  content,
  onChange,
}: {
  content: Partial<ThreeTwoOneContent>;
  onChange: (c: ThreeTwoOneContent) => void;
}) {
  const three = content.three_learned ?? ["", "", ""];
  const two = content.two_changes ?? ["", ""];
  const question = content.one_question ?? "";

  const updateThree = (index: number, value: string) => {
    const next = [...three];
    next[index] = value;
    onChange({ three_learned: next, two_changes: two, one_question: question });
  };

  const updateTwo = (index: number, value: string) => {
    const next = [...two];
    next[index] = value;
    onChange({ three_learned: three, two_changes: next, one_question: question });
  };

  return (
    <div className="space-y-6">
      {/* 3 Things Learned */}
      <div className="space-y-3">
        <Label className="text-base font-medium">📚 3 Key Takeaways</Label>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <Input
              placeholder={THREE_LEARNED_PLACEHOLDERS[i]}
              value={three[i] ?? ""}
              onChange={(e) => updateThree(i, e.target.value)}
              maxLength={300}
              className="bg-card"
            />
          </div>
        ))}
      </div>

      {/* 2 Things to Change */}
      <div className="space-y-3">
        <Label className="text-base font-medium">🔄 2 Actions I&apos;ll Take</Label>
        {[0, 1].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/10 text-xs font-semibold text-warning">
              {i + 1}
            </span>
            <Input
              placeholder={TWO_CHANGES_PLACEHOLDERS[i]}
              value={two[i] ?? ""}
              onChange={(e) => updateTwo(i, e.target.value)}
              maxLength={300}
              className="bg-card"
            />
          </div>
        ))}
      </div>

      {/* 1 Question */}
      <div className="space-y-1.5">
        <Label htmlFor="one-question" className="text-base font-medium">
          ❓ 1 Question for the Team
        </Label>
        <Textarea
          id="one-question"
          placeholder="What question did this raise that we should discuss as a team?"
          value={question}
          onChange={(e) =>
            onChange({ three_learned: three, two_changes: two, one_question: e.target.value })
          }
          rows={3}
          maxLength={500}
          className="bg-card resize-none"
        />
      </div>
    </div>
  );
}

// ─── Takeover Fields ────────────────────────────────────────────────────────

function TakeoverFields({
  content,
  onChange,
}: {
  content: Partial<TakeoverContent>;
  onChange: (c: TakeoverContent) => void;
}) {
  const things = content.useful_things ?? ["", "", ""];

  const update = (index: number, value: string) => {
    const next = [...things];
    next[index] = value;
    onChange({ useful_things: next });
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">🎯 3 Things Worth Sharing</Label>
      <p className="text-sm text-muted-foreground">
        If you had 10 minutes in a team meeting, what would you cover?
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/10 text-xs font-semibold text-warning">
            {i + 1}
          </span>
          <Textarea
            placeholder={TAKEOVER_PLACEHOLDERS[i]}
            value={things[i] ?? ""}
            onChange={(e) => update(i, e.target.value)}
            rows={2}
            maxLength={500}
            className="bg-card resize-none"
          />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function FormatFields({ format, content, onChange }: FormatFieldsProps) {
  switch (format) {
    case "postcard":
      return (
        <PostcardFields
          content={content as Partial<PostcardContent>}
          onChange={onChange as (c: PostcardContent) => void}
        />
      );
    case "three_two_one":
      return (
        <ThreeTwoOneFields
          content={content as Partial<ThreeTwoOneContent>}
          onChange={onChange as (c: ThreeTwoOneContent) => void}
        />
      );
    case "takeover":
      return (
        <TakeoverFields
          content={content as Partial<TakeoverContent>}
          onChange={onChange as (c: TakeoverContent) => void}
        />
      );
    default:
      return null;
  }
}
